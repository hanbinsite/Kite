import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  listCollections,
  getCollection,
  saveCollection,
  deleteCollection as deleteCollectionIpc,
  type IpcCollectionFile,
  type IpcCollectionItem,
  type IpcAuthConfig,
  buildIpcAuth,
} from "@api-client/core/http";
import type { BodyConfig, AuthConfig, Header, ScriptConfig, CollectionConfig, FolderConfig } from "@api-client/types";

export interface CollectionRequest {
  id: string;
  method: string;
  name: string;
  url: string;
  headers?: Header[];
  auth?: AuthConfig;
  body?: BodyConfig;
  scripts?: ScriptConfig;
}

export interface CollectionFolder {
  id: string;
  name: string;
  description?: string;
  config?: FolderConfig;
  items: CollectionTreeNode[];
}

export type CollectionTreeNode =
  | { type: "request"; id: string; method: string; name: string; url: string; headers?: Header[]; auth?: AuthConfig; body?: BodyConfig; scripts?: ScriptConfig }
  | { type: "folder"; id: string; name: string; description?: string; config?: FolderConfig; items: CollectionTreeNode[] };

export interface CollectionItem {
    id: string;
    name: string;
    description?: string;
    version?: string;
    config?: CollectionConfig;
    items: CollectionTreeNode[];
}

export interface CollectionState {
    collections: CollectionItem[];
    isLoaded: boolean;
}

export interface CollectionActions {
    setCollections: (collections: CollectionItem[]) => void;
    addCollection: (id: string, name: string) => void;
    deleteCollection: (id: string) => void;
    renameCollection: (id: string, name: string) => void;
    addRequestToCollection: (collectionId: string, request: CollectionRequest) => void;
    addFolderToCollection: (collectionId: string, folderId: string, name: string) => void;
    deleteRequest: (collectionId: string, requestId: string) => void;
    renameRequest: (collectionId: string, requestId: string, name: string) => void;
    duplicateRequest: (collectionId: string, requestId: string) => void;
    loadFromDisk: () => Promise<void>;
    persistCollection: (id: string) => void;
}

export type CollectionStore = CollectionState & CollectionActions;

function bodyToIpc(body: BodyConfig | undefined | null): IpcCollectionItem["body"] {
  if (!body || body.mode === "none") return undefined;
  if (body.mode === "raw" && body.raw) {
    return { mode: "raw", content: body.raw.content, content_type: undefined, language: body.raw.language, formdata: [], urlencoded: [], graphql_query: undefined, graphql_variables: undefined };
  }
  if (body.mode === "urlencoded" && body.urlencoded) {
    return { mode: "urlencoded", content: undefined, content_type: undefined, language: undefined, formdata: [], urlencoded: body.urlencoded.map((p) => ({ key: p.key, value: p.value, disabled: p.disabled })), graphql_query: undefined, graphql_variables: undefined };
  }
  if (body.mode === "formdata" && body.formdata) {
    return { mode: "formdata", content: undefined, content_type: undefined, language: undefined, formdata: body.formdata.map((p) => ({ key: p.key, value: p.value, param_type: p.type, disabled: p.disabled, content_type: p.contentType })), urlencoded: [], graphql_query: undefined, graphql_variables: undefined };
  }
  if (body.mode === "graphql" && body.graphql) {
    return { mode: "graphql", content: undefined, content_type: undefined, language: undefined, formdata: [], urlencoded: [], graphql_query: body.graphql.query, graphql_variables: body.graphql.variables };
  }
  if (body.mode === "binary" && body.binary) {
    return { mode: "binary", content: body.binary, content_type: undefined, language: undefined, formdata: [], urlencoded: [], graphql_query: undefined, graphql_variables: undefined };
  }
  return undefined;
}

function authToIpc(auth: AuthConfig | undefined): IpcAuthConfig | undefined {
  if (!auth || auth.type === "none") return undefined;
  return buildIpcAuth(auth.type, auth.config as unknown as Record<string, unknown>);
}

function treeToIpcItems(items: CollectionTreeNode[]): IpcCollectionItem[] {
  return items.map((item) => {
    if (item.type === "folder") {
      return {
        type: "folder" as const,
        id: item.id,
        name: item.name,
        description: item.description,
        config: item.config ? {
          headers: item.config.headers,
          auth: item.config.auth ? buildIpcAuth(item.config.auth.type, item.config.auth.config as unknown as Record<string, unknown>) : undefined,
          variables: item.config.variables,
          scripts: item.config.scripts,
        } : undefined,
        items: treeToIpcItems(item.items),
      };
    }
    return {
      type: "request" as const,
      id: item.id,
      name: item.name,
      method: item.method,
      url: item.url,
      headers: item.headers ?? [],
      params: [],
      body: bodyToIpc(item.body),
      auth: authToIpc(item.auth),
      scripts: item.scripts ? { pre_request: item.scripts.preRequest, post_response: item.scripts.postResponse } : { pre_request: undefined, post_response: undefined },
      settings: { timeout_ms: 30000, follow_redirects: true, max_redirects: 10, verify_ssl: true },
    };
  });
}

function toIpcCollection(col: CollectionItem): IpcCollectionFile {
    return {
        id: col.id,
        name: col.name,
        description: col.description,
        version: col.version,
        config: col.config ? {
          headers: col.config.headers,
          auth: col.config.auth ? buildIpcAuth(col.config.auth.type, col.config.auth.config as unknown as Record<string, unknown>) : undefined,
          variables: col.config.variables,
          scripts: col.config.scripts,
        } : undefined,
        items: treeToIpcItems(col.items),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}

function ipcAuthToAuth(ipcAuth: IpcAuthConfig | undefined): AuthConfig | undefined {
  if (!ipcAuth || ipcAuth.type === "none") return undefined;
  return { type: ipcAuth.type as AuthConfig["type"], config: (ipcAuth.config ?? {}) as never } as AuthConfig;
}

function ipcBodyToBody(ipcBody: IpcCollectionItem["body"]): BodyConfig | undefined {
  if (!ipcBody) return undefined;
  const mode = ipcBody.mode as BodyConfig["mode"];
  if (mode === "none") return undefined;
  if (mode === "raw") {
    return { mode: "raw", raw: { language: (ipcBody.language ?? "json") as "json", content: ipcBody.content ?? "" } };
  }
  if (mode === "urlencoded") {
    return { mode: "urlencoded", urlencoded: (ipcBody.urlencoded ?? []).map((p) => ({ key: p.key, value: p.value, disabled: p.disabled })) };
  }
  if (mode === "formdata") {
    return { mode: "formdata", formdata: (ipcBody.formdata ?? []).map((p) => ({ key: p.key, value: p.value, type: (p.param_type === "file" ? "file" : "text") as "text" | "file", disabled: p.disabled })) };
  }
  if (mode === "graphql") {
    return { mode: "graphql", graphql: { query: ipcBody.graphql_query ?? "", variables: ipcBody.graphql_variables ?? "" } };
  }
  if (mode === "binary") {
    return { mode: "binary", binary: ipcBody.content ?? "" };
  }
  return undefined;
}

function ipcItemsToTree(items: IpcCollectionItem[]): CollectionTreeNode[] {
  return items.map((item) => {
    if (item.type === "folder") {
      return {
        type: "folder" as const,
        id: item.id,
        name: item.name,
        description: item.description,
        config: item.config ? {
          headers: item.config.headers,
          auth: ipcAuthToAuth(item.config.auth),
          variables: item.config.variables,
          scripts: item.config.scripts,
        } : undefined,
        items: ipcItemsToTree(item.items ?? []),
      };
    }
    return {
      type: "request" as const,
      id: item.id,
      name: item.name ?? "",
      method: item.method ?? "GET",
      url: item.url ?? "",
      headers: item.headers,
      auth: ipcAuthToAuth(item.auth),
      body: ipcBodyToBody(item.body),
      scripts: item.scripts ? {
        preRequest: item.scripts.pre_request,
        postResponse: item.scripts.post_response,
      } : undefined,
    };
  });
}

function findAndRemoveNode(items: CollectionTreeNode[], id: string): CollectionTreeNode[] {
    return items.filter((item) => {
        if (item.type === "request" && item.id === id) return false;
        if (item.type === "folder") {
            item.items = findAndRemoveNode(item.items, id);
        }
        return true;
    });
}

function findAndRenameNode(items: CollectionTreeNode[], id: string, name: string): CollectionTreeNode[] {
    for (const item of items) {
        if (item.type === "request" && item.id === id) { item.name = name; break; }
        if (item.type === "folder" && item.id === id) { item.name = name; break; }
        if (item.type === "folder") { findAndRenameNode(item.items, id, name); }
    }
    return items;
}

function findAndDuplicateNode(items: CollectionTreeNode[], requestId: string): CollectionTreeNode[] {
  for (const item of items) {
    if (item.type === "request" && item.id === requestId) {
      const copy: CollectionTreeNode = { ...item, id: crypto.randomUUID(), name: `${item.name} (copy)` };
      return [...items, copy];
    }
    if (item.type === "folder") {
      const before = item.items.length;
      const newChildren = findAndDuplicateNode(item.items, requestId);
      if (newChildren.length > before) {
        item.items = newChildren;
        return items;
      }
    }
  }
  return items;
}

export const useCollectionStore = create<CollectionStore>()(
    immer((set, get) => ({
        collections: [],
        isLoaded: false,

        setCollections: (collections) => set({ collections }),

        addCollection: (id, name) => {
            set((state) => {
                state.collections.push({ id, name, items: [] });
            });
            get().persistCollection(id);
        },

  deleteCollection: (id) => {
    set((state) => {
      state.collections = state.collections.filter((c) => c.id !== id);
    });
    deleteCollectionIpc(id).catch((e) => {
      console.error(`Failed to delete collection ${id}:`, e);
    });
  },

        renameCollection: (id, name) => {
            set((state) => {
                const col = state.collections.find((c) => c.id === id);
                if (col) col.name = name;
            });
            get().persistCollection(id);
        },

        addRequestToCollection: (collectionId, request) => {
            set((state) => {
                const col = state.collections.find((c) => c.id === collectionId);
                if (col) col.items.push({ type: "request", ...request });
            });
            get().persistCollection(collectionId);
        },

        addFolderToCollection: (collectionId, folderId, name) => {
            set((state) => {
                const col = state.collections.find((c) => c.id === collectionId);
                if (col) col.items.push({ type: "folder", id: folderId, name, items: [] });
            });
            get().persistCollection(collectionId);
        },

        deleteRequest: (collectionId, requestId) => {
            set((state) => {
                const col = state.collections.find((c) => c.id === collectionId);
                if (col) col.items = findAndRemoveNode(col.items, requestId);
            });
            get().persistCollection(collectionId);
        },

        renameRequest: (collectionId, requestId, name) => {
            set((state) => {
                const col = state.collections.find((c) => c.id === collectionId);
                if (col) findAndRenameNode(col.items, requestId, name);
            });
            get().persistCollection(collectionId);
        },

    duplicateRequest: (collectionId, requestId) => {
      const state = get();
      const col = state.collections.find((c) => c.id === collectionId);
      if (!col) return;
      set((state) => {
        const col = state.collections.find((c) => c.id === collectionId);
        if (col) col.items = findAndDuplicateNode(col.items, requestId);
      });
      get().persistCollection(collectionId);
    },

        loadFromDisk: async () => {
            if (get().isLoaded) return;
            try {
                const summaries = await listCollections();
                if (summaries.length === 0) {
                    set({ collections: [{ id: "default", name: "My Collection", items: [] }], isLoaded: true });
                    get().persistCollection("default");
                    return;
                }
                const collections: CollectionItem[] = [];
                for (const s of summaries) {
                    try {
                        const file = await getCollection(s.id);
                        collections.push({
                            id: file.id,
                            name: file.name,
                            description: file.description,
                            version: file.version,
                            config: file.config ? {
                              headers: file.config.headers,
                              auth: ipcAuthToAuth(file.config.auth),
                              variables: file.config.variables,
                              scripts: file.config.scripts,
                            } : undefined,
                            items: ipcItemsToTree(file.items ?? []),
                        });
                    } catch {
                        // skip broken collection files
                    }
                }
                set({ collections: collections.length > 0 ? collections : [{ id: "default", name: "My Collection", items: [] }], isLoaded: true });
            } catch {
                set({ collections: [{ id: "default", name: "My Collection", items: [] }], isLoaded: true });
            }
        },

  persistCollection: (id) => {
    const state = get();
    const col = state.collections.find((c) => c.id === id);
    if (col) {
      saveCollection(toIpcCollection(col)).catch((e) => {
        console.error(`Failed to persist collection "${col.name}" (${id}):`, e);
      });
    }
  },
    })),
);
