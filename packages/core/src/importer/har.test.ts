import { describe, it, expect } from "vitest";
import { parseHar } from "./har";

describe("har parser", () => {
  it("parses valid HAR v1.2 with single entry", () => {
    const json = JSON.stringify({
      log: {
        version: "1.2",
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.example.com/users",
              headers: [{ name: "Accept", value: "application/json" }],
            },
            response: { status: 200 },
          },
        ],
      },
    });
    const result = parseHar(json);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]!.method).toBe("GET");
    expect(result.requests[0]!.url).toBe("https://api.example.com/users");
    expect(result.collectionName).toBe("HAR Import");
    expect(result.format).toBe("har");
  });

  it("handles HAR with no entries", () => {
    const json = JSON.stringify({
      log: {
        version: "1.2",
        entries: [],
      },
    });
    const result = parseHar(json);
    expect(result.requests).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("handles completely empty object", () => {
    const result = parseHar(JSON.stringify({}));
    expect(result.requests).toHaveLength(0);
  });

  it("parses entry with request headers", () => {
    const json = JSON.stringify({
      log: {
        entries: [
          {
            request: {
              method: "POST",
              url: "https://api.example.com/data",
              headers: [
                { name: "Content-Type", value: "application/json" },
                { name: "Authorization", value: "Bearer token-abc" },
                { name: "X-Request-Id", value: "12345" },
              ],
            },
            response: { status: 201 },
          },
        ],
      },
    });
    const result = parseHar(json);
    expect(result.requests[0]!.headers).toHaveLength(3);
    expect(result.requests[0]!.headers[0]!.key).toBe("Content-Type");
    expect(result.requests[0]!.headers[1]!.key).toBe("Authorization");
    expect(result.requests[0]!.headers[2]!.value).toBe("12345");
  });

  it("parses entry with postData JSON body", () => {
    const json = JSON.stringify({
      log: {
        entries: [
          {
            request: {
              method: "POST",
              url: "https://api.example.com/items",
              postData: {
                mimeType: "application/json",
                text: '{"name":"test","price":9.99}',
              },
            },
            response: { status: 201 },
          },
        ],
      },
    });
    const result = parseHar(json);
    expect(result.requests[0]!.body).toBeDefined();
    expect(result.requests[0]!.body!.mode).toBe("raw");
    expect(result.requests[0]!.body!.content).toBe('{"name":"test","price":9.99}');
    expect(result.requests[0]!.body!.content_type).toBe("application/json");
    expect(result.requests[0]!.body!.language).toBe("json");
  });

  it("parses entry with postData urlencoded body", () => {
    const json = JSON.stringify({
      log: {
        entries: [
          {
            request: {
              method: "POST",
              url: "https://api.example.com/form",
              postData: {
                mimeType: "application/x-www-form-urlencoded",
                params: [
                  { name: "username", value: "admin" },
                  { name: "password", value: "pass" },
                ],
              },
            },
            response: { status: 200 },
          },
        ],
      },
    });
    const result = parseHar(json);
    expect(result.requests[0]!.body).toBeDefined();
    expect(result.requests[0]!.body!.mode).toBe("urlencoded");
  });

  it("parses entry with response data (ignores response for import)", () => {
    const json = JSON.stringify({
      log: {
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.example.com/data",
            },
            response: {
              status: 200,
              statusText: "OK",
              headers: [{ name: "Content-Type", value: "application/json" }],
              content: { mimeType: "application/json", text: '{"result":"ok"}' },
            },
          },
        ],
      },
    });
    const result = parseHar(json);
    expect(result.requests[0]!.method).toBe("GET");
    expect(result.requests[0]!.url).toBe("https://api.example.com/data");
  });

  it("extracts query params from URL", () => {
    const json = JSON.stringify({
      log: {
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.example.com/search?q=hello&sort=desc",
            },
            response: { status: 200 },
          },
        ],
      },
    });
    const result = parseHar(json);
    const params = result.requests[0]!.params;
    expect(params).toHaveLength(2);
    expect(params[0]!.key).toBe("q");
    expect(params[0]!.value).toBe("hello");
    expect(params[1]!.key).toBe("sort");
    expect(params[1]!.value).toBe("desc");
    expect(result.requests[0]!.url).toBe("https://api.example.com/search");
  });

  it("handles invalid/malformed JSON", () => {
    const result = parseHar("not valid json {{{{");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.requests).toHaveLength(0);
  });

  it("handles entries with missing fields gracefully by catching errors", () => {
    const json = JSON.stringify({
      log: {
        entries: [
          {
            request: {
              method: "GET",
            },
            response: { status: 200 },
          },
        ],
      },
    });
    const result = parseHar(json);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.requests).toHaveLength(0);
  });
});