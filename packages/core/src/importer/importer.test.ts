import { describe, it, expect } from "vitest";
import { detectFormat } from "./detect";
import { parseCurl } from "./curl";
import { parsePostman } from "./postman";
import { parseHar } from "./har";
import { importCollection } from "./importer";

describe("importer", () => {
  describe("detectFormat", () => {
    it("detects curl from prefix", () => {
      expect(detectFormat("curl -X GET https://api.example.com")).toBe("curl");
    });

    it("detects postman by _postman_id", () => {
      expect(detectFormat(JSON.stringify({ info: { _postman_id: "abc", name: "Test" }, item: [] }))).toBe("postman");
    });

    it("detects postman by schema", () => {
      expect(detectFormat(JSON.stringify({ info: { schema: "https://schema.getpostman.com/json/collection/v2.1.0/" }, item: [] }))).toBe("postman");
    });

    it("detects openapi", () => {
      expect(detectFormat(JSON.stringify({ openapi: "3.0.0", info: { title: "API" }, paths: {} }))).toBe("openapi");
    });

    it("detects HAR by log.entries", () => {
      expect(detectFormat(JSON.stringify({ log: { entries: [] } }))).toBe("har");
    });

    it("returns unknown for unrecognized content", () => {
      expect(detectFormat("not a known format")).toBe("unknown");
    });

    it("returns unknown for empty string", () => {
      expect(detectFormat("")).toBe("unknown");
    });

    it("handles whitespace before curl", () => {
      expect(detectFormat("  curl -X GET test")).toBe("curl");
    });
  });

  describe("parseCurl", () => {
    it("parses simple GET request", () => {
      const result = parseCurl("curl https://api.example.com/users");
      expect(result.errors).toHaveLength(0);
      expect(result.requests).toHaveLength(1);
      const req = result.requests[0]!;
      expect(req.method).toBe("GET");
      expect(req.url).toBe("https://api.example.com/users");
    });

    it("parses request with explicit method", () => {
      const result = parseCurl("curl -X POST https://api.example.com/users");
      const req = result.requests[0]!;
      expect(req.method).toBe("POST");
    });

    it("parses request with headers", () => {
      const result = parseCurl(`curl -X GET https://api.example.com -H "Content-Type: application/json" -H 'X-Custom: value'`);
      const req = result.requests[0]!;
      expect(req.headers).toHaveLength(1); // Content-Type is stored separately
      const customHeader = req.headers.find((h) => h.key === "X-Custom");
      expect(customHeader).toBeDefined();
      expect(customHeader!.value).toBe("value");
    });

    it("parses request with data body and auto-sets POST", () => {
      const result = parseCurl(`curl -d '{"key":"value"}' https://api.example.com`);
      const req = result.requests[0]!;
      expect(req.method).toBe("POST");
      expect(req.body?.mode).toBe("raw");
      expect(req.body?.content).toBe('{"key":"value"}');
    });

    it("parses bearer auth from Authorization header", () => {
      const result = parseCurl(`curl -H "Authorization: Bearer tok123" https://api.example.com`);
      const req = result.requests[0]!;
      expect(req.auth?.type).toBe("bearer");
      expect(req.auth?.config.token).toBe("tok123");
    });

    it("parses basic auth from -u flag", () => {
      const result = parseCurl("curl -u user:pass https://api.example.com");
      const req = result.requests[0]!;
      expect(req.auth?.type).toBe("basic");
      expect(req.auth?.config.username).toBe("user");
      expect(req.auth?.config.password).toBe("pass");
    });

    it("extracts query params from URL", () => {
      const result = parseCurl("curl 'https://api.example.com/search?q=hello&page=1'");
      const req = result.requests[0]!;
      expect(req.params).toHaveLength(2);
      expect(req.params[0]!.key).toBe("q");
      expect(req.params[0]!.value).toBe("hello");
      expect(req.params[1]!.key).toBe("page");
      expect(req.params[1]!.value).toBe("1");
      expect(req.url).toBe("https://api.example.com/search");
    });

    it("returns error for non-curl input", () => {
      const result = parseCurl("not curl");
      expect(result.errors).toHaveLength(1);
    });

    it("handles --data-raw flag", () => {
      const result = parseCurl("curl --data-raw 'body content' https://api.example.com");
      const req = result.requests[0]!;
      expect(req.method).toBe("POST");
      expect(req.body?.content).toBe("body content");
    });
  });

  describe("parsePostman", () => {
    it("parses v2.1 collection", () => {
      const postmanJson = JSON.stringify({
        info: { _postman_id: "abc", name: "My API" },
        item: [
          {
            name: "Get Users",
            request: { method: "GET", url: { raw: "https://api.example.com/users" } },
          },
          {
            name: "Create User",
            request: {
              method: "POST",
              url: "https://api.example.com/users",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: { mode: "raw", raw: '{"name":"test"}' },
            },
          },
        ],
      });
      const result = parsePostman(postmanJson);
      expect(result.errors).toHaveLength(0);
      expect(result.requests).toHaveLength(2);
      expect(result.collectionName).toBe("My API");
    });

    it("returns error for invalid JSON", () => {
      const result = parsePostman("not json");
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("handles postman with string URL", () => {
      const postmanJson = JSON.stringify({
        info: { _postman_id: "abc", name: "Test" },
        item: [{ name: "Req", request: { method: "GET", url: "https://api.example.com" } }],
      });
      const result = parsePostman(postmanJson);
      const req = result.requests[0]!;
      expect(req.url).toContain("https://api.example.com");
    });
  });

  describe("parseHar", () => {
    it("parses HAR 1.2 file", () => {
      const harJson = JSON.stringify({
        log: {
          entries: [
            {
              request: {
                method: "GET",
                url: "https://api.example.com/users",
                headers: [{ name: "Accept", value: "application/json" }],
              },
              response: { status: 200 },
            },
            {
              request: {
                method: "POST",
                url: "https://api.example.com/users",
                headers: [],
                postData: { mimeType: "application/json", text: '{"name":"test"}' },
              },
              response: { status: 201 },
            },
          ],
        },
      });
      const result = parseHar(harJson);
      expect(result.errors).toHaveLength(0);
      expect(result.requests).toHaveLength(2);
    });

    it("returns error for invalid JSON", () => {
      const result = parseHar("not json");
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("importCollection", () => {
    it("routes curl to parseCurl", () => {
      const result = importCollection("curl -X GET https://api.example.com");
      expect(result.format).toBe("curl");
      expect(result.requests).toHaveLength(1);
    });

    it("routes postman to parsePostman", () => {
      const result = importCollection(
        JSON.stringify({ info: { _postman_id: "abc", name: "API" }, item: [] })
      );
      expect(result.format).toBe("postman");
    });

    it("returns unknown format error for unrecognized input", () => {
      const result = importCollection("not a supported format");
      expect(result.format).toBe("unknown");
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("imports empty string as unknown", () => {
      const result = importCollection("");
      expect(result.format).toBe("unknown");
    });

    it("imports random JSON as unknown", () => {
      const result = importCollection(JSON.stringify({ foo: "bar" }));
      expect(result.format).toBe("unknown");
    });
  });
});