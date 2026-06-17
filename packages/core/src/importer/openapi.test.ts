import { describe, it, expect } from "vitest";
import { parseOpenApi } from "./openapi";

const MINIMAL_OA3 = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "Test API", version: "1.0" },
  paths: {
    "/users": {
      get: {
        summary: "List users",
        parameters: [
          { name: "limit", in: "query", schema: { default: 10 } },
        ],
      },
    },
  },
});

const OA3_WITH_BODY = JSON.stringify({
  openapi: "3.1.0",
  info: { title: "Body API" },
  paths: {
    "/items": {
      post: {
        operationId: "createItem",
        requestBody: {
          content: {
            "application/json": {
              example: { name: "test", count: 1 },
            },
          },
        },
      },
    },
  },
});

const OA3_WITH_SERVER = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "Server API" },
  servers: [{ url: "https://api.example.com/v1", variables: {} }],
  paths: {
    "/widgets": {
      get: { summary: "List widgets" },
    },
  },
});

const OA3_WITH_SECURITY = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "Secure API" },
  paths: {
    "/secure": {
      get: {
        summary: "Secure endpoint",
        security: [{ bearerAuth: [] }],
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
  },
});

const OA3_WITH_APIKEY = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "ApiKey API" },
  paths: {
    "/data": {
      get: {
        security: [{ apiKeyAuth: [] }],
      },
    },
  },
  components: {
    securitySchemes: {
      apiKeyAuth: { type: "apiKey", name: "X-API-Key", in: "header" },
    },
  },
});

const SWAGGER2_BASE = JSON.stringify({
  swagger: "2.0",
  info: { title: "Swagger API" },
  host: "petstore.swagger.io",
  basePath: "/v2",
  schemes: ["https"],
  paths: {
    "/pets": {
      get: { summary: "Find pets" },
    },
  },
});

const INVALID_JSON = "not json";

const NO_SPEC = JSON.stringify({ info: { title: "Bad" }, paths: {} });

describe("openapi parseOpenApi", () => {
  it("parses minimal OpenAPI 3.0", () => {
    const result = parseOpenApi(MINIMAL_OA3);
    expect(result.format).toBe("openapi");
    expect(result.collectionName).toBe("Test API");
    expect(result.requests).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    const req = result.requests[0]!;
    expect(req.name).toBe("List users");
    expect(req.method).toBe("GET");
    expect(req.url).toBe("/users");
    expect(req.params).toHaveLength(1);
    expect(req.params[0]!.key).toBe("limit");
    expect(req.params[0]!.value).toBe("10");
  });

  it("parses request body as JSON", () => {
    const result = parseOpenApi(OA3_WITH_BODY);
    expect(result.requests).toHaveLength(1);
    const req = result.requests[0]!;
    expect(req.name).toBe("createItem");
    expect(req.method).toBe("POST");
    expect(req.body).toBeDefined();
    expect(req.body!.mode).toBe("raw");
    expect(req.body!.language).toBe("json");
    expect(req.body!.content).toContain("test");
  });

  it("resolves server base URL", () => {
    const result = parseOpenApi(OA3_WITH_SERVER);
    expect(result.requests[0]!.url).toBe("https://api.example.com/v1/widgets");
  });

  it("infers bearer auth from security scheme", () => {
    const result = parseOpenApi(OA3_WITH_SECURITY);
    expect(result.requests[0]!.auth).toEqual({
      type: "bearer",
      config: { token: "" },
    });
  });

  it("adds apiKey header from security scheme", () => {
    const result = parseOpenApi(OA3_WITH_APIKEY);
    const headers = result.requests[0]!.headers;
    expect(headers).toHaveLength(1);
    expect(headers[0]!.key).toBe("X-API-Key");
  });

  it("parses Swagger 2.0", () => {
    const result = parseOpenApi(SWAGGER2_BASE);
    expect(result.format).toBe("openapi");
    expect(result.collectionName).toBe("Swagger API");
    expect(result.requests[0]!.url).toBe("https://petstore.swagger.io/v2/pets");
  });

  it("parses all HTTP methods", () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      paths: {
        "/all": {
          get: {},
          post: {},
          put: {},
          delete: {},
          patch: {},
          head: {},
          options: {},
        },
      },
    });
    const result = parseOpenApi(spec);
    expect(result.requests).toHaveLength(7);
    const methods = result.requests.map((r) => r.method);
    expect(methods).toContain("GET");
    expect(methods).toContain("POST");
    expect(methods).toContain("PUT");
    expect(methods).toContain("DELETE");
    expect(methods).toContain("PATCH");
    expect(methods).toContain("HEAD");
    expect(methods).toContain("OPTIONS");
  });

  it("skips non-HTTP method keys in path item", () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      paths: {
        "/test": {
          get: {},
          parameters: [],
          summary: "nope",
          description: "nope",
        },
      },
    });
    const result = parseOpenApi(spec);
    expect(result.requests).toHaveLength(1);
  });

  it("returns error for invalid JSON", () => {
    const result = parseOpenApi(INVALID_JSON);
    expect(result.requests).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Invalid JSON");
  });

  it("returns error for non-OpenAPI JSON", () => {
    const result = parseOpenApi(NO_SPEC);
    expect(result.requests).toHaveLength(0);
    expect(result.errors[0]).toContain("Not a valid OpenAPI");
  });

  it("returns error for no paths", () => {
    const result = parseOpenApi(JSON.stringify({ openapi: "3.0.0" }));
    expect(result.errors[0]).toContain("No paths");
  });

  it("falls back to operationId when no summary", () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      paths: {
        "/test": { get: { operationId: "getTest" } },
      },
    });
    const result = parseOpenApi(spec);
    expect(result.requests[0]!.name).toBe("getTest");
  });

  it("falls back to METHOD /path when no summary or operationId", () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      paths: {
        "/test": { get: {} },
      },
    });
    const result = parseOpenApi(spec);
    expect(result.requests[0]!.name).toBe("GET /test");
  });

  it("handles header parameters", () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      paths: {
        "/test": {
          get: {
            parameters: [
              { name: "X-Trace", in: "header", schema: { default: "trace123" } },
            ],
          },
        },
      },
    });
    const result = parseOpenApi(spec);
    const headers = result.requests[0]!.headers;
    expect(headers).toHaveLength(1);
    expect(headers[0]!.key).toBe("X-Trace");
    expect(headers[0]!.value).toBe("trace123");
  });

  it("adds apiKey query param when scheme is in query", () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      paths: {
        "/data": {
          get: {
            security: [{ queryKey: [] }],
          },
        },
      },
      components: {
        securitySchemes: {
          queryKey: { type: "apiKey", name: "api_key", in: "query" },
        },
      },
    });
    const result = parseOpenApi(spec);
    const params = result.requests[0]!.params;
    expect(params).toHaveLength(1);
    expect(params[0]!.key).toBe("api_key");
  });

  it("infers basic auth from http/basic security scheme", () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      paths: {
        "/test": {
          get: {
            security: [{ basicAuth: [] }],
          },
        },
      },
      components: {
        securitySchemes: {
          basicAuth: { type: "http", scheme: "basic" },
        },
      },
    });
    const result = parseOpenApi(spec);
    expect(result.requests[0]!.auth).toEqual({
      type: "basic",
      config: { username: "", password: "" },
    });
  });

  it("handles empty requestBody content", () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      paths: {
        "/test": {
          post: {
            requestBody: { content: {} },
          },
        },
      },
    });
    const result = parseOpenApi(spec);
    expect(result.requests[0]!.body).toBeUndefined();
  });

  it("handles server variable substitution", () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "Var API" },
      servers: [{
        url: "https://{sub}.example.com/{version}",
        variables: {
          sub: { default: "api" },
          version: { default: "v1" },
        },
      }],
      paths: {
        "/test": { get: {} },
      },
    });
    const result = parseOpenApi(spec);
    expect(result.requests[0]!.url).toBe("https://api.example.com/v1/test");
  });

  it("adds errors when no operations found in paths", () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "Empty" },
      paths: {
        "/empty": {},
      },
    });
    const result = parseOpenApi(spec);
    expect(result.requests).toHaveLength(0);
    expect(result.errors[0]).toContain("No operations");
  });
});