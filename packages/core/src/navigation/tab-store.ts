import { create } from "zustand";

export interface Tab {
  id: string;
  name: string;
  method: string;
  url: string;
  isModified: boolean;
  requestId?: string;
  response?: unknown;
  protocol?: "http" | "websocket" | "sse" | "mqtt" | "grpc" | "mock" | "proxy" | "collection-config";
  meta?: {
    collectionId?: string;
    folderId?: string;
    folderPath?: string[];
    initialSubTab?: string;
  };
}

export interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
}

export interface TabActions {
  openTab: (tab: Omit<Tab, "id" | "isModified">) => string;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
}

export type TabStore = TabState & TabActions;

interface TabStoreImpl extends TabStore {
  openTab: (tab: Omit<Tab, "id" | "isModified">) => string;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  saveTabs: () => void;
  restoreTabs: () => void;
}

export const useTabStore = create<TabStoreImpl>()((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (tabData) => {
    let resultId = "";
    set((state) => {
      let existing: Tab | undefined;
      if (tabData.protocol === "collection-config" && tabData.meta) {
        existing = state.tabs.find(
          (t) => t.protocol === "collection-config" &&
            t.meta?.collectionId === tabData.meta?.collectionId &&
            t.meta?.folderId === tabData.meta?.folderId
        );
      } else if (tabData.requestId) {
        existing = state.tabs.find((t) => t.requestId === tabData.requestId);
      } else if (tabData.url) {
        existing = state.tabs.find(
          (t) => t.method === tabData.method && t.url === tabData.url && !t.requestId
        );
      } else if (tabData.name) {
        existing = state.tabs.find(
          (t) => t.method === tabData.method && t.name === tabData.name && !t.url && !t.requestId
        );
      }
      if (existing) {
        resultId = existing.id;
        return { activeTabId: existing.id };
      }
      const id = crypto.randomUUID();
      resultId = id;
      return {
        tabs: [...state.tabs, { ...tabData, id, isModified: false }],
        activeTabId: id,
      };
    });
    return resultId;
  },

  closeTab: (id) =>
    set((state) => {
      const index = state.tabs.findIndex((t) => t.id === id);
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActiveTabId = state.activeTabId;
      if (state.activeTabId === id) {
        const newIndex = Math.min(index, newTabs.length - 1);
        newActiveTabId = newTabs[newIndex]?.id ?? null;
      }
      return { tabs: newTabs, activeTabId: newActiveTabId };
    }),

  closeOtherTabs: (id) =>
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id === id),
      activeTabId: id,
    })),

  closeAllTabs: () => set({ tabs: [], activeTabId: null }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, updates) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  saveTabs: () => {
    const { tabs, activeTabId } = get();
    try {
      const serializable = tabs.map(({ response: _response, ...rest }) => rest);
      localStorage.setItem("kite-tabs", JSON.stringify({ tabs: serializable, activeTabId }));
    } catch {
      // localStorage may be unavailable (SSR/private mode)
    }
  },

  restoreTabs: () => {
    try {
      const saved = localStorage.getItem("kite-tabs");
      if (!saved) return;
      const { tabs, activeTabId } = JSON.parse(saved) as { tabs: Tab[]; activeTabId: string | null };
      if (Array.isArray(tabs) && tabs.length > 0) {
        set({ tabs, activeTabId });
      }
    } catch {
      // corrupt data, ignore
    }
  },
}));
