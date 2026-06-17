import { describe, it, expect, beforeEach } from "vitest";
import { useRequestStore, buildIpcBodyConfig, buildIpcSettings, buildIpcAuth, DEFAULT_REQUEST_DATA } from "./request-store";
import { VariableResolver } from "@api-client/core";
import type { VariableScope } from "@api-client/core";
import type { BodyConfig, RequestSettings, AuthConfig, Header, QueryParam, HttpResponse } from "@api-client/types";

function makeResponse(overrides?: Partial<HttpResponse>): HttpResponse {
  return {
    id: "resp-1",
    requestId: "tab-1",
    status: 200,
    statusText: "OK",
    headers: [{ key: "Content-Type", value: "application/json" }],
    body: '{"data":"test"}',
    bodySize: 100,
    time: 42,
    contentType: "application/json",
    ...overrides,
  };
}

describe("request-store", () => {
  beforeEach(() => {
    useRequestStore.setState({
      loadingTabs: {},
      responses: {},
      testResults: {},
      errors: {},
      requestDataMap: {},
      currentTabId: null,
      dirtyTabs: {},
      historyRefreshCounter: 0,
    });
  });

  // === buildIpcBodyConfig ===
  describe("buildIpcBodyConfig", () => {
    it("returns null for null body", () => {
      expect(buildIpcBodyConfig(null)).toBeNull();
    });

    it("returns null for none mode", () => {
      const body: BodyConfig = { mode: "none" };
      expect(buildIpcBodyConfig(body)).toBeNull();
    });

    it("builds raw body with json language", () => {
      const body: BodyConfig = { mode: "raw", raw: { content: '{"key":"value"}', language: "json" } };
      const result = buildIpcBodyConfig(body);
      expect(result!.mode).toBe("raw");
      expect(result!.content).toBe('{"key":"value"}');
      expect(result!.content_type).toBe("application/json");
    });

    it("builds raw body with javascript language", () => {
      const body: BodyConfig = { mode: "raw", raw: { content: "console.log('hi')", language: "javascript" } };
      const result = buildIpcBodyConfig(body);
      expect(result!.content_type).toBe("application/javascript");
    });

    it("builds raw body with text language", () => {
      const body: BodyConfig = { mode: "raw", raw: { content: "plain", language: "text" } };
      const result = buildIpcBodyConfig(body);
      expect(result!.content_type).toBe("text/plain");
    });

    it("builds raw body with html language", () => {
      const body: BodyConfig = { mode: "raw", raw: { content: "<html>", language: "html" } };
      const result = buildIpcBodyConfig(body);
      expect(result!.content_type).toBe("text/html");
    });

    it("builds raw body with xml language", () => {
      const body: BodyConfig = { mode: "raw", raw: { content: "<root/>", language: "xml" } };
      const result = buildIpcBodyConfig(body);
      expect(result!.content_type).toBe("application/xml");
    });

    it("resolves variables in raw body content", () => {
      const scopes: VariableScope = { global: { BASE: "https://api.example.com" } };
      const resolver = new VariableResolver(scopes);
      const body: BodyConfig = { mode: "raw", raw: { content: "{{BASE}}/users", language: "text" } };
      const result = buildIpcBodyConfig(body, resolver);
      expect(result!.content).toBe("https://api.example.com/users");
    });

    it("builds urlencoded body", () => {
      const body: BodyConfig = {
        mode: "urlencoded",
        urlencoded: [
          { key: "name", value: "test", disabled: false },
          { key: "age", value: "25", disabled: false },
        ],
      };
      const result = buildIpcBodyConfig(body);
      expect(result!.mode).toBe("urlencoded");
      expect(result!.content_type).toBe("application/x-www-form-urlencoded");
      expect(result!.urlencoded).toHaveLength(2);
    });

    it("filters disabled urlencoded params", () => {
      const body: BodyConfig = {
        mode: "urlencoded",
        urlencoded: [
          { key: "active", value: "1", disabled: false },
          { key: "inactive", value: "0", disabled: true },
        ],
      };
      const result = buildIpcBodyConfig(body);
      expect(result!.urlencoded).toHaveLength(1);
      expect(result!.urlencoded![0]!.key).toBe("active");
    });

    it("builds formdata body", () => {
      const body: BodyConfig = {
        mode: "formdata",
        formdata: [
          { key: "file", value: "data.txt", type: "file", disabled: false, contentType: "text/plain" },
          { key: "desc", value: "test file", type: "text", disabled: false, contentType: undefined },
        ],
      };
      const result = buildIpcBodyConfig(body);
      expect(result!.mode).toBe("formdata");
      expect(result!.formdata).toHaveLength(2);
    });

    it("builds graphql body", () => {
      const body: BodyConfig = {
        mode: "graphql",
        graphql: { query: "query { users { id name } }", variables: '{"limit":10}' },
      };
      const result = buildIpcBodyConfig(body);
      expect(result!.mode).toBe("graphql");
      expect(result!.graphql_query).toBe("query { users { id name } }");
      expect(result!.graphql_variables).toBe('{"limit":10}');
    });

    it("builds binary body", () => {
      const body: BodyConfig = { mode: "binary", binary: "base64data" };
      const result = buildIpcBodyConfig(body);
      expect(result!.mode).toBe("binary");
      expect(result!.content).toBe("base64data");
      expect(result!.content_type).toBe("application/octet-stream");
    });

    it("returns null for raw body without raw content", () => {
      const body: BodyConfig = { mode: "raw" };
      expect(buildIpcBodyConfig(body)).toBeNull();
    });
  });

  // === buildIpcSettings ===
  describe("buildIpcSettings", () => {
    it("converts RequestSettings to IpcRequestSettings", () => {
      const settings: RequestSettings = {
        timeoutMs: 5000,
        followRedirects: false,
        maxRedirects: 5,
        verifySsl: false,
        proxyUrl: "http://proxy:8080",
      };
      const result = buildIpcSettings(settings);
      expect(result.timeout_ms).toBe(5000);
      expect(result.follow_redirects).toBe(false);
      expect(result.max_redirects).toBe(5);
      expect(result.verify_ssl).toBe(false);
      expect(result.proxy_url).toBe("http://proxy:8080");
    });

    it("defaults proxy_url to null", () => {
      const settings: RequestSettings = {
        timeoutMs: 30000,
        followRedirects: true,
        maxRedirects: 10,
        verifySsl: true,
      };
      const result = buildIpcSettings(settings);
      expect(result.proxy_url).toBeNull();
    });
  });

  // === buildIpcAuth ===
  describe("buildIpcAuth", () => {
    it("builds none auth", () => {
      const auth: AuthConfig = { type: "none", config: {} };
      const result = buildIpcAuth(auth);
      expect(result.type).toBe("none");
    });

    it("builds bearer auth", () => {
      const auth: AuthConfig = { type: "bearer", config: { token: "tok123" } };
      const result = buildIpcAuth(auth);
      expect(result.type).toBe("bearer");
      expect((result.config as Record<string, unknown>).token).toBe("tok123");
    });

    it("builds basic auth", () => {
      const auth: AuthConfig = { type: "basic", config: { username: "admin", password: "secret" } };
      const result = buildIpcAuth(auth);
      expect(result.type).toBe("basic");
      expect((result.config as Record<string, unknown>).username).toBe("admin");
    });

    it("builds apikey auth", () => {
      const auth: AuthConfig = { type: "apikey", config: { key: "X-API-Key", value: "key123", addTo: "header" } };
      const result = buildIpcAuth(auth);
      expect(result.type).toBe("apikey");
    });
  });

  // === Store state mutations ===
  describe("store state", () => {
    it("starts with empty loadingTabs", () => {
      expect(useRequestStore.getState().loadingTabs).toEqual({});
    });

    it("starts with empty responses", () => {
      expect(useRequestStore.getState().responses).toEqual({});
    });

    it("setTabLoading adds loading state", () => {
      useRequestStore.getState().setTabLoading("tab-1", true);
      expect(useRequestStore.getState().loadingTabs["tab-1"]).toBe(true);
    });

    it("setTabLoading false removes loading state", () => {
      useRequestStore.getState().setTabLoading("tab-1", true);
      useRequestStore.getState().setTabLoading("tab-1", false);
      expect(useRequestStore.getState().loadingTabs["tab-1"]).toBeUndefined();
    });

    it("setResponse stores response and increments historyRefreshCounter", () => {
      const before = useRequestStore.getState().historyRefreshCounter;
      useRequestStore.getState().setResponse("tab-1", makeResponse());
      expect(useRequestStore.getState().responses["tab-1"]!.status).toBe(200);
      expect(useRequestStore.getState().historyRefreshCounter).toBe(before + 1);
    });

    it("setError stores error", () => {
      useRequestStore.getState().setError("tab-1", "Something went wrong");
      expect(useRequestStore.getState().errors["tab-1"]).toBe("Something went wrong");
    });

    it("clearError removes error", () => {
      useRequestStore.getState().setError("tab-1", "err");
      useRequestStore.getState().clearError("tab-1");
      expect(useRequestStore.getState().errors["tab-1"]).toBeUndefined();
    });

    it("clearResponse removes response", () => {
      useRequestStore.getState().setResponse("tab-1", makeResponse());
      useRequestStore.getState().clearResponse("tab-1");
      expect(useRequestStore.getState().responses["tab-1"]).toBeUndefined();
    });

    it("switchTab sets currentTabId and initializes data", () => {
      useRequestStore.getState().switchTab("tab-1");
      expect(useRequestStore.getState().currentTabId).toBe("tab-1");
      expect(useRequestStore.getState().requestDataMap["tab-1"]).toBeDefined();
    });

    it("switchTab null clears currentTabId", () => {
      useRequestStore.getState().switchTab("tab-1");
      useRequestStore.getState().switchTab(null);
      expect(useRequestStore.getState().currentTabId).toBeNull();
    });

    it("removeTabData cleans all tab state", () => {
      useRequestStore.getState().switchTab("tab-1");
      useRequestStore.getState().setResponse("tab-1", makeResponse());
      useRequestStore.getState().removeTabData("tab-1");
      expect(useRequestStore.getState().requestDataMap["tab-1"]).toBeUndefined();
      expect(useRequestStore.getState().responses["tab-1"]).toBeUndefined();
    });

    it("setRequestHeaders marks tab as dirty", () => {
      useRequestStore.getState().switchTab("tab-1");
      const headers: Header[] = [{ key: "Accept", value: "application/json", disabled: false }];
      useRequestStore.getState().setRequestHeaders(headers);
      expect(useRequestStore.getState().dirtyTabs["tab-1"]).toBe(true);
    });

    it("setRequestParams stores params", () => {
      useRequestStore.getState().switchTab("tab-1");
      const params: QueryParam[] = [{ key: "page", value: "1", disabled: false }];
      useRequestStore.getState().setRequestParams(params);
      expect(useRequestStore.getState().requestDataMap["tab-1"]!.params).toEqual(params);
    });

    it("setRequestBody stores body", () => {
      useRequestStore.getState().switchTab("tab-1");
      const body: BodyConfig = { mode: "raw", raw: { content: "test", language: "text" } };
      useRequestStore.getState().setRequestBody(body);
      expect(useRequestStore.getState().requestDataMap["tab-1"]!.body).toEqual(body);
    });

    it("setRequestAuth stores auth", () => {
      useRequestStore.getState().switchTab("tab-1");
      const auth: AuthConfig = { type: "bearer", config: { token: "tok" } };
      useRequestStore.getState().setRequestAuth(auth);
      expect(useRequestStore.getState().requestDataMap["tab-1"]!.auth).toEqual(auth);
    });

    it("setRequestSettings stores settings", () => {
      useRequestStore.getState().switchTab("tab-1");
      const settings: RequestSettings = { timeoutMs: 10000, followRedirects: false, maxRedirects: 3, verifySsl: false };
      useRequestStore.getState().setRequestSettings(settings);
      expect(useRequestStore.getState().requestDataMap["tab-1"]!.settings).toEqual(settings);
    });

    it("setRequestScripts stores scripts", () => {
      useRequestStore.getState().switchTab("tab-1");
      useRequestStore.getState().setRequestScripts({ preRequest: "pm.environment.set('x', 'y')", postResponse: "pm.test('status', () => {})" });
      expect(useRequestStore.getState().requestDataMap["tab-1"]!.scripts.preRequest).toBe("pm.environment.set('x', 'y')");
      expect(useRequestStore.getState().requestDataMap["tab-1"]!.scripts.postResponse).toBe("pm.test('status', () => {})");
    });

    it("setTestResults stores results per tab", () => {
      useRequestStore.getState().setTestResults("tab-1", [
        { name: "Status 200", passed: true, durationMs: 5, error: null },
        { name: "Body check", passed: false, durationMs: 3, error: "Expected array" },
      ]);
      const results = useRequestStore.getState().testResults["tab-1"];
      expect(results).toHaveLength(2);
      expect(results![0]!.passed).toBe(true);
      expect(results![1]!.passed).toBe(false);
    });

    it("initTabData creates new tab data", () => {
      useRequestStore.getState().initTabData("tab-2", {
        headers: [{ key: "Accept", value: "*/*", disabled: false }],
      });
      const data = useRequestStore.getState().requestDataMap["tab-2"]!;
      expect(data.headers).toHaveLength(1);
      expect(data.body).toBeNull();
      expect(data.auth.type).toBe("none");
    });

    it("initTabData overwrites existing data", () => {
      useRequestStore.getState().switchTab("tab-3");
      useRequestStore.getState().initTabData("tab-3", { settings: { timeoutMs: 5000, followRedirects: false, maxRedirects: 5, verifySsl: false } });
      expect(useRequestStore.getState().requestDataMap["tab-3"]!.settings.timeoutMs).toBe(5000);
    });

    it("markDirty and clearDirty work", () => {
      expect(useRequestStore.getState().isDirty("tab-x")).toBe(false);
      useRequestStore.getState().markDirty("tab-x");
      expect(useRequestStore.getState().isDirty("tab-x")).toBe(true);
      useRequestStore.getState().clearDirty("tab-x");
      expect(useRequestStore.getState().isDirty("tab-x")).toBe(false);
    });
  });

  // === DEFAULT_REQUEST_DATA ===
  describe("DEFAULT_REQUEST_DATA", () => {
    it("has reasonable defaults", () => {
      expect(DEFAULT_REQUEST_DATA.headers).toEqual([]);
      expect(DEFAULT_REQUEST_DATA.params).toEqual([]);
      expect(DEFAULT_REQUEST_DATA.body).toBeNull();
      expect(DEFAULT_REQUEST_DATA.auth.type).toBe("none");
      expect(DEFAULT_REQUEST_DATA.settings.timeoutMs).toBe(30000);
      expect(DEFAULT_REQUEST_DATA.settings.followRedirects).toBe(true);
      expect(DEFAULT_REQUEST_DATA.settings.maxRedirects).toBe(10);
      expect(DEFAULT_REQUEST_DATA.settings.verifySsl).toBe(true);
      expect(DEFAULT_REQUEST_DATA.scripts.preRequest).toBeUndefined();
      expect(DEFAULT_REQUEST_DATA.scripts.postResponse).toBeUndefined();
    });
  });
});