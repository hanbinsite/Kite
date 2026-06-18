import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  sendHttpRequest,
  insertHistoryEntry,
} from "@api-client/core/http";
import {
  VariableResolver,
  variablesToRecord,
  markStart,
  markEnd,
  getCollectionVariables,
  getFolderVariables,
  mergeHeaders,
  resolveAuth,
  collectPreRequestChain,
  collectPostResponseChain,
} from "@api-client/core";
import type { VariableScope } from "@api-client/core";
import { executeScript, type ScriptContext, type TestResult } from "@api-client/core/script";
import type {
  HttpResponse,
  Header,
  QueryParam,
  BodyConfig,
  RequestSettings,
  AuthConfig,
} from "@api-client/types";
import type {
  IpcHttpRequestConfig,
} from "@api-client/core/http";
import { useCollectionStore } from "./collection-store";
import { buildIpcBodyConfig, buildIpcSettings, buildIpcAuth } from "./request-store";

export interface RunnerRequestConfig {
  id: string;
  method: string;
  name: string;
  url: string;
  headers: Header[];
  params: QueryParam[];
  body: BodyConfig | null;
  auth: AuthConfig;
  settings: RequestSettings;
  scripts: { preRequest?: string; postResponse?: string };
}

export interface RunnerRequestResult {
  requestName: string;
  method: string;
  url: string;
  status: "success" | "failure" | "skipped";
  statusCode: number;
  time: number;
  size: number;
  testPassCount: number;
  testFailCount: number;
  error?: string;
  response?: HttpResponse;
  testResults: TestResult[];
}

export interface RunnerIterationResult {
  iteration: number;
  requests: RunnerRequestResult[];
  variables: Record<string, string>;
}

export interface RunnerRunResult {
  id: string;
  collectionId: string;
  collectionName: string;
  startTime: number;
  endTime: number;
  duration: number;
  totalRequests: number;
  passedRequests: number;
  failedRequests: number;
  iterations: RunnerIterationResult[];
}

export interface RunnerConfig {
  collectionId: string;
  collectionName: string;
  environmentId: string | null;
  iterationCount: number;
  delayMs: number;
  persistVariables: boolean;
  requests: RunnerRequestConfig[];
  dataRows?: Record<string, string>[];
  preRunScript?: string;
  postRunScript?: string;
}

export type RunnerStatus = "idle" | "running" | "completed" | "cancelled" | "error";

export interface RunnerState {
  status: RunnerStatus;
  config: RunnerConfig | null;
  result: RunnerRunResult | null;
  currentIteration: number;
  currentRequestIndex: number;
  abortController: AbortController | null;
  selectedResultDetail: {
    iteration: number;
    requestIndex: number;
  } | null;
}

export interface RunnerActions {
  startRun: (config: RunnerConfig) => void;
  cancelRun: () => void;
  resetRunner: () => void;
  setSelectedResultDetail: (detail: { iteration: number; requestIndex: number } | null) => void;
}

export type RunnerStore = RunnerState & RunnerActions;

const DEFAULT_SETTINGS: RequestSettings = {
  timeoutMs: 30000,
  followRedirects: true,
  maxRedirects: 10,
  verifySsl: true,
};

export const useRunnerStore = create<RunnerStore>()(
  immer((set, get) => ({
    status: "idle",
    config: null,
    result: null,
    currentIteration: 0,
    currentRequestIndex: 0,
    abortController: null,
    selectedResultDetail: null,

    startRun: (config) => {
      const abortController = new AbortController();
      const runId = `run-${Date.now()}`;
      const result: RunnerRunResult = {
        id: runId,
        collectionId: config.collectionId,
        collectionName: config.collectionName,
        startTime: Date.now(),
        endTime: 0,
        duration: 0,
        totalRequests: config.requests.length * (config.dataRows?.length || config.iterationCount),
        passedRequests: 0,
        failedRequests: 0,
        iterations: [],
      };

      set((state) => {
        state.status = "running";
        state.config = config;
        state.result = result;
        state.currentIteration = 0;
        state.currentRequestIndex = 0;
        state.abortController = abortController;
        state.selectedResultDetail = null;
      });

      (async () => {
        const envStore = (await import("./environment-store")).useEnvironmentStore.getState();
        let persistedVars: Record<string, string> = {};

        const hasDataRows = config.dataRows && config.dataRows.length > 0;
        const totalIterations = hasDataRows ? config.dataRows!.length : config.iterationCount;

        if (config.preRunScript) {
          try {
            const preRunContext: ScriptContext = {
              environment: { ...variablesToRecord(envStore.globals), ...(config.environmentId ? variablesToRecord(envStore.environments.find((e) => e.id === config.environmentId)?.variables ?? []) : {}) },
              globals: variablesToRecord(envStore.globals),
            };
            await executeScript({ code: config.preRunScript, context: preRunContext });
          } catch (e) {
            console.error("Pre-run script error:", e);
            set((state) => {
              if (state.result) {
                state.result.failedRequests = state.result.totalRequests;
              }
              state.status = "error";
            });
          }
        }

        for (let i = 0; i < totalIterations; i++) {
          if (abortController.signal.aborted) break;

          set((state) => { state.currentIteration = i; state.currentRequestIndex = 0; });

          const iterationResult: RunnerIterationResult = {
            iteration: i,
            requests: [],
            variables: { ...persistedVars, ...(hasDataRows ? config.dataRows![i] ?? {} : {}) },
          };

          const dataRowVars = hasDataRows ? (config.dataRows![i] ?? {}) : {};

          const envScopes: VariableScope = {
            global: variablesToRecord(envStore.globals),
            environment: config.environmentId
              ? variablesToRecord(envStore.environments.find((e) => e.id === config.environmentId)?.variables ?? [])
              : undefined,
          };

          for (let r = 0; r < config.requests.length; r++) {
            if (abortController.signal.aborted) break;

            set((state) => { state.currentRequestIndex = r; });

            const req = config.requests[r];
            if (!req) continue;

            const hierarchy = useCollectionStore.getState().resolveRequestHierarchy(req.id);
            const collectionVars = hierarchy ? getCollectionVariables(hierarchy) : {};
            const folderVars = hierarchy ? getFolderVariables(hierarchy) : {};

            const collectionVariablesRecord = { ...collectionVars, ...folderVars };
            const folderPathNames = hierarchy?.folderPath.map((f) => f.name) ?? [];
            const collectionName = hierarchy?.collectionName;

            const mergedHeaders = hierarchy
              ? mergeHeaders(hierarchy, req.headers)
              : req.headers;

            const effectiveAuth = hierarchy
              ? resolveAuth(hierarchy, req.auth)
              : req.auth;

            const resolver = new VariableResolver({
              ...envScopes,
              environment: { ...(envScopes.environment ?? {}), ...persistedVars, ...dataRowVars },
              collection: Object.keys(collectionVars).length > 0 ? collectionVars : undefined,
              folder: Object.keys(folderVars).length > 0 ? folderVars : undefined,
            });

            const resolvedUrl = resolver.resolve(req.url);
            const resolvedHeaders = mergedHeaders
              .filter((h) => !h.disabled && h.key)
              .map((h) => ({ key: h.key, value: resolver.resolve(h.value), disabled: h.disabled }));
            const resolvedParams = req.params
              .filter((p) => !p.disabled && p.key)
              .map((p) => ({ key: p.key, value: resolver.resolve(p.value), disabled: p.disabled }));

            const ipcConfig: IpcHttpRequestConfig = {
              id: `runner-${runId}-${i}-${r}`,
              method: req.method,
              url: resolvedUrl,
              headers: resolvedHeaders,
              params: resolvedParams,
              body: buildIpcBodyConfig(req.body, resolver),
              auth: buildIpcAuth(effectiveAuth),
              settings: buildIpcSettings(req.settings ?? DEFAULT_SETTINGS),
            };

            const requestResult: RunnerRequestResult = {
              requestName: req.name,
              method: req.method,
              url: resolvedUrl,
              status: "success",
              statusCode: 0,
              time: 0,
              size: 0,
              testPassCount: 0,
              testFailCount: 0,
              testResults: [],
            };

            try {
              if (hierarchy) {
                const preChain = collectPreRequestChain(hierarchy, {
                  preRequest: req.scripts?.preRequest,
                });
                for (const entry of preChain) {
                  const scriptCtx: ScriptContext = {
                    request: { method: req.method, url: resolvedUrl, headers: resolvedHeaders, body: ipcConfig.body, auth: ipcConfig.auth },
                    environment: { ...(envScopes.environment ?? {}), ...persistedVars },
                    collectionVariables: collectionVariablesRecord,
                    globals: envScopes.global,
                    folderPath: folderPathNames,
                    collectionName,
                  };
                  try {
                    const scriptResult = await executeScript({ code: entry.code, context: scriptCtx });
                    for (const v of scriptResult.variables) {
                      if (v.scope === "environment") persistedVars[v.key] = v.value;
                    }
                  } catch {
                    requestResult.status = "failure";
                    requestResult.error = `Script Error [${entry.source}]: pre-request failed`;
                    break;
                  }
                }
              } else if (req.scripts?.preRequest?.trim()) {
                const scriptCtx: ScriptContext = {
                  request: { method: req.method, url: resolvedUrl, headers: resolvedHeaders, body: ipcConfig.body, auth: ipcConfig.auth },
                  environment: { ...(envScopes.environment ?? {}), ...persistedVars },
                  globals: envScopes.global,
                };
                try {
                  const scriptResult = await executeScript({ code: req.scripts.preRequest, context: scriptCtx });
                  for (const v of scriptResult.variables) {
                    if (v.scope === "environment") persistedVars[v.key] = v.value;
                  }
                } catch { /* pre-script error doesn't stop execution */ }
              }

              markStart("runner:request", { method: req.method, url: resolvedUrl });
              const response = await sendHttpRequest(ipcConfig);
              markEnd("runner:request", { status: response.status, time: response.time });

              requestResult.statusCode = response.status;
              requestResult.time = response.time;
              requestResult.size = response.bodySize;
              requestResult.response = response;
              requestResult.status = response.status >= 400 ? "failure" : "success";

              insertHistoryEntry({ method: req.method, url: resolvedUrl, status: response.status, duration: response.time }).catch((e) => console.error('Failed to insert history entry:', e));

              if (hierarchy) {
                const postChain = collectPostResponseChain(hierarchy, {
                  postResponse: req.scripts?.postResponse,
                });
                for (const entry of postChain) {
                  const scriptCtx: ScriptContext = {
                    request: { method: req.method, url: resolvedUrl, auth: ipcConfig.auth },
                    response: { status: response.status, statusText: response.statusText, headers: response.headers, body: response.body, time: response.time },
                    environment: { ...(envScopes.environment ?? {}), ...persistedVars },
                    collectionVariables: collectionVariablesRecord,
                    globals: envScopes.global,
                    folderPath: folderPathNames,
                    collectionName,
                  };
                  try {
                    const scriptResult = await executeScript({ code: entry.code, context: scriptCtx });
                    requestResult.testResults = scriptResult.testResults;
                    requestResult.testPassCount = scriptResult.testResults.filter((t) => t.passed).length;
                    requestResult.testFailCount = scriptResult.testResults.filter((t) => !t.passed).length;
                    for (const v of scriptResult.variables) {
                      if (v.scope === "environment") persistedVars[v.key] = v.value;
                    }
                    if (scriptResult.testResults.some((t) => !t.passed)) {
                      requestResult.status = "failure";
                    }
                  } catch (scriptErr) {
                    requestResult.status = "failure";
                    requestResult.error = `Script error [${entry.source}]: ${scriptErr}`;
                  }
                }
              } else if (req.scripts?.postResponse?.trim()) {
                const scriptCtx: ScriptContext = {
                  request: { method: req.method, url: resolvedUrl, auth: ipcConfig.auth },
                  response: { status: response.status, statusText: response.statusText, headers: response.headers, body: response.body, time: response.time },
                  environment: { ...(envScopes.environment ?? {}), ...persistedVars },
                  globals: envScopes.global,
                };
                try {
                  const scriptResult = await executeScript({ code: req.scripts.postResponse, context: scriptCtx });
                  requestResult.testResults = scriptResult.testResults;
                  requestResult.testPassCount = scriptResult.testResults.filter((t) => t.passed).length;
                  requestResult.testFailCount = scriptResult.testResults.filter((t) => !t.passed).length;
                  for (const v of scriptResult.variables) {
                    if (v.scope === "environment") {
                      persistedVars[v.key] = v.value;
                    }
                  }
                  if (scriptResult.testResults.some((t) => !t.passed)) {
                    requestResult.status = "failure";
                  }
                } catch (scriptErr) {
                  requestResult.status = "failure";
                  requestResult.error = `Script error: ${scriptErr}`;
                }
              }
            } catch (err: unknown) {
              requestResult.status = "failure";
              requestResult.error = err instanceof Error ? err.message : String(err);
            }

            iterationResult.requests.push(requestResult);

            set((state) => {
              if (state.result) {
                if (!state.result.iterations[i]) {
                  state.result.iterations[i] = iterationResult;
                }
                state.result.passedRequests = state.result.iterations.flatMap((it) => it.requests).filter((r) => r.status === "success").length;
                state.result.failedRequests = state.result.iterations.flatMap((it) => it.requests).filter((r) => r.status === "failure").length;
              }
            });

            if (config.delayMs > 0 && r < config.requests.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, config.delayMs));
            }
          }

          iterationResult.variables = { ...persistedVars };

          set((state) => {
            if (state.result) {
              state.result.iterations[i] = iterationResult;
            }
          });

          if (config.delayMs > 0 && i < config.iterationCount - 1) {
            await new Promise((resolve) => setTimeout(resolve, config.delayMs));
          }
        }

        if (config.postRunScript) {
          try {
            const postRunContext: ScriptContext = {
              environment: { ...variablesToRecord(envStore.globals), ...persistedVars },
              globals: variablesToRecord(envStore.globals),
            };
            await executeScript({ code: config.postRunScript, context: postRunContext });
          } catch (e) {
            console.error("Post-run script error:", e);
            set((state) => {
              if (state.result) {
                state.result.failedRequests = state.result.totalRequests;
              }
              state.status = "error";
            });
          }
        }

        set((state) => {
          state.status = abortController.signal.aborted ? "cancelled" : "completed";
          state.currentIteration = config.iterationCount;
          state.currentRequestIndex = config.requests.length;
          if (state.result) {
            state.result.endTime = Date.now();
            state.result.duration = state.result.endTime - state.result.startTime;
          }
          state.abortController = null;
        });
      })().catch((err: unknown) => {
        set((state) => {
          state.status = "error";
          state.abortController = null;
          if (state.result) {
            state.result.endTime = Date.now();
            state.result.duration = state.result.endTime - state.result.startTime;
          }
        });
        console.error("Runner execution failed:", err);
      });
    },

    cancelRun: () => {
      const { abortController } = get();
      abortController?.abort();
      set((state) => {
        state.status = "cancelled";
        state.abortController = null;
        if (state.result) {
          state.result.endTime = Date.now();
          state.result.duration = state.result.endTime - state.result.startTime;
        }
      });
    },

    resetRunner: () => {
      set((state) => {
        state.status = "idle";
        state.config = null;
        state.result = null;
        state.currentIteration = 0;
        state.currentRequestIndex = 0;
        state.abortController = null;
        state.selectedResultDetail = null;
      });
    },

    setSelectedResultDetail: (detail) => {
      set((state) => { state.selectedResultDetail = detail; });
    },
  })),
);
