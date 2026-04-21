import { create } from "zustand";
import { measureSync } from "../performance";

export type Theme = "dark" | "light" | "system";

export interface UIState {
  theme: Theme;
  sidebarVisible: boolean;
  sidebarWidth: number;
  splitRatio: number;
  settingsOpen: boolean;
}

export interface UIActions {
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setSplitRatio: (ratio: number) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export type UIStore = UIState & UIActions;

interface UIStoreImpl extends UIStore {
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setSplitRatio: (ratio: number) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useUIStore = create<UIStoreImpl>()((set) => ({
  theme: (localStorage.getItem("theme") as Theme) || "dark",
  sidebarVisible: localStorage.getItem("sidebarVisible") !== "false",
  sidebarWidth: 220,
  splitRatio: 0.5,
  settingsOpen: false,

  setTheme: (theme) => { localStorage.setItem("theme", theme); set({ theme }); },
  toggleSidebar: () => measureSync("sidebar:toggle", () => set((state) => { const next = !state.sidebarVisible; localStorage.setItem("sidebarVisible", String(next)); return { sidebarVisible: next }; })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setSplitRatio: (ratio) => set({ splitRatio: ratio }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}));
