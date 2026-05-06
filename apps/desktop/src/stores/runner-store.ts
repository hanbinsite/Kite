import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  sendHttpRequest,
  buildIpcAuth as buildIpcAuthUtil,
  insertHistoryEntry,
} from "@api-client/core/http";
import {
  VariableResolver,
  variablesToRecord,
  markStart,
  markEnd,
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
  IpcBodyConfig,
  IpcRequestSettings,
  IpcAuthConfig,
} from "@api-client/core/http";

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
}

export type RunnerStatus = "idle" | "running" | "completed" | "cancelled";

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
    return { mode: "raw", content, content_type: languageToContentType[body.raw.language] ?? "text/plain" };
  }
  if (body.mode === "urlencoded" && body.urlencoded) {
    return {
      mode: "urlencoded",
      content: null,
      content_type: "application/x-www-form-urlencoded",
      urlencoded: body.urlencoded.filter((p) => !p.disabled && p.key).map((p) => ({ key: p.key, value: p.value, disabled: p.disabled })),
    };
  }
  if (body.mode === "formdata" && body.formdata) {
    return {
      mode: "formdata",
      content: null,
      content_type: "multipart/form-data",
      formdata: body.formdata.filter((p) => !p.disabled && p.key).map((p) => ({ key: p.key, value: p.value, param_type: p.type, disabled: p.disabled, content_type: p.contentType })),
    };
  }
  if (body.mode === "graphql" && body.graphql) {
    return { mode: "graphql", content: null, content_type: "application/json", graphql_query: body.graphql.query, graphql_variables: body.graphql.variables };
  }
  if (body.mode === "binary" && body.binary) {
    return { mode: "binary", content: body.binary, content_type: "application/octet-stream" };
  }
  return null;
}

function buildIpcSettings(settings: RequestSettings): IpcRequestSettings {
  return { timeout_ms: settings.timeoutMs, follow_redirects: settings.followRedirects, max_redirects: settings.maxRedirects, verify_ssl: settings.verifySsl };
}

function buildIpcAuth(auth: AuthConfig): IpcAuthConfig {
  return buildIpcAuthUtil(auth.type, auth.config as Record<string, unknown>);
}

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
        totalRequests: config.requests.length * config.iterationCount,
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

        for (let i = 0; i < config.iterationCount; i++) {
          if (abortController.signal.aborted) break;

          set((state) => { state.currentIteration = i; state.currentRequestIndex = 0; });

          const iterationResult: RunnerIterationResult = {
            iteration: i,
            requests: [],
            variables: { ...persistedVars },
          };

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
            const resolver = new VariableResolver({
              ...envScopes,
              environment: { ...(envScopes.environment ?? {}), ...persistedVars },
            });

            const resolvedUrl = resolver.resolve(req.url);
            const resolvedHeaders = req.headers
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
              auth: buildIpcAuth(req.auth),
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
              if (req.scripts?.preRequest?.trim()) {
                const scriptCtx: ScriptContext = {
                  request: { method: req.method, url: resolvedUrl, headers: resolvedHeaders, body: ipcConfig.body },
                  environment: { ...(envScopes.environment ?? {}), ...persistedVars },
                  globals: envScopes.global,
                };
                try {
                  const scriptResult = await executeScript({ code: req.scripts.preRequest, context: scriptCtx });
                  for (const v of scriptResult.variables) {
                    if (v.scope === "environment") {
                      persistedVars[v.key] = v.value;
                    }
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

              insertHistoryEntry({ method: req.method, url: resolvedUrl, status: response.status, duration: response.time }).catch(() => {});

              if (req.scripts?.postResponse?.trim()) {
                const scriptCtx: ScriptContext = {
                  request: { method: req.method, url: resolvedUrl },
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
      })();
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
