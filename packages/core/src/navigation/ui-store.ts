import { create } from "zustand";
import { measureSync } from "../performance";

export type Theme = "dark" | "light" | "system";

export interface UIState {
  theme: Theme;
  language: "en" | "zh-CN";
  sidebarVisible: boolean;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  splitRatio: number;
  settingsOpen: boolean;
  settingsCategory?: string;
  consoleOpen: boolean;
  aiPanelOpen: boolean;
  bottomPanelTab: "response" | "ai";
  urlBarFocusCounter: number;
}

export interface UIActions {
  setTheme: (theme: Theme) => void;
  setLanguage: (language: "en" | "zh-CN") => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSplitRatio: (ratio: number) => void;
  openSettings: (category?: string) => void;
  closeSettings: () => void;
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
  toggleAiPanel: () => void;
  setAiPanelOpen: (open: boolean) => void;
  setBottomPanelTab: (tab: "response" | "ai") => void;
  focusUrlBar: () => void;
}

export type UIStore = UIState & UIActions;

interface UIStoreImpl extends UIStore {
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSplitRatio: (ratio: number) => void;
  openSettings: (category?: string) => void;
  closeSettings: () => void;
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
  toggleAiPanel: () => void;
  setAiPanelOpen: (open: boolean) => void;
  setBottomPanelTab: (tab: "response" | "ai") => void;
}

function normalizeTheme(value: string | null): Theme {
  return value === "dark" || value === "light" || value === "system" ? value : "dark";
}

export const useUIStore = create<UIStoreImpl>()((set) => ({
  theme: normalizeTheme(localStorage.getItem("theme")),
  language: (localStorage.getItem("language") as "en" | "zh-CN") || "zh-CN",
  sidebarVisible: true,
  sidebarCollapsed: localStorage.getItem("sidebarCollapsed") === "true",
  sidebarWidth: 280,
  splitRatio: 0.5,
  settingsOpen: false,
  settingsCategory: undefined,
  consoleOpen: false,
  aiPanelOpen: false,
  bottomPanelTab: "response",
  urlBarFocusCounter: 0,

  setTheme: (theme) => { localStorage.setItem("theme", theme); set({ theme }); },
  setLanguage: (language) => { localStorage.setItem("language", language); set({ language }); },
  toggleSidebar: () => measureSync("sidebar:toggle", () => set((state) => {
    const nextCollapsed = !state.sidebarCollapsed;
    localStorage.setItem("sidebarCollapsed", String(nextCollapsed));
    return { sidebarCollapsed: nextCollapsed };
  })),
  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem("sidebarCollapsed", String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setSplitRatio: (ratio) => set({ splitRatio: ratio }),
  openSettings: (category) => set({ settingsOpen: true, settingsCategory: category }),
  closeSettings: () => set({ settingsOpen: false, settingsCategory: undefined }),
  toggleConsole: () => set((state) => ({ consoleOpen: !state.consoleOpen })),
  setConsoleOpen: (open) => set({ consoleOpen: open }),
  toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen, bottomPanelTab: "ai" })),
  setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
  setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),
  focusUrlBar: () => set((s) => ({ urlBarFocusCounter: s.urlBarFocusCounter + 1 })),
}));
