import type { ImportResult, ImportRequest } from "./types";

export function parseCurl(curlCommand: string): ImportResult {
  const errors: string[] = [];
  const requests: ImportRequest[] = [];

  try {
    const parsed = parseCurlCommand(curlCommand);
    requests.push(parsed);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return {
    format: "curl",
    collectionName: "cURL Import",
    requests,
    errors,
  };
}

function parseCurlCommand(input: string): ImportRequest {
  const tokens = tokenize(input);
  if (tokens.length === 0 || (tokens[0] ?? "").toLowerCase() !== "curl") {
    throw new Error("Not a valid cURL command");
  }

  let method = "GET";
  let url = "";
  const headers: { key: string; value: string; disabled: boolean }[] = [];
  let bodyContent: string | undefined;
  let contentType: string | undefined;
  let authHeader: string | undefined;

  let i = 1;
  while (i < tokens.length) {
    const token = tokens[i] ?? "";

    if (token === "-X" || token === "--request") {
      i++;
      const val = tokens[i];
      if (val) method = val.toUpperCase();
    } else if (token === "-H" || token === "--header") {
      i++;
      const val = tokens[i];
      if (val) {
        const headerMatch = val.match(/^([^:]+):\s*(.*)$/);
        if (headerMatch) {
          const key = headerMatch[1]?.trim() ?? "";
          const value = headerMatch[2]?.trim() ?? "";
          if (key.toLowerCase() === "content-type") {
            contentType = value;
          } else if (key.toLowerCase() === "authorization") {
            authHeader = value;
          } else {
            headers.push({ key, value, disabled: false });
          }
        }
      }
    } else if (token === "-d" || token === "--data" || token === "--data-raw" || token === "--data-binary") {
      i++;
      const val = tokens[i];
      if (val) {
        bodyContent = val;
        if (method === "GET") method = "POST";
      }
    } else if (token === "--data-urlencode") {
      i++;
      const val = tokens[i];
      if (val) {
        bodyContent = val;
        contentType = "application/x-www-form-urlencoded";
        if (method === "GET") method = "POST";
      }
    } else if (token === "-F" || token === "--form") {
      i++;
      if (i < tokens.length) {
        contentType = "multipart/form-data";
        if (method === "GET") method = "POST";
      }
    } else if (token === "-u" || token === "--user") {
      i++;
      const val = tokens[i];
      if (val) {
        authHeader = `Basic ${btoa(val)}`;
      }
    } else if (token === "-b" || token === "--cookie") {
      i++;
    } else if (!token.startsWith("-")) {
      if (!url) url = token;
    }

    i++;
  }

  let auth: { type: string; config: Record<string, unknown> } | undefined;
  if (authHeader) {
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      auth = { type: "bearer", config: { token: authHeader.slice(7) } };
    } else if (authHeader.toLowerCase().startsWith("basic ")) {
      const decoded = atob(authHeader.slice(6));
      const colonIdx = decoded.indexOf(":");
      auth = {
        type: "basic",
        config: {
          username: colonIdx >= 0 ? decoded.slice(0, colonIdx) : decoded,
          password: colonIdx >= 0 ? decoded.slice(colonIdx + 1) : "",
        },
      };
    } else {
      headers.push({ key: "Authorization", value: authHeader, disabled: false });
    }
  }

  const body: ImportRequest["body"] | undefined = bodyContent
    ? { mode: "raw", content: bodyContent, content_type: contentType ?? "application/json", language: contentType?.includes("json") ? "json" : "text" }
    : undefined;

  let cleanUrl = url;
  let params: { key: string; value: string; disabled: boolean }[] = [];
  try {
    const urlObj = new URL(url);
    params = Array.from(urlObj.searchParams.entries()).map(([key, value]) => ({
      key, value, disabled: false,
    }));
    cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    // URL parsing failed, use as-is
  }

  return {
    name: `${method} ${cleanUrl}`,
    method,
    url: cleanUrl,
    headers,
    params,
    body,
    auth,
  };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (const ch of input) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if ((ch === " " || ch === "\t" || ch === "\n") && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current) tokens.push(current);

  return tokens;
}
