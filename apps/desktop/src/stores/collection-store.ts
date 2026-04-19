import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  listCollections,
  getCollection,
  saveCollection,
  deleteCollection as deleteCollectionIpc,
  type IpcCollectionFile,
  type IpcSavedRequest,
} from "@api-client/core/http";

export interface CollectionRequest {
  id: string;
  method: string;
  name: string;
  url: string;
}

export interface CollectionItem {
  id: string;
  name: string;
  requests: CollectionRequest[];
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
  deleteRequest: (collectionId: string, requestId: string) => void;
  renameRequest: (collectionId: string, requestId: string, name: string) => void;
  duplicateRequest: (collectionId: string, requestId: string) => void;
  loadFromDisk: () => Promise<void>;
  persistCollection: (id: string) => void;
}

export type CollectionStore = CollectionState & CollectionActions;

function toIpcCollection(col: CollectionItem): IpcCollectionFile {
  return {
    id: col.id,
    name: col.name,
    requests: col.requests.map((r) => ({
      id: r.id,
      name: r.name,
      method: r.method,
      url: r.url,
      headers: [],
      params: [],
      scripts: {},
      settings: { timeout_ms: 30000, follow_redirects: true, verify_ssl: true },
    })),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export const useCollectionStore = create<CollectionStore>()(
  immer((set, get) => ({
    collections: [],
    isLoaded: false,

    setCollections: (collections) => set({ collections }),

    addCollection: (id, name) => {
      set((state) => {
        state.collections.push({ id, name, requests: [] });
      });
      get().persistCollection(id);
    },

    deleteCollection: (id) => {
      set((state) => {
        state.collections = state.collections.filter((c) => c.id !== id);
      });
      deleteCollectionIpc(id).catch(() => {});
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
        if (col) col.requests.push(request);
      });
      get().persistCollection(collectionId);
    },

    deleteRequest: (collectionId, requestId) => {
      set((state) => {
        const col = state.collections.find((c) => c.id === collectionId);
        if (col) col.requests = col.requests.filter((r) => r.id !== requestId);
      });
      get().persistCollection(collectionId);
    },

    renameRequest: (collectionId, requestId, name) => {
      set((state) => {
        const col = state.collections.find((c) => c.id === collectionId);
        if (col) {
          const req = col.requests.find((r) => r.id === requestId);
          if (req) req.name = name;
        }
      });
      get().persistCollection(collectionId);
    },

    duplicateRequest: (collectionId, requestId) => {
      const state = get();
      const col = state.collections.find((c) => c.id === collectionId);
      if (!col) return;
      const req = col.requests.find((r) => r.id === requestId);
      if (!req) return;
      const dupId = crypto.randomUUID();
      set((state) => {
        const col = state.collections.find((c) => c.id === collectionId);
        if (col) col.requests.push({ ...req, id: dupId, name: `${req.name} (copy)` });
      });
      get().persistCollection(collectionId);
    },

    loadFromDisk: async () => {
      if (get().isLoaded) return;
      try {
        const summaries = await listCollections();
        if (summaries.length === 0) {
          set({ collections: [{ id: "default", name: "My Collection", requests: [] }], isLoaded: true });
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
              requests: file.requests.map((r: IpcSavedRequest) => ({
                id: r.id,
                method: r.method,
                name: r.name,
                url: r.url,
              })),
            });
          } catch {
            // skip broken collection files
          }
        }
        set({ collections: collections.length > 0 ? collections : [{ id: "default", name: "My Collection", requests: [] }], isLoaded: true });
      } catch {
        set({ collections: [{ id: "default", name: "My Collection", requests: [] }], isLoaded: true });
      }
    },

    persistCollection: (id) => {
      const state = get();
      const col = state.collections.find((c) => c.id === id);
      if (col) {
        saveCollection(toIpcCollection(col)).catch(() => {});
      }
    },
  })),
);
