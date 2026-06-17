import type { ImportResult, ImportRequest } from "./types";

interface OpenApiPathItem {
  [method: string]: OpenApiOperation;
}

interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  security?: Array<Record<string, string[]>>;
}

interface OpenApiParameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  required?: boolean;
  schema?: { type?: string; default?: unknown };
  example?: unknown;
}

interface OpenApiRequestBody {
  content?: Record<string, { example?: unknown; schema?: { $ref?: string } }>;
}

interface OpenApiSpec {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; version?: string };
  servers?: Array<{ url: string; variables?: Record<string, { default: string }> }>;
  host?: string;
  basePath?: string;
  paths?: Record<string, OpenApiPathItem>;
  schemes?: string[];
  components?: { securitySchemes?: Record<string, { type: string; scheme?: string; name?: string; in: string }> };
  securityDefinitions?: Record<string, { type: string; scheme?: string; name?: string; in: string }>;
}

const METHOD_MAP: Record<string, string> = {
  get: "GET",
  post: "POST",
  put: "PUT",
  delete: "DELETE",
  patch: "PATCH",
  head: "HEAD",
  options: "OPTIONS",
};

export function parseOpenApi(content: string): ImportResult {
  let spec: OpenApiSpec;
  try {
    spec = JSON.parse(content) as OpenApiSpec;
  } catch {
    return {
      format: "openapi",
      collectionName: "OpenAPI Import",
      requests: [],
      errors: ["Invalid JSON: unable to parse OpenAPI specification"],
    };
  }

  if (!spec.openapi && !spec.swagger) {
    return {
      format: "openapi",
      collectionName: "OpenAPI Import",
      requests: [],
      errors: ["Not a valid OpenAPI/Swagger spec: missing 'openapi' or 'swagger' field"],
    };
  }

  const collectionName = spec.info?.title ?? "OpenAPI Import";
  const errors: string[] = [];
  const requests: ImportRequest[] = [];

  const baseUrl = resolveBaseUrl(spec);

  const securitySchemes = spec.components?.securitySchemes ?? spec.securityDefinitions ?? {};

  if (!spec.paths) {
    return {
      format: "openapi",
      collectionName,
      requests: [],
      errors: ["No paths defined in OpenAPI specification"],
    };
  }

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!METHOD_MAP[method]) continue;

      const op = operation as OpenApiOperation;
      const name = op.summary || op.operationId || `${METHOD_MAP[method]} ${path}`;
      const url = baseUrl ? baseUrl + path : path;

      const headers: ImportRequest["headers"] = [];
      const params: ImportRequest["params"] = [];

      if (op.parameters) {
        for (const param of op.parameters) {
          const value = String(param.schema?.default ?? param.example ?? "");
          if (param.in === "query") {
            params.push({ key: param.name, value, disabled: false });
          } else if (param.in === "header") {
            headers.push({ key: param.name, value, disabled: false });
          }
        }
      }

      let body: ImportRequest["body"] | undefined;
      if (op.requestBody?.content) {
        const jsonContent = op.requestBody.content["application/json"];
        if (jsonContent) {
          const exampleStr = jsonContent.example
            ? JSON.stringify(jsonContent.example, null, 2)
            : "{\n  \n}";
          body = { mode: "raw", content: exampleStr, content_type: "application/json", language: "json" };
        }
      }

      let auth: ImportRequest["auth"] | undefined;
      if (op.security && op.security.length > 0) {
        const firstSecurity = op.security[0];
        if (firstSecurity) {
          const [schemeName] = Object.keys(firstSecurity);
          if (schemeName && securitySchemes[schemeName]) {
            const scheme = securitySchemes[schemeName]!;
            if (scheme.type === "http" && scheme.scheme === "bearer") {
              auth = { type: "bearer", config: { token: "" } };
            } else if (scheme.type === "http" && scheme.scheme === "basic") {
              auth = { type: "basic", config: { username: "", password: "" } };
            } else if (scheme.type === "apiKey") {
              if (scheme.in === "header") {
                headers.push({ key: scheme.name ?? "X-API-Key", value: "", disabled: false });
              } else if (scheme.in === "query") {
                params.push({ key: scheme.name ?? "api_key", value: "", disabled: false });
              }
            }
          }
        }
      }

      requests.push({
        name,
        method: METHOD_MAP[method]!,
        url,
        headers,
        params,
        body,
        auth,
      });
    }
  }

  if (requests.length === 0) {
    errors.push("No operations found in OpenAPI paths");
  }

  return { format: "openapi", collectionName, requests, errors };
}

function resolveBaseUrl(spec: OpenApiSpec): string {
  if (spec.servers && spec.servers.length > 0 && spec.servers[0]?.url) {
    let url = spec.servers[0].url;
    if (spec.servers[0].variables) {
      for (const [varName, varDef] of Object.entries(spec.servers[0].variables)) {
        url = url.replace(`{${varName}}`, varDef?.default ?? "");
      }
    }
    return url.replace(/\/$/, "");
  }

  if (spec.host) {
    const scheme = (spec.schemes?.[0] ?? "https");
    const basePath = spec.basePath ?? "";
    return `${scheme}://${spec.host}${basePath}`.replace(/\/$/, "");
  }

  return "";
}
