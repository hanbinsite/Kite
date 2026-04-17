import { create } from "zustand";

export interface Tab {
  id: string;
  name: string;
  method: string;
  url: string;
  isModified: boolean;
  response?: unknown;
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
