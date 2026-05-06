import { create } from "zustand";

export interface Tab {
  id: string;
  name: string;
  method: string;
  url: string;
  isModified: boolean;
  requestId?: string;
  response?: unknown;
  protocol?: "http" | "websocket" | "sse" | "mqtt" | "grpc" | "mock" | "collection-config";
  meta?: {
    collectionId?: string;
    folderId?: string;
    folderPath?: string[];
  };
}

export interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
}

export interface TabActions {
  openTab: (tab: Omit<Tab, "id" | "isModified">) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
}

export type TabStore = TabState & TabActions;

interface TabStoreImpl extends TabStore {
  openTab: (tab: Omit<Tab, "id" | "isModified">) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
}

export const useTabStore = create<TabStoreImpl>()((set) => ({
  tabs: [],
  activeTabId: null,

  openTab: (tabData) =>
    set((state) => {
      if (tabData.protocol === "collection-config" && tabData.meta) {
        const existing = state.tabs.find(
          (t) => t.protocol === "collection-config" &&
            t.meta?.collectionId === tabData.meta?.collectionId &&
            t.meta?.folderId === tabData.meta?.folderId
        );
        if (existing) {
          return { activeTabId: existing.id };
        }
      } else if (tabData.requestId) {
        const existing = state.tabs.find((t) => t.requestId === tabData.requestId);
        if (existing) {
          return { activeTabId: existing.id };
        }
      } else {
        let existing: Tab | undefined;
        if (tabData.url) {
          existing = state.tabs.find(
            (t) => t.method === tabData.method && t.url === tabData.url && !t.requestId
          );
        } else if (tabData.name && tabData.name !== "New Request") {
          existing = state.tabs.find(
            (t) => t.method === tabData.method && t.name === tabData.name && !t.url && !t.requestId
          );
        }
        if (existing) {
          return { activeTabId: existing.id };
        }
      }
      const id = crypto.randomUUID();
      return {
        tabs: [...state.tabs, { ...tabData, id, isModified: false }],
        activeTabId: id,
      };
    }),

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
}));
