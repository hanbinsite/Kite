import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { sendHttpRequest, cancelHttpRequest, insertHistoryEntry } from "@api-client/core/http";
import { markStart, markEnd, VariableResolver, variablesToRecord } from "@api-client/core";
import type { VariableScope } from "@api-client/core";
import type {
  IpcHttpRequestConfig,
  IpcBodyConfig,
  IpcRequestSettings,
  IpcAuthConfig,
} from "@api-client/core/http";
import type {
  HttpResponse,
  HttpMethod,
  Header,
  QueryParam,
  BodyConfig,
  RequestSettings,
  AuthConfig,
} from "@api-client/types";

export interface RequestData {
  headers: Header[];
  params: QueryParam[];
  body: BodyConfig | null;
  auth: AuthConfig;
  settings: RequestSettings;
}

export interface RequestState {
  isLoading: boolean;
  responses: Record<string, HttpResponse>;
  error: string | null;
  requestDataMap: Record<string, RequestData>;
  currentTabId: string | null;
}

export interface RequestActions {
  setLoading: (loading: boolean) => void;
  setResponse: (tabId: string, response: HttpResponse) => void;
  setError: (error: string | null) => void;
  clearResponse: (tabId: string) => void;
  switchTab: (tabId: string | null) => void;
  removeTabData: (tabId: string) => void;
  setRequestHeaders: (headers: Header[]) => void;
  setRequestParams: (params: QueryParam[]) => void;
  setRequestBody: (body: BodyConfig | null) => void;
  setRequestAuth: (auth: AuthConfig) => void;
  setRequestSettings: (settings: RequestSettings) => void;
  sendRequest: (tabId: string, method: HttpMethod, url: string) => Promise<void>;
  cancelRequest: (tabId: string) => Promise<void>;
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
};

function getOrCreateTabData(map: Record<string, RequestData>, tabId: string): RequestData {
  if (!map[tabId]) {
    map[tabId] = {
      headers: [],
      params: [],
      body: null,
      auth: { ...DEFAULT_AUTH },
      settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, verifySsl: true },
    };
  }
  return map[tabId];
}

function buildIpcBodyConfig(body: BodyConfig | null, resolver?: VariableResolver): IpcBodyConfig | null {
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

function buildIpcSettings(settings: RequestSettings): IpcRequestSettings {
  return {
    timeout_ms: settings.timeoutMs,
    follow_redirects: settings.followRedirects,
    max_redirects: settings.maxRedirects,
    verify_ssl: settings.verifySsl,
  };
}

function buildIpcAuth(auth: AuthConfig): IpcAuthConfig {
  return {
    type: auth.type,
    config: auth.config as Record<string, unknown>,
  };
}

export const useRequestStore = create<RequestStore>()(
  immer((set, get) => ({
    isLoading: false,
    responses: {},
    error: null,
    requestDataMap: {},
    currentTabId: null,

    setLoading: (loading) => set({ isLoading: loading }),

    setResponse: (tabId, response) =>
      set((state) => {
        state.responses[tabId] = response;
      }),

    setError: (error) => set({ error }),

    clearResponse: (tabId) =>
      set((state) => {
        delete state.responses[tabId];
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
      }),

    setRequestHeaders: (headers) =>
      set((state) => {
        if (state.currentTabId) {
          getOrCreateTabData(state.requestDataMap, state.currentTabId).headers = headers;
        }
      }),

    setRequestParams: (params) =>
      set((state) => {
        if (state.currentTabId) {
          getOrCreateTabData(state.requestDataMap, state.currentTabId).params = params;
        }
      }),

    setRequestBody: (body) =>
      set((state) => {
        if (state.currentTabId) {
          getOrCreateTabData(state.requestDataMap, state.currentTabId).body = body;
        }
      }),

    setRequestAuth: (auth) =>
      set((state) => {
        if (state.currentTabId) {
          getOrCreateTabData(state.requestDataMap, state.currentTabId).auth = auth;
        }
      }),

    setRequestSettings: (settings) =>
      set((state) => {
        if (state.currentTabId) {
          getOrCreateTabData(state.requestDataMap, state.currentTabId).settings = settings;
        }
      }),

    sendRequest: async (tabId, method, url) => {
      const state = get();
      if (state.isLoading) return;

      set({ isLoading: true, error: null });

      const requestData = state.requestDataMap[tabId] || DEFAULT_REQUEST_DATA;

      const envStore = (await import("./environment-store")).useEnvironmentStore.getState();
      const envScopes: VariableScope = {
        global: variablesToRecord(envStore.globals),
        environment: envStore.activeEnvironmentId
          ? variablesToRecord(envStore.environments.find((e) => e.id === envStore.activeEnvironmentId)?.variables ?? [])
          : undefined,
      };
      const resolver = new VariableResolver(envScopes);

      const resolvedUrl = resolver.resolve(url);
      const resolvedHeaders = requestData.headers
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
        auth: buildIpcAuth(requestData.auth),
        settings: buildIpcSettings(requestData.settings),
      };

      try {
        markStart("request:send", { method, url });
        const response = await sendHttpRequest(ipcConfig);
        markEnd("request:send", { status: response.status, time: response.time });
        set((state) => {
          state.responses[tabId] = response;
          state.isLoading = false;
        });
        insertHistoryEntry({
          method,
          url: resolvedUrl,
          status: response.status,
          duration: response.time,
        }).catch(() => {});
      } catch (err: unknown) {
        const errorDetail =
          typeof err === "object" && err !== null && "detail" in err
            ? (err as { detail: string }).detail
            : typeof err === "string"
              ? err
              : "Request failed";
        set((state) => {
          state.error = errorDetail;
          state.isLoading = false;
        });
      }
    },

    cancelRequest: async (tabId) => {
      try {
        await cancelHttpRequest(tabId);
      } catch {
        // ignore cancellation errors
      }
      set((state) => {
        state.isLoading = false;
        state.error = "Request cancelled";
      });
    },
  })),
);
