import { describe, it, expect } from "vitest";
import { parseCurl } from "./curl";
import { parsePostman } from "./postman";
import { parseHar } from "./har";
import { detectFormat } from "./detect";

describe("curl importer", () => {
  it("parses basic GET curl", () => {
    const result = parseCurl("curl https://api.example.com/users");
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]!.method).toBe("GET");
    expect(result.requests[0]!.url).toBe("https://api.example.com/users");
  });

  it("parses POST with body", () => {
    const result = parseCurl(`curl -X POST -H "Content-Type: application/json" -d '{"key":"val"}' https://api.example.com`);
    expect(result.requests[0]!.method).toBe("POST");
    expect(result.requests[0]!.body).toBeDefined();
    expect(result.requests[0]!.body!.content).toBe('{"key":"val"}');
  });

  it("parses Bearer auth from header", () => {
    const result = parseCurl(`curl -H "Authorization: Bearer token123" https://api.example.com`);
    expect(result.requests[0]!.auth).toBeDefined();
    expect(result.requests[0]!.auth!.type).toBe("bearer");
    expect(result.requests[0]!.auth!.config.token).toBe("token123");
  });

  it("parses Basic auth from -u flag", () => {
    const result = parseCurl(`curl -u admin:pass123 https://api.example.com`);
    expect(result.requests[0]!.auth).toBeDefined();
    expect(result.requests[0]!.auth!.type).toBe("basic");
    expect(result.requests[0]!.auth!.config.username).toBe("admin");
    expect(result.requests[0]!.auth!.config.password).toBe("pass123");
  });

  it("parses headers", () => {
    const result = parseCurl(`curl -H "X-Custom: value1" -H "Accept: application/json" https://api.example.com`);
    const headers = result.requests[0]!.headers;
    expect(headers).toHaveLength(2);
    expect(headers[0]!.key).toBe("X-Custom");
    expect(headers[1]!.key).toBe("Accept");
  });

  it("parses query params from URL", () => {
    const result = parseCurl("curl 'https://api.example.com/users?page=1&limit=10'");
    const params = result.requests[0]!.params;
    expect(params).toHaveLength(2);
    expect(params[0]!.key).toBe("page");
    expect(params[1]!.key).toBe("limit");
  });

  it("returns error for non-curl input", () => {
    const result = parseCurl("not a curl command");
    expect(result.requests).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("postman importer", () => {
  const basicPostman = JSON.stringify({
    info: { name: "Test Collection", _postman_id: "abc123" },
    item: [
      {
        name: "Get Users",
        request: {
          method: "GET",
          url: "https://api.example.com/users",
          header: [{ key: "Accept", value: "application/json" }],
        },
      },
    ],
  });

  it("parses basic Postman collection", () => {
    const result = parsePostman(basicPostman);
    expect(result.collectionName).toBe("Test Collection");
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]!.name).toBe("Get Users");
    expect(result.requests[0]!.method).toBe("GET");
  });

  it("parses nested folders", () => {
    const nested = JSON.stringify({
      info: { name: "Nested" },
      item: [
        {
          name: "Folder",
          item: [
            {
              name: "Nested Request",
              request: { method: "POST", url: "https://api.example.com/items" },
            },
          ],
        },
      ],
    });
    const result = parsePostman(nested);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]!.name).toBe("Nested Request");
  });

  it("handles invalid JSON", () => {
    const result = parsePostman("invalid");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.requests).toHaveLength(0);
  });
});

describe("har importer", () => {
  const basicHar = JSON.stringify({
    log: {
      entries: [
        {
          request: {
            method: "GET",
            url: "https://api.example.com/users?id=1",
            headers: [{ name: "Accept", value: "application/json" }],
          },
          response: { status: 200 },
        },
      ],
    },
  });

  it("parses basic HAR", () => {
    const result = parseHar(basicHar);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]!.method).toBe("GET");
  });

  it("extracts query params from URL", () => {
    const result = parseHar(basicHar);
    expect(result.requests[0]!.params).toHaveLength(1);
    expect(result.requests[0]!.params[0]!.key).toBe("id");
  });

  it("handles missing entries", () => {
    const result = parseHar(JSON.stringify({}));
    expect(result.requests).toHaveLength(0);
  });
});

describe("detect", () => {
  it("detects curl", () => {
    expect(detectFormat("curl -X GET https://api.example.com")).toBe("curl");
  });

  it("detects postman", () => {
    expect(detectFormat(JSON.stringify({ info: { _postman_id: "abc" } }))).toBe("postman");
  });

  it("detects openapi", () => {
    expect(detectFormat(JSON.stringify({ openapi: "3.0.0" }))).toBe("openapi");
  });

  it("detects swagger", () => {
    expect(detectFormat(JSON.stringify({ swagger: "2.0" }))).toBe("openapi");
  });

  it("detects har", () => {
    expect(detectFormat(JSON.stringify({ log: { entries: [] } }))).toBe("har");
  });

  it("returns unknown for plain text", () => {
    expect(detectFormat("some random text")).toBe("unknown");
  });

  it("returns unknown for JSON without known keys", () => {
    expect(detectFormat(JSON.stringify({ foo: "bar" }))).toBe("unknown");
  });
});