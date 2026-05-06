import type { ExportCollection, ExportOptions } from "./types";

interface PostmanItem {
  name: string;
  item?: PostmanItem[];
  request: {
    method: string;
    header: { key: string; value: string; disabled?: boolean }[];
    url: {
      raw: string;
      host: string[];
      path: string[];
      query?: { key: string; value: string; disabled?: boolean }[];
    };
    body?: {
      mode: string;
      raw?: string;
      options?: { raw?: { language?: string } };
    };
    auth?: {
      type: string;
      bearer?: { key: string; value: string; type: string }[];
      basic?: { key: string; value: string; type: string }[];
    };
  };
}

interface PostmanCollection {
  info: {
    name: string;
    schema: string;
    _postman_id: string;
  };
  item: PostmanItem[];
  variable?: { key: string; value: string; type: string }[];
}

export function toPostmanCollection(collection: ExportCollection, options: ExportOptions): PostmanCollection {
  const items: PostmanItem[] = collection.requests.map((req) => {
    const urlStr = buildFullUrl(req);
    let urlObj: URL;
    try { urlObj = new URL(urlStr); } catch { urlObj = new URL("http://localhost"); }

    const header = req.headers
      .filter((h) => !h.disabled)
      .map((h) => ({ key: h.key, value: h.value, disabled: h.disabled }));

    const body: PostmanItem["request"]["body"] | undefined = req.body
      ? {
          mode: req.body.mode === "raw" ? "raw" : req.body.mode === "urlencoded" ? "urlencoded" : req.body.mode === "formdata" ? "formdata" : "raw",
          raw: req.body.content,
          options: req.body.language ? { raw: { language: req.body.language } } : undefined,
        }
      : undefined;

    const auth: PostmanItem["request"]["auth"] | undefined = req.auth
      ? req.auth.type === "bearer"
        ? { type: "bearer", bearer: [{ key: "token", value: req.auth.config.token as string ?? "", type: "string" }] }
        : req.auth.type === "basic"
          ? { type: "basic", basic: [{ key: "username", value: req.auth.config.username as string ?? "", type: "string" }, { key: "password", value: req.auth.config.password as string ?? "", type: "string" }] }
          : { type: req.auth.type }
      : undefined;

    return {
      name: req.name,
      request: {
        method: req.method,
        header,
        url: {
          raw: urlStr,
          host: urlObj.hostname.split("."),
          path: urlObj.pathname.split("/").filter(Boolean),
          query: req.params.filter((p) => !p.disabled).map((p) => ({ key: p.key, value: p.value })),
        },
        body,
        auth,
      },
    };
  });

  return {
    info: {
      name: collection.name,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      _postman_id: crypto.randomUUID(),
    },
    item: items,
    variable: options.includeVariables && collection.variables
      ? collection.variables.map((v) => ({ key: v.key, value: v.value, type: "string" }))
      : undefined,
  };
}

function buildFullUrl(req: ExportCollection["requests"][0]): string {
  const paramsStr = req.params
    .filter((p) => !p.disabled && p.key)
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join("&");
  return paramsStr ? `${req.url}?${paramsStr}` : req.url;
}