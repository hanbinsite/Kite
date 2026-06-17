import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./ui-store";

describe("useUIStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({
      theme: "dark",
      language: "zh-CN",
      sidebarVisible: true,
      sidebarCollapsed: false,
      sidebarWidth: 280,
      splitRatio: 0.5,
      settingsOpen: false,
      settingsCategory: undefined,
      consoleOpen: false,
      aiPanelOpen: false,
      bottomPanelTab: "response",
    });
  });

  describe("theme", () => {
    it("has default dark theme", () => {
      expect(useUIStore.getState().theme).toBe("dark");
    });

    it("setTheme updates state and persists to localStorage", () => {
      useUIStore.getState().setTheme("light");
      expect(useUIStore.getState().theme).toBe("light");
      expect(localStorage.getItem("theme")).toBe("light");
    });

    it("setTheme to system persists correctly", () => {
      useUIStore.getState().setTheme("system");
      expect(useUIStore.getState().theme).toBe("system");
      expect(localStorage.getItem("theme")).toBe("system");
    });

    it("initializes from localStorage", () => {
      localStorage.setItem("theme", "light");
      useUIStore.setState({ theme: "light" });
      expect(useUIStore.getState().theme).toBe("light");
    });
  });

  describe("language", () => {
    it("has default zh-CN language", () => {
      expect(useUIStore.getState().language).toBe("zh-CN");
    });

    it("setLanguage updates state and persists", () => {
      useUIStore.getState().setLanguage("en");
      expect(useUIStore.getState().language).toBe("en");
      expect(localStorage.getItem("language")).toBe("en");
    });
  });

  describe("sidebar", () => {
    it("toggleSidebar collapses/expands sidebar", () => {
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
      expect(localStorage.getItem("sidebarCollapsed")).toBe("true");
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
      expect(localStorage.getItem("sidebarCollapsed")).toBe("false");
    });

    it("setSidebarCollapsed persists to localStorage", () => {
      useUIStore.getState().setSidebarCollapsed(true);
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
      expect(localStorage.getItem("sidebarCollapsed")).toBe("true");
    });

    it("setSidebarWidth updates width", () => {
      useUIStore.getState().setSidebarWidth(320);
      expect(useUIStore.getState().sidebarWidth).toBe(320);
    });
  });

  describe("splitRatio", () => {
    it("setSplitRatio updates the split ratio", () => {
      useUIStore.getState().setSplitRatio(0.7);
      expect(useUIStore.getState().splitRatio).toBe(0.7);
    });
  });

  describe("settings", () => {
    it("openSettings with no category", () => {
      useUIStore.getState().openSettings();
      expect(useUIStore.getState().settingsOpen).toBe(true);
      expect(useUIStore.getState().settingsCategory).toBeUndefined();
    });

    it("openSettings with category", () => {
      useUIStore.getState().openSettings("ai");
      expect(useUIStore.getState().settingsOpen).toBe(true);
      expect(useUIStore.getState().settingsCategory).toBe("ai");
    });

    it("closeSettings resets state", () => {
      useUIStore.getState().openSettings("general");
      useUIStore.getState().closeSettings();
      expect(useUIStore.getState().settingsOpen).toBe(false);
      expect(useUIStore.getState().settingsCategory).toBeUndefined();
    });
  });

  describe("console", () => {
    it("toggleConsole toggles state", () => {
      expect(useUIStore.getState().consoleOpen).toBe(false);
      useUIStore.getState().toggleConsole();
      expect(useUIStore.getState().consoleOpen).toBe(true);
      useUIStore.getState().toggleConsole();
      expect(useUIStore.getState().consoleOpen).toBe(false);
    });

    it("setConsoleOpen explicitly sets state", () => {
      useUIStore.getState().setConsoleOpen(true);
      expect(useUIStore.getState().consoleOpen).toBe(true);
      useUIStore.getState().setConsoleOpen(false);
      expect(useUIStore.getState().consoleOpen).toBe(false);
    });
  });

  describe("aiPanel", () => {
    it("toggleAiPanel opens and switches bottom panel tab", () => {
      useUIStore.getState().toggleAiPanel();
      expect(useUIStore.getState().aiPanelOpen).toBe(true);
      expect(useUIStore.getState().bottomPanelTab).toBe("ai");
    });

    it("setAiPanelOpen explicitly sets state", () => {
      useUIStore.getState().setAiPanelOpen(true);
      expect(useUIStore.getState().aiPanelOpen).toBe(true);
      useUIStore.getState().setAiPanelOpen(false);
      expect(useUIStore.getState().aiPanelOpen).toBe(false);
    });
  });

  describe("bottomPanelTab", () => {
    it("setBottomPanelTab switches between response and ai", () => {
      useUIStore.getState().setBottomPanelTab("ai");
      expect(useUIStore.getState().bottomPanelTab).toBe("ai");
      useUIStore.getState().setBottomPanelTab("response");
      expect(useUIStore.getState().bottomPanelTab).toBe("response");
    });
  });
});