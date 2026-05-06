import type { ExportCollection } from "./types";

interface HarFile {
  log: {
    version: string;
    creator: { name: string; version: string };
    entries: {
      request: {
        method: string;
        url: string;
        headers: { name: string; value: string }[];
        postData?: { mimeType: string; text?: string };
      };
      response: { status: number; statusText: string; headers: { name: string; value: string }[]; content: { size: number; mimeType: string } };
      time: number;
    }[];
  };
}

export function toHar(collection: ExportCollection): HarFile {
  return {
    log: {
      version: "1.2",
      creator: { name: "api-client", version: "0.1.0" },
      entries: collection.requests.map((req) => {
        const paramsStr = req.params
          .filter((p) => !p.disabled && p.key)
          .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
          .join("&");
        const fullUrl = paramsStr ? `${req.url}?${paramsStr}` : req.url;

        const headers: { name: string; value: string }[] = req.headers
          .filter((h) => !h.disabled)
          .map((h) => ({ name: h.key, value: h.value }));

        if (req.auth) {
          if (req.auth.type === "bearer") {
            headers.push({ name: "Authorization", value: `Bearer ${req.auth.config.token ?? ""}` });
          } else if (req.auth.type === "basic") {
            const encoded = btoa(`${req.auth.config.username ?? ""}:${req.auth.config.password ?? ""}`);
            headers.push({ name: "Authorization", value: `Basic ${encoded}` });
          }
        }

        let postData: HarFile["log"]["entries"][0]["request"]["postData"] | undefined;
        if (req.body?.content) {
          postData = {
            mimeType: req.body.content_type ?? "application/octet-stream",
            text: req.body.content,
          };
        }

        return {
          request: {
            method: req.method,
            url: fullUrl,
            headers,
            postData,
          },
          response: {
            status: 0,
            statusText: "Pending",
            headers: [],
            content: { size: 0, mimeType: "text/plain" },
          },
          time: 0,
        };
      }),
    },
  };
}