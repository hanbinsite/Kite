import type { ExportCollection } from "./types";

export function toCurlCommands(collection: ExportCollection): string {
  return collection.requests.map((req) => toCurlCommand(req)).join("\n\n");
}

function toCurlCommand(req: ExportCollection["requests"][0]): string {
  const parts: string[] = ["curl"];

  if (req.method !== "GET") {
    parts.push("-X", req.method);
  }

  for (const h of req.headers.filter((h) => !h.disabled)) {
    parts.push("-H", `'${h.key}: ${h.value}'`);
  }

  if (req.auth) {
    if (req.auth.type === "bearer") {
      parts.push("-H", `'Authorization: Bearer ${req.auth.config.token ?? ""}'`);
    } else if (req.auth.type === "basic") {
      const encoded = btoa(`${req.auth.config.username ?? ""}:${req.auth.config.password ?? ""}`);
      parts.push("-H", `'Authorization: Basic ${encoded}'`);
    }
  }

  if (req.body?.content) {
    if (req.body.mode === "raw") {
      parts.push("-d", `'${req.body.content}'`);
    }
  }

  const paramsStr = req.params
    .filter((p) => !p.disabled && p.key)
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join("&");
  const fullUrl = paramsStr ? `${req.url}?${paramsStr}` : req.url;
  parts.push(`'${fullUrl}'`);

  return parts.join(" ");
}