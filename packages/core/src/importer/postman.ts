import type { ImportResult, ImportRequest } from "./types";

interface PostmanItem {
  name: string;
  item?: PostmanItem[];
  request?: {
    method: string;
    url?: string | { raw?: string; host?: string[]; path?: string[]; query?: { key: string; value: string; disabled?: boolean }[] };
    header?: { key: string; value: string; disabled?: boolean }[];
    body?: { mode: string; raw?: string; options?: { raw?: { language?: string } }; urlencoded?: { key: string; value: string; disabled?: boolean }[]; formdata?: { key: string; value: string; type?: string; disabled?: boolean }[] };
    auth?: { type: string; [key: string]: unknown };
  };
}

export function parsePostman(json: string): ImportResult {
  const errors: string[] = [];
  const requests: ImportRequest[] = [];

  try {
    const collection = JSON.parse(json);
    const name = collection.info?.name ?? "Postman Import";
    const items: PostmanItem[] = collection.item ?? [];
    flattenItems(items, requests, errors);

    return { format: "postman", collectionName: name, requests, errors };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return { format: "postman", collectionName: "Postman Import", requests: [], errors };
  }
}

function flattenItems(items: PostmanItem[], requests: ImportRequest[], errors: string[]) {
  for (const item of items) {
    if (item.item && item.item.length > 0 && !item.request) {
      flattenItems(item.item, requests, errors);
    } else if (item.request) {
      try {
        requests.push(parseRequest(item));
      } catch (e) {
        errors.push(`Failed to parse "${item.name}": ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}

function parseUrl(url: string | { raw?: string; host?: string[]; path?: string[]; query?: { key: string; value: string; disabled?: boolean }[] } | undefined): { url: string; params: { key: string; value: string; disabled: boolean }[] } {
  if (!url) return { url: "", params: [] };
  if (typeof url === "string") {
    try {
      const u = new URL(url);
      const params = Array.from(u.searchParams.entries()).map(([key, value]) => ({ key, value, disabled: false }));
      return { url: `${u.origin}${u.pathname}`, params };
    } catch {
      return { url, params: [] };
    }
  }

  const raw = url.raw ?? "";
  const params = (url.query ?? []).map((q) => ({ key: q.key, value: q.value, disabled: q.disabled ?? false }));

  if (url.host && url.path) {
    const host = url.host.join(".");
    const path = url.path.join("/");
    return { url: `https://${host}/${path}`, params };
  }

  try {
    const u = new URL(raw);
    const urlParams = Array.from(u.searchParams.entries()).map(([key, value]) => ({ key, value, disabled: false }));
    return { url: `${u.origin}${u.pathname}`, params: [...urlParams, ...params] };
  } catch {
    return { url: raw, params };
  }
}

function parseRequest(item: PostmanItem): ImportRequest {
  const req = item.request!;
  const { url, params } = parseUrl(req.url);

  const headers = (req.header ?? []).map((h) => ({
    key: h.key,
    value: h.value,
    disabled: h.disabled ?? false,
  }));

  let body: ImportRequest["body"];
  if (req.body) {
    const mode = req.body.mode;
    if (mode === "raw" && req.body.raw) {
      const lang = req.body.options?.raw?.language ?? "json";
      const contentType = lang === "json" ? "application/json" : lang === "xml" ? "application/xml" : "text/plain";
      body = { mode: "raw", content: req.body.raw, content_type: contentType, language: lang };
    } else if (mode === "urlencoded" && req.body.urlencoded) {
      body = {
        mode: "urlencoded",
        content_type: "application/x-www-form-urlencoded",
      };
    } else if (mode === "formdata" && req.body.formdata) {
      body = { mode: "formdata", content_type: "multipart/form-data" };
    }
  }

  let auth: ImportRequest["auth"];
  if (req.auth) {
    const type = req.auth.type.toLowerCase();
    if (type === "bearer") {
      const tokenArr = req.auth.bearer as { key: string; value: string; type: string }[] | undefined;
      const token = Array.isArray(tokenArr) ? tokenArr.find((t) => t.key === "token")?.value ?? "" : "";
      auth = { type: "bearer", config: { token } };
    } else if (type === "basic") {
      const basicArr = req.auth.basic as { key: string; value: string; type: string }[] | undefined;
      const username = Array.isArray(basicArr) ? basicArr.find((t) => t.key === "username")?.value ?? "" : "";
      const password = Array.isArray(basicArr) ? basicArr.find((t) => t.key === "password")?.value ?? "" : "";
      auth = { type: "basic", config: { username, password } };
    }
  }

  return {
    name: item.name,
    method: req.method?.toUpperCase() ?? "GET",
    url,
    headers,
    params,
    body,
    auth,
  };
}
