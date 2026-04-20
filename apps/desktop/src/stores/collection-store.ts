import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
    listCollections,
    getCollection,
    saveCollection,
    deleteCollection as deleteCollectionIpc,
    type IpcCollectionFile,
    type IpcCollectionItem,
} from "@api-client/core/http";

export interface CollectionRequest {
    id: string;
    method: string;
    name: string;
    url: string;
}

export interface CollectionFolder {
    id: string;
    name: string;
    items: CollectionTreeNode[];
}

export type CollectionTreeNode =
    | { type: "request"; id: string; method: string; name: string; url: string }
    | { type: "folder"; id: string; name: string; items: CollectionTreeNode[] };

export interface CollectionItem {
    id: string;
    name: string;
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

function treeToIpcItems(items: CollectionTreeNode[]): IpcCollectionItem[] {
    return items.map((item) => {
        if (item.type === "folder") {
            return {
                type: "folder" as const,
                id: item.id,
                name: item.name,
                items: treeToIpcItems(item.items),
            };
        }
        return {
            type: "request" as const,
            id: item.id,
            name: item.name,
            method: item.method,
            url: item.url,
            headers: [],
            params: [],
            scripts: { pre_request: undefined, post_response: undefined },
            settings: { timeout_ms: 30000, follow_redirects: true, max_redirects: 10, verify_ssl: true },
        };
    });
}

function toIpcCollection(col: CollectionItem): IpcCollectionFile {
    return {
        id: col.id,
        name: col.name,
        items: treeToIpcItems(col.items),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}

function ipcItemsToTree(items: IpcCollectionItem[]): CollectionTreeNode[] {
    return items.map((item) => {
        if (item.type === "folder") {
            return {
                type: "folder" as const,
                id: item.id,
                name: item.name,
                items: ipcItemsToTree(item.items ?? []),
            };
        }
        return {
            type: "request" as const,
            id: item.id,
            name: item.name ?? "",
            method: item.method ?? "GET",
            url: item.url ?? "",
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
      items.push(copy);
      break;
    }
    if (item.type === "folder") {
      const before = item.items.length;
      findAndDuplicateNode(item.items, requestId);
      if (item.items.length > before) break;
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
                if (col) findAndDuplicateNode(col.items, requestId);
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
