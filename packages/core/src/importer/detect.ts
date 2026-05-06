import type { ImportFormat } from "./types";

export function detectFormat(content: string): ImportFormat {
  const trimmed = content.trim();

  if (trimmed.startsWith("curl ")) return "curl";

  try {
    const json = JSON.parse(trimmed);
    if (json.info?._postman_id || json.info?.schema?.includes("postman")) return "postman";
    if (json.openapi || json.swagger) return "openapi";
    if (json.log?.entries) return "har";
  } catch {
    // not JSON
  }

  return "unknown";
}
