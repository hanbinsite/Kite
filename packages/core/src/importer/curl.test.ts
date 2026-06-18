import { describe, it, expect } from "vitest";
import { parseCurl } from "./curl";

describe("curl command parser", () => {
  it("parses basic GET request", () => {
    const result = parseCurl("curl https://example.com");
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]!.method).toBe("GET");
    expect(result.requests[0]!.url).toMatch(/^https:\/\/example\.com\/?$/);
  });

  it("parses POST with data", () => {
    const result = parseCurl(`curl -X POST -d '{"key":"val"}' https://api.example.com`);
    expect(result.requests[0]!.method).toBe("POST");
    expect(result.requests[0]!.body).toBeDefined();
    expect(result.requests[0]!.body!.content).toBe('{"key":"val"}');
  });

  it("parses headers", () => {
    const result = parseCurl(`curl -H "Content-Type: application/json" -H "Accept: application/json" https://example.com`);
    const headers = result.requests[0]!.headers;
    expect(headers).toHaveLength(1);
    expect(headers[0]!.key).toBe("Accept");
  });

it("parses complex multi-line curl with backslashes", () => {
    const cmd = [
      "curl -X POST",
      "-H \"Content-Type: application/json\"",
      "-d '{\"name\":\"test\"}'",
      "https://api.example.com/users",
    ].join(" ");
    const result = parseCurl(cmd);
    expect(result.requests[0]!.method).toBe("POST");
    expect(result.requests[0]!.url).toMatch(/https:\/\/api\.example\.com\/users\/?/);
    expect(result.requests[0]!.body!.content).toBe('{"name":"test"}');
  });

  it("parses --data-raw flag", () => {
    const result = parseCurl(`curl --data-raw '{"raw":true}' https://api.example.com`);
    expect(result.requests[0]!.method).toBe("POST");
    expect(result.requests[0]!.body!.content).toBe('{"raw":true}');
  });

  it("parses --data-binary flag", () => {
    const result = parseCurl(`curl --data-binary @file.bin https://api.example.com`);
    expect(result.requests[0]!.method).toBe("POST");
    expect(result.requests[0]!.body!.content).toBe("@file.bin");
  });

  it("handles empty curl string", () => {
    const result = parseCurl("");
    expect(result.requests).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("parses URL with query parameters", () => {
    const result = parseCurl("curl 'https://api.example.com/search?q=hello&page=2'");
    const params = result.requests[0]!.params;
    expect(params).toHaveLength(2);
    expect(params[0]!.key).toBe("q");
    expect(params[0]!.value).toBe("hello");
    expect(params[1]!.key).toBe("page");
    expect(params[1]!.value).toBe("2");
    expect(result.requests[0]!.url).toBe("https://api.example.com/search");
  });

  it("parses basic auth from -u flag", () => {
    const result = parseCurl(`curl -u user:pass https://example.com`);
    expect(result.requests[0]!.auth).toBeDefined();
    expect(result.requests[0]!.auth!.type).toBe("basic");
    expect(result.requests[0]!.auth!.config.username).toBe("user");
    expect(result.requests[0]!.auth!.config.password).toBe("pass");
  });

  it("parses Bearer token from header", () => {
    const result = parseCurl(`curl -H "Authorization: Bearer token123" https://example.com`);
    expect(result.requests[0]!.auth).toBeDefined();
    expect(result.requests[0]!.auth!.type).toBe("bearer");
    expect(result.requests[0]!.auth!.config.token).toBe("token123");
  });

  it("handles -L flag without error", () => {
    const result = parseCurl(`curl -L https://example.com`);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]!.method).toBe("GET");
    expect(result.requests[0]!.url).toMatch(/^https:\/\/example\.com\/?$/);
  });

  it("returns error for non-curl input", () => {
    const result = parseCurl("just some random text");
    expect(result.requests).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("uses collection name cURL Import", () => {
    const result = parseCurl("curl https://example.com");
    expect(result.collectionName).toBe("cURL Import");
    expect(result.format).toBe("curl");
  });
});