import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { sendHttpRequest, cancelHttpRequest, insertHistoryEntry } from "@api-client/core/http";
import { markStart, markEnd } from "@api-client/core";
import type { IpcHttpRequestConfig, IpcBodyConfig, IpcRequestSettings } from "@api-client/core/http";
import type {
  HttpResponse,
  HttpMethod,
  Header,
  QueryParam,
  BodyConfig,
  RequestSettings,
} from "@api-client/types";

export interface RequestData {
  headers: Header[];
  params: QueryParam[];
  body: BodyConfig | null;
  settings: RequestSettings;
}

export interface RequestState {
  isLoading: boolean;
  responses: Record<string, HttpResponse>;
  error: string | null;
  activeRequestData: RequestData;
}

export interface RequestActions {
  setLoading: (loading: boolean) => void;
  setResponse: (tabId: string, response: HttpResponse) => void;
  setError: (error: string | null) => void;
  clearResponse: (tabId: string) => void;
  setRequestHeaders: (headers: Header[]) => void;
  setRequestParams: (params: QueryParam[]) => void;
  setRequestBody: (body: BodyConfig | null) => void;
  setRequestSettings: (settings: RequestSettings) => void;
  sendRequest: (tabId: string, method: HttpMethod, url: string) => Promise<void>;
  cancelRequest: (tabId: string) => Promise<void>;
}

export type RequestStore = RequestState & RequestActions;

const DEFAULT_REQUEST_DATA: RequestData = {
  headers: [],
  params: [],
  body: null,
  settings: {
    timeoutMs: 30000,
    followRedirects: true,
    verifySsl: true,
  },
};

function buildIpcBodyConfig(body: BodyConfig | null): IpcBodyConfig | null {
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
    return {
      mode: "raw",
      content: body.raw.content,
      content_type: languageToContentType[body.raw.language] ?? "text/plain",
    };
  }

  if (body.mode === "urlencoded" && body.urlencoded) {
    const pairs = body.urlencoded
      .filter((p) => !p.disabled && p.key)
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join("&");
    return {
      mode: "urlencoded",
      content: pairs,
      content_type: "application/x-www-form-urlencoded",
    };
  }

  if (body.mode === "formdata" && body.formdata) {
    const pairs = body.formdata
      .filter((p) => !p.disabled && p.key && p.type === "text")
      .map((p) => `${p.key}=${p.value}`)
      .join("&");
    return {
      mode: "formdata",
      content: pairs,
      content_type: "multipart/form-data",
    };
  }

  if (body.mode === "graphql" && body.graphql) {
    const payload = JSON.stringify({
      query: body.graphql.query,
      variables: body.graphql.variables ? JSON.parse(body.graphql.variables) : {},
      operationName: body.graphql.operationName || undefined,
    });
    return {
      mode: "graphql",
      content: payload,
      content_type: "application/json",
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
    verify_ssl: settings.verifySsl,
  };
}

export const useRequestStore = create<RequestStore>()(
  immer((set, get) => ({
    isLoading: false,
    responses: {},
    error: null,
    activeRequestData: DEFAULT_REQUEST_DATA,

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

    setRequestHeaders: (headers) =>
      set((state) => {
        state.activeRequestData.headers = headers;
      }),

    setRequestParams: (params) =>
      set((state) => {
        state.activeRequestData.params = params;
      }),

    setRequestBody: (body) =>
      set((state) => {
        state.activeRequestData.body = body;
      }),

    setRequestSettings: (settings) =>
      set((state) => {
        state.activeRequestData.settings = settings;
      }),

    sendRequest: async (tabId, method, url) => {
      const state = get();
      if (state.isLoading) return;

      set({ isLoading: true, error: null });

      const requestData = state.activeRequestData;
      const ipcConfig: IpcHttpRequestConfig = {
        id: tabId,
        method,
        url,
        headers: requestData.headers
          .filter((h) => !h.disabled && h.key)
          .map((h) => ({ key: h.key, value: h.value, disabled: h.disabled })),
        params: requestData.params
          .filter((p) => !p.disabled && p.key)
          .map((p) => ({ key: p.key, value: p.value, disabled: p.disabled })),
        body: buildIpcBodyConfig(requestData.body),
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
          url,
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