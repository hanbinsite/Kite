import type { ImportResult, ImportRequest } from "./types";

interface HarLog {
  entries?: {
    request: {
      method: string;
      url: string;
      headers?: { name: string; value: string }[];
      postData?: { mimeType: string; text?: string; params?: { name: string; value: string }[] };
    };
    response: { status: number };
  }[];
}

export function parseHar(json: string): ImportResult {
  const errors: string[] = [];
  const requests: ImportRequest[] = [];

  try {
    const har = JSON.parse(json) as { log?: HarLog };
    const entries = har.log?.entries ?? [];

    for (const entry of entries) {
      try {
        const req = entry.request;
        const u = new URL(req.url);
        const params = Array.from(u.searchParams.entries()).map(([key, value]) => ({
          key, value, disabled: false,
        }));
        const cleanUrl = `${u.origin}${u.pathname}`;

        const headers = (req.headers ?? []).map((h) => ({
          key: h.name,
          value: h.value,
          disabled: false,
        }));

        let body: ImportRequest["body"];
        if (req.postData) {
          const mimeType = req.postData.mimeType;
          if (mimeType.includes("json")) {
            body = { mode: "raw", content: req.postData.text, content_type: mimeType, language: "json" };
          } else if (mimeType.includes("urlencoded")) {
            body = { mode: "urlencoded", content_type: mimeType };
          } else if (mimeType.includes("form-data")) {
            body = { mode: "formdata", content_type: mimeType };
          } else {
            body = { mode: "raw", content: req.postData.text, content_type: mimeType, language: "text" };
          }
        }

        requests.push({
          name: `${req.method} ${cleanUrl}`,
          method: req.method.toUpperCase(),
          url: cleanUrl,
          headers,
          params,
          body,
        });
      } catch (e) {
        errors.push(`Failed to parse HAR entry: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { format: "har", collectionName: "HAR Import", requests, errors };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return { format: "har", collectionName: "HAR Import", requests: [], errors };
  }
}
