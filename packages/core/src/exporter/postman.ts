import type { ExportCollection, ExportFolder, ExportOptions, ExportRequest } from "./types";

interface PostmanRequest {
  method: string;
  description?: string;
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
}

interface PostmanItem {
  name: string;
  description?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
}

interface PostmanCollection {
  info: {
    name: string;
    schema: string;
    _postman_id: string;
    description?: string;
  };
  item: PostmanItem[];
  variable?: { key: string; value: string; type: string }[];
}

function buildPostmanItem(req: ExportRequest): PostmanItem {
  const urlStr = buildFullUrl(req);
  let urlObj: URL;
  try { urlObj = new URL(urlStr); } catch { urlObj = new URL("http://localhost"); }

  const header = req.headers
    .filter((h) => !h.disabled)
    .map((h) => ({ key: h.key, value: h.value, disabled: h.disabled }));

  const body: PostmanRequest["body"] | undefined = req.body
    ? {
        mode: req.body.mode === "raw" ? "raw" : req.body.mode === "urlencoded" ? "urlencoded" : req.body.mode === "formdata" ? "formdata" : "raw",
        raw: req.body.content,
        options: req.body.language ? { raw: { language: req.body.language } } : undefined,
      }
    : undefined;

  const auth: PostmanRequest["auth"] | undefined = req.auth
    ? req.auth.type === "bearer"
      ? { type: "bearer", bearer: [{ key: "token", value: req.auth.config.token as string ?? "", type: "string" }] }
      : req.auth.type === "basic"
        ? { type: "basic", basic: [{ key: "username", value: req.auth.config.username as string ?? "", type: "string" }, { key: "password", value: req.auth.config.password as string ?? "", type: "string" }] }
        : { type: req.auth.type }
    : undefined;

  return {
    name: req.name,
    description: req.description,
    request: {
      method: req.method,
      description: req.description,
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
}

function buildFolderItems(folders: ExportFolder[] | undefined, orphanRequests: ExportRequest[]): PostmanItem[] {
  const items: PostmanItem[] = [];

  if (folders) {
    for (const folder of folders) {
      const folderItem: PostmanItem = {
        name: folder.name,
        description: folder.description,
        item: folder.items.map(buildPostmanItem),
      };
      items.push(folderItem);
    }
  }

  for (const req of orphanRequests) {
    items.push(buildPostmanItem(req));
  }

  return items;
}

export function toPostmanCollection(collection: ExportCollection, options: ExportOptions): PostmanCollection {
  const hasExplicitFolders = collection.folders && collection.folders.length > 0;
  let folderItems: PostmanItem[];

  if (hasExplicitFolders) {
    folderItems = buildFolderItems(collection.folders, []);
  } else {
    const { folders, orphans } = groupRequestsByPath(collection.requests);
    if (folders.length > 1 || (folders.length === 1 && orphans.length > 0)) {
      folderItems = buildFolderItems(folders, orphans);
    } else {
      folderItems = collection.requests.map(buildPostmanItem);
    }
  }

  return {
    info: {
      name: collection.name,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      _postman_id: crypto.randomUUID(),
    },
    item: folderItems,
    variable: options.includeVariables && collection.variables
      ? collection.variables.map((v) => ({ key: v.key, value: v.value, type: "string" }))
      : undefined,
  };
}

function groupRequestsByPath(requests: ExportRequest[]): { folders: ExportFolder[]; orphans: ExportRequest[] } {
  const map = new Map<string, ExportRequest[]>();
  const orphans: ExportRequest[] = [];

  for (const req of requests) {
    const group = req.folderGroup ?? extractPathPrefix(req.url);
    if (group) {
      const existing = map.get(group);
      if (existing) {
        existing.push(req);
      } else {
        map.set(group, [req]);
      }
    } else {
      orphans.push(req);
    }
  }

  if (map.size === 0) {
    return { folders: [], orphans };
  }

  const folders: ExportFolder[] = [];
  for (const [name, items] of map) {
    folders.push({ name, items });
  }
  return { folders, orphans };
}

function extractPathPrefix(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length >= 1) {
      return "/" + parts[0];
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function buildFullUrl(req: ExportCollection["requests"][0]): string {
  const paramsStr = req.params
    .filter((p) => !p.disabled && p.key)
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join("&");
  return paramsStr ? `${req.url}?${paramsStr}` : req.url;
}