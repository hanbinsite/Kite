import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { listen } from "@tauri-apps/api/event";
import { sendHttpRequest, cancelHttpRequest, downloadHttpResponse, insertHistoryEntry } from "@api-client/core/http";
import { buildIpcAuth as buildIpcAuthUtil } from "@api-client/core/http";
import { markStart, markEnd, VariableResolver, variablesToRecord, handleError,
  getCollectionVariables, getFolderVariables, mergeHeaders, resolveAuth, collectPreRequestChain, collectPostResponseChain } from "@api-client/core";
import type { VariableScope } from "@api-client/core";
import type { IpcHttpRequestConfig, IpcBodyConfig, IpcRequestSettings, IpcAuthConfig } from "@api-client/core/http";
import { executeScript, type ScriptResult, type ScriptContext } from "@api-client/core/script";
import type {
  HttpResponse,
  HttpMethod,
  Header,
  QueryParam,
  BodyConfig,
  RequestSettings,
  AuthConfig,
} from "@api-client/types";
import type { TestResult } from "@api-client/core/script";
import { toast } from "@api-client/ui";
import { useConsoleStore } from "./console-store";
import { useCollectionStore } from "./collection-store";
import { useTabStore } from "@api-client/core";

function applyScriptHeaders(ipcConfig: IpcHttpRequestConfig, mod: { headers?: unknown }) {
  const extraHeaders = Array.isArray(mod.headers) ? mod.headers : [];
  for (const h of extraHeaders) {
    const hRec = h as { key?: string; value?: string };
    if (hRec.key && hRec.value) {
      const existing = ipcConfig.headers.findIndex((eh) => eh.key === hRec.key);
      if (existing >= 0) {
        ipcConfig.headers[existing] = { key: hRec.key, value: hRec.value, disabled: false };
      } else {
        ipcConfig.headers.push({ key: hRec.key, value: hRec.value, disabled: false });
      }
    }
  }
}

const MAX_REQUEST_DATA_ENTRIES = 50;
const requestDataAccessOrder: string[] = [];

function getOrCreateTabData(map: Record<string, RequestData>, tabId: string): RequestData {
  if (!map[tabId]) {
    if (Object.keys(map).length >= MAX_REQUEST_DATA_ENTRIES) {
      let oldest = requestDataAccessOrder.shift();
      while (oldest && !map[oldest]) {
        oldest = requestDataAccessOrder.shift();
      }
      if (oldest) {
        delete map[oldest];
      }
    }
    map[tabId] = {
      headers: [],
      params: [],
      body: null,
      auth: { ...DEFAULT_AUTH },
      settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, verifySsl: true },
      scripts: { preRequest: undefined, postResponse: undefined },
    };
  }
  const idx = requestDataAccessOrder.indexOf(tabId);
  if (idx >= 0) requestDataAccessOrder.splice(idx, 1);
  requestDataAccessOrder.push(tabId);
  return map[tabId];
}
async function executePreRequestScripts(
  tabId: string,
  code: string,
  scriptCtx: ScriptContext,
  source: string,
  ipcConfig: IpcHttpRequestConfig,
  envScopes: VariableScope,
  set: (fn: (state: RequestState) => void) => void,
): Promise<boolean> {
  try {
    const scriptStart = Date.now();
    const scriptResult: ScriptResult = await executeScript({ code, context: scriptCtx });
    logScriptResult(tabId, "pre-request", scriptResult, scriptStart);
    if (scriptResult.modifiedRequest) {
      if (scriptResult.modifiedRequest.headers) {
        applyScriptHeaders(ipcConfig, scriptResult.modifiedRequest);
      }
    }
    applyScriptVariables(scriptResult, envScopes);
    return true;
  } catch (scriptErr) {
    useConsoleStore.getState().addEntry(tabId, {
      level: "error",
      message: `[Pre-request][${source}] 执行失败: ${scriptErr}`,
      source: "pre-request",
    });
    set((state) => {
      state.errors[tabId] = `Script Error [${source}]: ${scriptErr}`;
      delete state.loadingTabs[tabId];
    });
    return false;
  }
}

async function executePostResponseScripts(
  tabId: string,
  code: string,
  scriptCtx: ScriptContext,
  source: string,
  envScopes: VariableScope,
  setTestResults: (tabId: string, results: TestResult[]) => void,
): Promise<void> {
  try {
    const scriptStart = Date.now();
    const scriptResult: ScriptResult = await executeScript({ code, context: scriptCtx });
    logScriptResult(tabId, "post-response", scriptResult, scriptStart);
    if (scriptResult.testResults.length > 0) {
      setTestResults(tabId, scriptResult.testResults);
    }
    applyScriptVariables(scriptResult, envScopes);
  } catch (scriptErr) {
    useConsoleStore.getState().addEntry(tabId, {
      level: "error",
      message: `[Post-response][${source}] 执行失败: ${scriptErr}`,
      source: "post-response",
    });
  }
}

export interface RequestData {
  headers: Header[];
  params: QueryParam[];
  body: BodyConfig | null;
  auth: AuthConfig;
  settings: RequestSettings;
  scripts: { preRequest?: string; postResponse?: string };
}

export interface DownloadState {
  requestId: string;
  totalBytes: number;
  downloadedBytes: number;
  percentage: number;
  status: "downloading" | "complete" | "error";
  filePath?: string;
  durationMs?: number;
  error?: string;
}

export interface RequestState {
  loadingTabs: Record<string, boolean>;
  responses: Record<string, HttpResponse>;
  testResults: Record<string, TestResult[]>;
  errors: Record<string, string>;
  requestDataMap: Record<string, RequestData>;
  currentTabId: string | null;
  dirtyTabs: Record<string, boolean>;
  historyRefreshCounter: number;
  previousResponses: Record<string, string>;
  downloads: Record<string, DownloadState>;
}

export interface RequestActions {
  setTabLoading: (tabId: string, loading: boolean) => void;
  setResponse: (tabId: string, response: HttpResponse) => void;
  setError: (tabId: string, error: string) => void;
  clearError: (tabId: string) => void;
  clearResponse: (tabId: string) => void;
  switchTab: (tabId: string | null) => void;
  removeTabData: (tabId: string) => void;
  setRequestHeaders: (headers: Header[]) => void;
  setRequestParams: (params: QueryParam[]) => void;
  setRequestBody: (body: BodyConfig | null) => void;
  setRequestAuth: (auth: AuthConfig) => void;
  setRequestSettings: (settings: RequestSettings) => void;
  setRequestScripts: (scripts: { preRequest?: string; postResponse?: string }) => void;
  setTestResults: (tabId: string, results: TestResult[]) => void;
  sendRequest: (tabId: string, method: HttpMethod, url: string) => Promise<void>;
  cancelRequest: (tabId: string) => Promise<void>;
  downloadResponse: (tabId: string, method: HttpMethod, url: string) => Promise<void>;
  initTabData: (tabId: string, data?: Partial<RequestData>) => void;
  markDirty: (tabId: string) => void;
  clearDirty: (tabId: string) => void;
  isDirty: (tabId: string) => boolean;
}

export type RequestStore = RequestState & RequestActions;

const DEFAULT_AUTH: AuthConfig = { type: "none", config: {} };

export const DEFAULT_REQUEST_DATA: RequestData = {
  headers: [],
  params: [],
  body: null,
  auth: DEFAULT_AUTH,
  settings: {
    timeoutMs: 30000,
    followRedirects: true,
    maxRedirects: 10,
    verifySsl: true,
  },
  scripts: { preRequest: undefined, postResponse: undefined },
};

export function buildIpcBodyConfig(body: BodyConfig | null, resolver?: VariableResolver): IpcBodyConfig | null {
  if (!body || body.mode === "none") return null;

  if (body.mode === "raw" && body.raw) {
    const languageToContentType: Record<string, string> = {
      json: "application/json",
      javascript: "application/javascript",
      text: "text/plain",
      html: "text/html",
      xml: "application/xml",
      yaml: "application/yaml",
    };
    const content = resolver ? resolver.resolve(body.raw.content) : body.raw.content;
    return {
      mode: "raw",
      content,
      content_type: languageToContentType[body.raw.language] ?? "text/plain",
    };
  }

  if (body.mode === "urlencoded" && body.urlencoded) {
    return {
      mode: "urlencoded",
      content: null,
      content_type: "application/x-www-form-urlencoded",
      urlencoded: body.urlencoded
        .filter((p) => !p.disabled && p.key)
        .map((p) => ({ key: p.key, value: p.value, disabled: p.disabled })),
    };
  }

  if (body.mode === "formdata" && body.formdata) {
    return {
      mode: "formdata",
      content: null,
      content_type: "multipart/form-data",
      formdata: body.formdata
        .filter((p) => !p.disabled && p.key)
        .map((p) => ({
          key: p.key,
          value: p.value,
          param_type: p.type,
          disabled: p.disabled,
          content_type: p.contentType,
        })),
    };
  }

  if (body.mode === "graphql" && body.graphql) {
    return {
      mode: "graphql",
      content: null,
      content_type: "application/json",
      graphql_query: body.graphql.query,
      graphql_variables: body.graphql.variables,
    };
  }

  if (body.mode === "binary" && body.binary) {
    return {
      mode: "binary",
      content: body.binary,
      content_type: "application/octet-stream",
    };
  }

  return null;
}

export function buildIpcSettings(settings: RequestSettings): IpcRequestSettings {
  return {
    timeout_ms: settings.timeoutMs,
    follow_redirects: settings.followRedirects,
    max_redirects: settings.maxRedirects,
    verify_ssl: settings.verifySsl,
    proxy_url: settings.proxyUrl || null,
  };
}

export function buildIpcAuth(auth: AuthConfig): IpcAuthConfig {
  return buildIpcAuthUtil(auth.type, auth.config as Record<string, unknown>);
}

export const useRequestStore = create<RequestStore>()(
  immer((set, get) => ({
  loadingTabs: {},
  responses: {},
  testResults: {},
  errors: {},
  requestDataMap: {},
  currentTabId: null,
  dirtyTabs: {},
  historyRefreshCounter: 0,
  previousResponses: {},
  downloads: {},

  setTabLoading: (tabId, loading) =>
    set((state) => {
      if (loading) {
        state.loadingTabs[tabId] = true;
      } else {
        delete state.loadingTabs[tabId];
      }
    }),

    setResponse: (tabId, response) =>
      set((state) => {
        const existing = state.responses[tabId];
        if (existing?.body) {
          state.previousResponses[tabId] = existing.body;
        }
        state.responses[tabId] = response;
        state.historyRefreshCounter++;
      }),

    setError: (tabId, error) =>
    set((state) => {
      state.errors[tabId] = error;
    }),

  clearError: (tabId) =>
    set((state) => {
      delete state.errors[tabId];
    }),

    clearResponse: (tabId) =>
      set((state) => {
        delete state.responses[tabId];
        delete state.previousResponses[tabId];
      }),

    switchTab: (tabId) =>
      set((state) => {
        state.currentTabId = tabId;
        if (tabId) {
          getOrCreateTabData(state.requestDataMap, tabId);
        }
      }),

    removeTabData: (tabId) =>
      set((state) => {
        delete state.requestDataMap[tabId];
        delete state.responses[tabId];
        delete state.testResults[tabId];
        delete state.dirtyTabs[tabId];
        delete state.errors[tabId];
        delete state.previousResponses[tabId];
      }),

    setRequestHeaders: (headers) =>
      set((state) => {
        if (state.currentTabId) {
          getOrCreateTabData(state.requestDataMap, state.currentTabId).headers = headers;
          state.dirtyTabs[state.currentTabId] = true;
        }
      }),

    setRequestParams: (params) =>
      set((state) => {
        if (state.currentTabId) {
          getOrCreateTabData(state.requestDataMap, state.currentTabId).params = params;
          state.dirtyTabs[state.currentTabId] = true;
        }
      }),

    setRequestBody: (body) =>
      set((state) => {
        if (state.currentTabId) {
          getOrCreateTabData(state.requestDataMap, state.currentTabId).body = body;
          state.dirtyTabs[state.currentTabId] = true;
        }
      }),

    setRequestAuth: (auth) =>
      set((state) => {
        if (state.currentTabId) {
          getOrCreateTabData(state.requestDataMap, state.currentTabId).auth = auth;
          state.dirtyTabs[state.currentTabId] = true;
        }
      }),

  setRequestSettings: (settings) =>
    set((state) => {
      if (state.currentTabId) {
        getOrCreateTabData(state.requestDataMap, state.currentTabId).settings = settings;
        state.dirtyTabs[state.currentTabId] = true;
      }
    }),

  setRequestScripts: (scripts) =>
    set((state) => {
      if (state.currentTabId) {
        getOrCreateTabData(state.requestDataMap, state.currentTabId).scripts = scripts;
        state.dirtyTabs[state.currentTabId] = true;
      }
    }),

  setTestResults: (tabId, results) =>
    set((state) => {
      state.testResults[tabId] = results;
    }),

    sendRequest: async (tabId, method, url) => {
      const state = get();
      if (state.loadingTabs[tabId]) return;

      set((state) => {
        state.loadingTabs[tabId] = true;
        delete state.errors[tabId];
      });

      const requestData = state.requestDataMap[tabId] || DEFAULT_REQUEST_DATA;
      const envStore = (await import("./environment-store")).useEnvironmentStore.getState();
      const settingsStore = (await import("./settings-store")).useSettingsStore.getState();

      // Merge global proxyUrl into per-request settings
      const mergedSettings = { ...requestData.settings, proxyUrl: settingsStore.proxyUrl || undefined };

      const activeTab = useTabStore.getState().tabs.find((t) => t.id === tabId);
      const requestId = activeTab?.requestId ?? tabId;
      const hierarchy = useCollectionStore.getState().resolveRequestHierarchy(requestId);

      const collectionVars = hierarchy ? getCollectionVariables(hierarchy) : {};
      const folderVars = hierarchy ? getFolderVariables(hierarchy) : {};

      const envScopeVars = envStore.activeEnvironmentId
        ? variablesToRecord(envStore.environments.find((e) => e.id === envStore.activeEnvironmentId)?.variables ?? [])
        : undefined;

      const envScopes: VariableScope = {
        global: variablesToRecord(envStore.globals),
        environment: envScopeVars,
        collection: Object.keys(collectionVars).length > 0 ? collectionVars : undefined,
        folder: Object.keys(folderVars).length > 0 ? folderVars : undefined,
      };
      const resolver = new VariableResolver(envScopes);

      const mergedHeaders = hierarchy
        ? mergeHeaders(hierarchy, requestData.headers)
        : requestData.headers;

      const effectiveAuth = hierarchy
        ? resolveAuth(hierarchy, requestData.auth)
        : requestData.auth;

      const resolvedUrl = resolver.resolve(url);
      const resolvedHeaders = mergedHeaders
        .filter((h) => !h.disabled && h.key)
        .map((h) => ({ key: h.key, value: resolver.resolve(h.value), disabled: h.disabled }));
      const resolvedParams = requestData.params
        .filter((p) => !p.disabled && p.key)
        .map((p) => ({ key: p.key, value: resolver.resolve(p.value), disabled: p.disabled }));

      const ipcConfig: IpcHttpRequestConfig = {
        id: tabId,
        method,
        url: resolvedUrl,
        headers: resolvedHeaders,
        params: resolvedParams,
        body: buildIpcBodyConfig(requestData.body, resolver),
        auth: buildIpcAuth(effectiveAuth),
        settings: buildIpcSettings(mergedSettings),
      };

      const collectionVariablesRecord = { ...collectionVars, ...folderVars };
      const folderPathNames = hierarchy?.folderPath.map((f) => f.name) ?? [];
      const collectionName = hierarchy?.collectionName;

      try {
        // Pre-request script chain
        if (hierarchy) {
          const preChain = collectPreRequestChain(hierarchy, {
            preRequest: requestData.scripts?.preRequest,
          });
          for (const entry of preChain) {
            const scriptCtx: ScriptContext = {
              request: { method, url: resolvedUrl, headers: resolvedHeaders, body: ipcConfig.body, auth: ipcConfig.auth },
              environment: envScopes.environment,
              collectionVariables: collectionVariablesRecord,
              globals: envScopes.global,
              folderPath: folderPathNames,
              collectionName,
            };
            const ok = await executePreRequestScripts(tabId, entry.code, scriptCtx, entry.source, ipcConfig, envScopes, set);
            if (!ok) return;
          }
        } else {
          const preScript = requestData.scripts?.preRequest;
          if (preScript?.trim()) {
            const scriptCtx: ScriptContext = {
              request: { method, url: resolvedUrl, headers: resolvedHeaders, body: ipcConfig.body, auth: ipcConfig.auth },
              environment: envScopes.environment,
              globals: envScopes.global,
            };
            const ok = await executePreRequestScripts(tabId, preScript, scriptCtx, "Request", ipcConfig, envScopes, set);
            if (!ok) return;
          }
        }

        markStart("request:send", { method, url });
        const response = await sendHttpRequest(ipcConfig);
        markEnd("request:send", { status: response.status, time: response.time });
      set((state) => {
        state.responses[tabId] = response;
        delete state.loadingTabs[tabId];
        state.dirtyTabs[tabId] = false;
      });
      useConsoleStore.getState().addEntry(tabId, {
        level: "info",
        message: `${method} ${resolvedUrl} → ${response.status} (${response.time}ms)`,
        source: "system",
      });
      insertHistoryEntry({
        method,
        url: resolvedUrl,
        status: response.status,
        duration: response.time,
      }).catch((e) => {
        console.error("Failed to insert history entry:", e);
      });

      // Post-response script chain
      if (hierarchy) {
        const postChain = collectPostResponseChain(hierarchy, {
          postResponse: requestData.scripts?.postResponse,
        });
        for (const entry of postChain) {
          const scriptCtx: ScriptContext = {
            request: { method, url: resolvedUrl, auth: buildIpcAuth(effectiveAuth) },
            response: { status: response.status, statusText: response.statusText, headers: response.headers, body: response.body, time: response.time },
            environment: envScopes.environment,
            collectionVariables: collectionVariablesRecord,
            globals: envScopes.global,
            folderPath: folderPathNames,
            collectionName,
          };
          await executePostResponseScripts(tabId, entry.code, scriptCtx, entry.source, envScopes, get().setTestResults);
        }
      } else {
        const postScript = requestData.scripts?.postResponse;
        if (postScript?.trim()) {
          const scriptCtx: ScriptContext = {
            request: { method, url: resolvedUrl, auth: buildIpcAuth(effectiveAuth) },
            response: { status: response.status, statusText: response.statusText, headers: response.headers, body: response.body, time: response.time },
            environment: envScopes.environment,
            globals: envScopes.global,
          };
          await executePostResponseScripts(tabId, postScript, scriptCtx, "Request", envScopes, get().setTestResults);
        }
      }

      } catch (err: unknown) {
        const handled = handleError(err);
        set((state) => {
          state.errors[tabId] = handled.description;
          delete state.loadingTabs[tabId];
        });
        useConsoleStore.getState().addEntry(tabId, {
          level: handled.variant === "error" ? "error" : "warn",
          message: `${method} ${url} → ${handled.title}: ${handled.description}`,
          source: "system",
        });
        toast({
          variant: handled.variant,
          title: handled.title,
          description: handled.description,
          duration: handled.variant === "error" ? 8000 : 4000,
          action: handled.action
            ? { label: handled.action.label, onClick: handled.action.onClick }
            : handled.retryable
              ? { label: "Retry", onClick: () => get().sendRequest(tabId, method, url) }
              : undefined,
        });
      }
    },

    cancelRequest: async (tabId) => {
      try {
        await cancelHttpRequest(tabId);
      } catch {
      }
      set((state) => {
        delete state.loadingTabs[tabId];
        state.errors[tabId] = "Request cancelled";
      });
    },

    downloadResponse: async (tabId, method, url) => {
      const state = get();
      if (state.loadingTabs[tabId]) return;

      set((state) => {
        state.loadingTabs[tabId] = true;
        delete state.errors[tabId];
      });

      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const filePath = await save({
          title: "Save Download As",
          defaultPath: "download",
        });
        if (!filePath) {
          set((s) => { delete s.loadingTabs[tabId]; });
          return;
        }

        const requestData = state.requestDataMap[tabId] || DEFAULT_REQUEST_DATA;
        const envStore = (await import("./environment-store")).useEnvironmentStore.getState();
        const settingsStore = (await import("./settings-store")).useSettingsStore.getState();
        const mergedSettings = { ...requestData.settings, proxyUrl: settingsStore.proxyUrl || undefined };

        const activeTab = useTabStore.getState().tabs.find((t) => t.id === tabId);
        const requestId = activeTab?.requestId ?? tabId;
        const hierarchy = useCollectionStore.getState().resolveRequestHierarchy(requestId);

        const collectionVars = hierarchy ? getCollectionVariables(hierarchy) : {};
        const folderVars = hierarchy ? getFolderVariables(hierarchy) : {};

        const envScopeVars = envStore.activeEnvironmentId
          ? variablesToRecord(envStore.environments.find((e) => e.id === envStore.activeEnvironmentId)?.variables ?? [])
          : undefined;

        const envScopes: VariableScope = {
          global: variablesToRecord(envStore.globals),
          environment: envScopeVars,
          collection: Object.keys(collectionVars).length > 0 ? collectionVars : undefined,
          folder: Object.keys(folderVars).length > 0 ? folderVars : undefined,
        };
        const resolver = new VariableResolver(envScopes);

        const mergedHeaders = hierarchy
          ? mergeHeaders(hierarchy, requestData.headers)
          : requestData.headers;

        const effectiveAuth = hierarchy
          ? resolveAuth(hierarchy, requestData.auth)
          : requestData.auth;

        const resolvedUrl = resolver.resolve(url);
        const resolvedHeaders = mergedHeaders
          .filter((h) => !h.disabled && h.key)
          .map((h) => ({ key: h.key, value: resolver.resolve(h.value), disabled: h.disabled }));
        const resolvedParams = requestData.params
          .filter((p) => !p.disabled && p.key)
          .map((p) => ({ key: p.key, value: resolver.resolve(p.value), disabled: p.disabled }));

        const ipcConfig: IpcHttpRequestConfig = {
          id: tabId,
          method,
          url: resolvedUrl,
          headers: resolvedHeaders,
          params: resolvedParams,
          body: buildIpcBodyConfig(requestData.body, resolver),
          auth: buildIpcAuth(effectiveAuth),
          settings: buildIpcSettings(mergedSettings),
        };

        set((s) => {
          s.downloads[tabId] = {
            requestId: tabId,
            totalBytes: 0,
            downloadedBytes: 0,
            percentage: 0,
            status: "downloading",
          };
        });

        await downloadHttpResponse(ipcConfig, filePath);

      } catch (err: unknown) {
        const handled = handleError(err);
        set((s) => {
          s.downloads[tabId] = {
            requestId: tabId,
            totalBytes: 0,
            downloadedBytes: 0,
            percentage: 0,
            status: "error",
            error: handled.description,
          };
          s.errors[tabId] = handled.description;
          delete s.loadingTabs[tabId];
        });
      }
    },

  initTabData: (tabId, data) =>
    set((state) => {
      state.requestDataMap[tabId] = {
        headers: data?.headers ?? [],
        params: data?.params ?? [],
        body: data?.body ?? null,
        auth: data?.auth ?? { ...DEFAULT_AUTH },
        settings: data?.settings ?? { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, verifySsl: true },
        scripts: data?.scripts ?? { preRequest: undefined, postResponse: undefined },
      };
    }),

  markDirty: (tabId) =>
    set((state) => {
      state.dirtyTabs[tabId] = true;
    }),

  clearDirty: (tabId) =>
    set((state) => {
      state.dirtyTabs[tabId] = false;
    }),

  isDirty: (tabId) => get().dirtyTabs[tabId] === true,
  })),
);

if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__) {
  listen<{ requestId: string; totalBytes: number; downloadedBytes: number; percentage: number }>("http-download-progress", (event) => {
    const { requestId, totalBytes, downloadedBytes, percentage } = event.payload;
    useRequestStore.setState((s) => {
      if (s.downloads[requestId]) {
        s.downloads[requestId].totalBytes = totalBytes;
        s.downloads[requestId].downloadedBytes = downloadedBytes;
        s.downloads[requestId].percentage = percentage;
      }
    });
  });

  listen<{ requestId: string; filePath: string; totalBytes: number; durationMs: number }>("http-download-complete", (event) => {
    const { requestId, filePath, totalBytes, durationMs } = event.payload;
    useRequestStore.setState((s) => {
      if (s.downloads[requestId]) {
        s.downloads[requestId].status = "complete";
        s.downloads[requestId].filePath = filePath;
        s.downloads[requestId].totalBytes = totalBytes;
        s.downloads[requestId].durationMs = durationMs;
        s.downloads[requestId].percentage = 100;
      }
      delete s.loadingTabs[requestId];
    });
  });

  listen<{ requestId: string; error: string }>("http-download-error", (event) => {
    const { requestId, error } = event.payload;
    useRequestStore.setState((s) => {
      if (s.downloads[requestId]) {
        s.downloads[requestId].status = "error";
        s.downloads[requestId].error = error;
      }
      delete s.loadingTabs[requestId];
    });
  });
}

function logScriptResult(tabId: string, source: string, result: ScriptResult, startTime: number) {
  const consoleStore = useConsoleStore.getState();
  const duration = Date.now() - startTime;
  consoleStore.addEntry(tabId, {
    level: "info",
    message: `[${source}] Script executed in ${duration}ms`,
    source: source as "pre-request" | "post-response",
  });
  for (const log of result.logs) {
    consoleStore.addEntry(tabId, {
      level: log.level === "warn" ? "warn" : log.level === "error" ? "error" : "log",
      message: log.message,
      source: source as "pre-request" | "post-response",
    });
  }
  for (const test of result.testResults) {
    consoleStore.addEntry(tabId, {
      level: test.passed ? "info" : "error",
      message: `${test.passed ? "PASS" : "FAIL"}: ${test.name}${test.error ? " — " + test.error : ""} (${test.durationMs}ms)`,
      source: source as "pre-request" | "post-response",
    });
  }
  if (result.variables.length > 0) {
    const varSummary = result.variables.map((v) => `${v.scope}.${v.key} = ${v.value}`).join(", ");
    consoleStore.addEntry(tabId, {
      level: "info",
      message: `[${source}] Variables modified: ${varSummary}`,
      source: source as "pre-request" | "post-response",
    });
  }
  if (result.error) {
    consoleStore.addEntry(tabId, {
      level: "error",
      message: `Script error: ${result.error}`,
      source: source as "pre-request" | "post-response",
    });
  }
}

function applyScriptVariables(scriptResult: ScriptResult, envScopes: VariableScope) {
  for (const v of scriptResult.variables) {
    if (v.scope === "environment" && envScopes.environment) {
      envScopes.environment[v.key] = v.value;
    } else if (v.scope === "global" && envScopes.global) {
      envScopes.global[v.key] = v.value;
    } else if (v.scope === "collection" && envScopes.collection) {
      envScopes.collection[v.key] = v.value;
    }
  }
  if (scriptResult.variables.length > 0) {
    import("./environment-store").then(({ useEnvironmentStore }) => {
      const envStore = useEnvironmentStore.getState();
      for (const v of scriptResult.variables) {
        if (v.scope === "global") {
          envStore.setGlobalVariable(v.key, v.value);
        } else if (v.scope === "environment") {
          const activeId = envStore.activeEnvironmentId;
          if (activeId) {
            const env = envStore.environments.find((e) => e.id === activeId);
            if (env) {
              const existingIdx = env.variables.findIndex((ev) => ev.key === v.key);
              if (existingIdx >= 0) {
                const updatedVars = env.variables.map((ev, i) =>
                  i === existingIdx ? { ...ev, value: v.value } : ev
                );
                envStore.updateEnvironment(activeId, { variables: updatedVars });
              } else {
                envStore.updateEnvironment(activeId, {
                  variables: [...env.variables, { key: v.key, value: v.value, enabled: true }],
                });
              }
            }
          }
        }
      }
    }).catch((e) => console.error("Failed to import environment store for script variables:", e));
  }
}
