import { create } from "zustand";

export type Theme = "dark" | "light" | "system";

export interface UIState {
  theme: Theme;
  sidebarVisible: boolean;
  sidebarWidth: number;
  splitRatio: number;
}

export interface UIActions {
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setSplitRatio: (ratio: number) => void;
}

export type UIStore = UIState & UIActions;

interface UIStoreImpl extends UIStore {
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setSplitRatio: (ratio: number) => void;
}

export const useUIStore = create<UIStoreImpl>()((set) => ({
  theme: "dark",
  sidebarVisible: true,
  sidebarWidth: 220,
  splitRatio: 0.5,

  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setSplitRatio: (ratio) => set({ splitRatio: ratio }),
}));
