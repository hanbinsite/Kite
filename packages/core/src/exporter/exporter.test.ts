import { describe, it, expect } from "vitest";
import { toCurlCommands } from "./curl";
import { toPostmanCollection } from "./postman";
import { toHar } from "./har";
import { exportCollection } from "./exporter";
import type { ExportCollection } from "./types";

const sampleCollection: ExportCollection = {
  name: "Test API",
  requests: [
    {
      name: "Get Users",
      method: "GET",
      url: "https://api.example.com/users",
      headers: [],
      params: [],
    },
    {
      name: "Create User",
      method: "POST",
      url: "https://api.example.com/users",
      headers: [{ key: "Content-Type", value: "application/json", disabled: false }],
      params: [],
      body: { mode: "raw", content: '{"name":"test"}' },
    },
  ],
};

describe("exporter", () => {
  describe("toCurlCommands", () => {
    it("generates curl commands for all requests", () => {
      const result = toCurlCommands(sampleCollection);
      expect(result).toContain("curl");
      expect(result).toContain("https://api.example.com/users");
      expect(result).toContain("-X POST");
    });

    it("omits header on GET request if no headers", () => {
      const col: ExportCollection = {
        name: "Simple",
        requests: [{ name: "Ping", method: "GET", url: "https://api.example.com/ping", headers: [], params: [] }],
      };
      const result = toCurlCommands(col);
      expect(result).toBe("curl 'https://api.example.com/ping'");
    });

    it("includes bearer auth header", () => {
      const col: ExportCollection = {
        name: "Auth API",
        requests: [
          {
            name: "Secure",
            method: "GET",
            url: "https://api.example.com/secure",
            headers: [],
            params: [],
            auth: { type: "bearer", config: { token: "tok123" } },
          },
        ],
      };
      const result = toCurlCommands(col);
      expect(result).toContain("Authorization: Bearer tok123");
    });

    it("includes basic auth header", () => {
      const col: ExportCollection = {
        name: "Auth",
        requests: [
          {
            name: "Login",
            method: "POST",
            url: "https://api.example.com/login",
            headers: [],
            params: [],
            auth: { type: "basic", config: { username: "admin", password: "secret" } },
          },
        ],
      };
      const result = toCurlCommands(col);
      expect(result).toContain("Authorization: Basic");
    });

    it("includes query params in URL", () => {
      const col: ExportCollection = {
        name: "Search",
        requests: [
          {
            name: "Search",
            method: "GET",
            url: "https://api.example.com/search",
            headers: [],
            params: [
              { key: "q", value: "hello", disabled: false },
              { key: "page", value: "1", disabled: false },
            ],
          },
        ],
      };
      const result = toCurlCommands(col);
      expect(result).toContain("q=hello");
      expect(result).toContain("page=1");
    });

    it("excludes disabled headers and params", () => {
      const col: ExportCollection = {
        name: "Filtered",
        requests: [
          {
            name: "Req",
            method: "GET",
            url: "https://api.example.com",
            headers: [
              { key: "X-Enabled", value: "yes", disabled: false },
              { key: "X-Disabled", value: "no", disabled: true },
            ],
            params: [
              { key: "active", value: "1", disabled: false },
              { key: "inactive", value: "0", disabled: true },
            ],
          },
        ],
      };
      const result = toCurlCommands(col);
      expect(result).toContain("X-Enabled");
      expect(result).not.toContain("X-Disabled");
      expect(result).toContain("active=1");
      expect(result).not.toContain("inactive");
    });
  });

  describe("toPostmanCollection", () => {
    it("generates valid postman collection structure", () => {
      const result = toPostmanCollection(sampleCollection, { format: "postman" });
      expect(result.info.name).toBe("Test API");
      expect(result.info.schema).toContain("postman");
      expect(result.item).toHaveLength(2);
      expect(result.item[0]!.name).toBe("Get Users");
      expect(result.item[0]!.request.method).toBe("GET");
    });

    it("includes auth in postman request", () => {
      const col: ExportCollection = {
        name: "Auth",
        requests: [
          {
            name: "Req",
            method: "GET",
            url: "https://api.example.com",
            headers: [],
            params: [],
            auth: { type: "bearer", config: { token: "tok" } },
          },
        ],
      };
      const result = toPostmanCollection(col, { format: "postman" });
      expect(result.item[0]!.request.auth?.type).toBe("bearer");
    });
  });

  describe("toHar", () => {
    it("generates valid HAR structure", () => {
      const result = toHar(sampleCollection);
      expect(result.log.version).toBe("1.2");
      expect(result.log.entries).toHaveLength(2);
      expect(result.log.entries[0]!.request.method).toBe("GET");
      expect(result.log.entries[0]!.request.url).toBe("https://api.example.com/users");
    });
  });

  describe("exportCollection", () => {
    it("exports as Postman JSON", () => {
      const result = exportCollection(sampleCollection, { format: "postman" });
      const parsed = JSON.parse(result);
      expect(parsed.info.name).toBe("Test API");
    });

    it("exports as curl", () => {
      const result = exportCollection(sampleCollection, { format: "curl" });
      expect(result).toContain("curl");
    });

    it("exports as HAR JSON", () => {
      const result = exportCollection(sampleCollection, { format: "har" });
      const parsed = JSON.parse(result);
      expect(parsed.log.version).toBe("1.2");
    });

    it("throws for unsupported format", () => {
      expect(() => exportCollection(sampleCollection, { format: "openapi" as "curl" })).toThrow();
    });
  });
});