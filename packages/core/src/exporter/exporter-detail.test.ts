import { describe, it, expect } from "vitest";
import { toCurlCommands } from "./curl";
import { toPostmanCollection } from "./postman";
import { toHar } from "./har";
import type { ExportCollection, ExportOptions } from "./types";

const sampleCollection: ExportCollection = {
  name: "Test API",
  requests: [
    {
      name: "Get Users",
      method: "GET",
      url: "https://api.example.com/users",
      headers: [{ key: "Accept", value: "application/json", disabled: false }],
      params: [{ key: "page", value: "1", disabled: false }],
      body: undefined,
      auth: undefined,
    },
    {
      name: "Create User",
      method: "POST",
      url: "https://api.example.com/users",
      headers: [{ key: "Content-Type", value: "application/json", disabled: false }],
      params: [],
      body: { mode: "raw", content: '{"name":"Test"}', content_type: "application/json", language: "json" },
      auth: { type: "bearer", config: { token: "secret123" } },
    },
  ],
  variables: [
    { key: "BASE_URL", value: "https://api.example.com" },
  ],
};

describe("curl exporter", () => {
  it("generates curl for GET request", () => {
    const result = toCurlCommands({
      ...sampleCollection,
      requests: [sampleCollection.requests[0]!],
    });
    expect(result).toContain("curl");
    expect(result).toContain("Accept: application/json");
    expect(result).not.toContain("-X");
  });

  it("generates curl with POST body", () => {
    const result = toCurlCommands({
      ...sampleCollection,
      requests: [sampleCollection.requests[1]!],
    });
    expect(result).toContain("POST");
    expect(result).toContain("-d");
    expect(result).toContain('{"name":"Test"}');
    expect(result).toContain("Bearer secret123");
  });

  it("generates curl with basic auth", () => {
    const result = toCurlCommands({
      ...sampleCollection,
      requests: [{
        ...sampleCollection.requests[0]!,
        auth: { type: "basic", config: { username: "admin", password: "pass" } },
      }],
    });
    expect(result).toContain("Basic");
  });

  it("handles disabled headers", () => {
    const result = toCurlCommands({
      ...sampleCollection,
      requests: [{
        ...sampleCollection.requests[0]!,
        headers: [{ key: "X-Disabled", value: "skip", disabled: true }],
      }],
    });
    expect(result).not.toContain("X-Disabled");
  });
});

describe("postman exporter", () => {
  const options: ExportOptions = { format: "postman", includeVariables: true };

  it("generates Postman collection with info", () => {
    const result = toPostmanCollection(sampleCollection, options);
    expect(result.info.name).toBe("Test API");
    expect(result.info.schema).toContain("postman");
    expect(result.info._postman_id).toBeTruthy();
  });

  it("includes request headers", () => {
    const result = toPostmanCollection(sampleCollection, options);
    expect(result.item[0]!.request.header).toHaveLength(1);
    expect(result.item[0]!.request.header[0]!.key).toBe("Accept");
  });

  it("includes body for POST", () => {
    const result = toPostmanCollection(sampleCollection, options);
    expect(result.item[1]!.request.body).toBeDefined();
    expect(result.item[1]!.request.body!.raw).toBe('{"name":"Test"}');
  });

  it("includes bearer auth", () => {
    const result = toPostmanCollection(sampleCollection, options);
    expect(result.item[1]!.request.auth).toBeDefined();
    expect(result.item[1]!.request.auth!.type).toBe("bearer");
  });

  it("includes variables when enabled", () => {
    const result = toPostmanCollection(sampleCollection, options);
    expect(result.variable).toHaveLength(1);
    expect(result.variable![0]!.key).toBe("BASE_URL");
  });

  it("excludes variables when disabled", () => {
    const result = toPostmanCollection(sampleCollection, { format: "postman", includeVariables: false });
    expect(result.variable).toBeUndefined();
  });

  it("handles URL params in postman", () => {
    const result = toPostmanCollection(sampleCollection, options);
    expect(result.item[0]!.request.url.query).toHaveLength(1);
    expect(result.item[0]!.request.url.query![0]!.key).toBe("page");
  });
});

describe("har exporter", () => {
  it("generates HAR with log structure", () => {
    const result = toHar(sampleCollection);
    expect(result.log.version).toBe("1.2");
    expect(result.log.creator.name).toBe("api-client");
    expect(result.log.entries).toHaveLength(2);
  });

  it("includes request method and URL in HAR", () => {
    const result = toHar(sampleCollection);
    expect(result.log.entries[0]!.request.method).toBe("GET");
    expect(result.log.entries[0]!.request.url).toContain("page=1");
  });

  it("includes headers in HAR", () => {
    const result = toHar(sampleCollection);
    expect(result.log.entries[0]!.request.headers).toHaveLength(1);
    expect(result.log.entries[0]!.request.headers[0]!.name).toBe("Accept");
  });

  it("includes auth header in HAR", () => {
    const result = toHar(sampleCollection);
    const authHeader = result.log.entries[1]!.request.headers.find(
      (h) => h.name === "Authorization"
    );
    expect(authHeader).toBeDefined();
    expect(authHeader!.value).toContain("Bearer");
  });

  it("includes postData in HAR for requests with body", () => {
    const result = toHar(sampleCollection);
    expect(result.log.entries[1]!.request.postData).toBeDefined();
    expect(result.log.entries[1]!.request.postData!.text).toBe('{"name":"Test"}');
  });

  it("has pending responses in HAR", () => {
    const result = toHar(sampleCollection);
    expect(result.log.entries[0]!.response.status).toBe(0);
    expect(result.log.entries[0]!.response.statusText).toBe("Pending");
  });
});