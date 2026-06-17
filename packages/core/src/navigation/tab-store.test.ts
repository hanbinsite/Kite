import { describe, it, expect, beforeEach } from "vitest";
import { useTabStore } from "./tab-store";
import type { Tab } from "./tab-store";

function getTab(index: number): Tab {
  const tab = useTabStore.getState().tabs[index];
  expect(tab).toBeDefined();
  return tab!;
}

describe("useTabStore", () => {
  beforeEach(() => {
    useTabStore.setState({ tabs: [], activeTabId: null });
  });

  describe("initial state", () => {
    it("starts with empty tabs and null activeTabId", () => {
      const state = useTabStore.getState();
      expect(state.tabs).toEqual([]);
      expect(state.activeTabId).toBeNull();
    });
  });

  describe("openTab", () => {
    it("creates a new tab with generated id", () => {
      const id = useTabStore.getState().openTab({
        name: "Test Request",
        method: "GET",
        url: "https://example.com",
      });
      const state = useTabStore.getState();
      expect(id).toBeTruthy();
      expect(state.tabs).toHaveLength(1);
      const tab = getTab(0);
      expect(tab.id).toBe(id);
      expect(tab.name).toBe("Test Request");
      expect(tab.method).toBe("GET");
      expect(tab.url).toBe("https://example.com");
      expect(tab.isModified).toBe(false);
      expect(state.activeTabId).toBe(id);
    });

    it("deduplicates by requestId", () => {
      const first = useTabStore.getState().openTab({
        name: "Req",
        method: "POST",
        url: "",
        requestId: "req-123",
      });
      const second = useTabStore.getState().openTab({
        name: "Req",
        method: "POST",
        url: "",
        requestId: "req-123",
      });
      expect(second).toBe(first);
      expect(useTabStore.getState().tabs).toHaveLength(1);
      expect(useTabStore.getState().activeTabId).toBe(first);
    });

    it("deduplicates by url and method when no requestId", () => {
      const first = useTabStore.getState().openTab({
        name: "A",
        method: "GET",
        url: "https://api.example.com/users",
      });
      const second = useTabStore.getState().openTab({
        name: "B",
        method: "GET",
        url: "https://api.example.com/users",
      });
      expect(second).toBe(first);
      expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it("deduplicates by name and method when no url or requestId", () => {
      const first = useTabStore.getState().openTab({
        name: "New WS",
        method: "WS",
        url: "",
      });
      const second = useTabStore.getState().openTab({
        name: "New WS",
        method: "WS",
        url: "",
      });
      expect(second).toBe(first);
      expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it("deduplicates collection-config tabs by collectionId and folderId", () => {
      const first = useTabStore.getState().openTab({
        name: "Config",
        method: "GET",
        url: "",
        protocol: "collection-config",
        meta: { collectionId: "col-1", folderId: "folder-a" },
      });
      const second = useTabStore.getState().openTab({
        name: "Config",
        method: "GET",
        url: "",
        protocol: "collection-config",
        meta: { collectionId: "col-1", folderId: "folder-a" },
      });
      expect(second).toBe(first);
      expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it("does NOT deduplicate collection-config with different folderId", () => {
      const first = useTabStore.getState().openTab({
        name: "Config",
        method: "GET",
        url: "",
        protocol: "collection-config",
        meta: { collectionId: "col-1", folderId: "folder-a" },
      });
      const second = useTabStore.getState().openTab({
        name: "Config",
        method: "GET",
        url: "",
        protocol: "collection-config",
        meta: { collectionId: "col-1", folderId: "folder-b" },
      });
      expect(second).not.toBe(first);
      expect(useTabStore.getState().tabs).toHaveLength(2);
    });

    it("creates different tabs for different methods on same URL", () => {
      const first = useTabStore.getState().openTab({
        name: "A",
        method: "GET",
        url: "https://api.example.com/users",
      });
      const second = useTabStore.getState().openTab({
        name: "B",
        method: "POST",
        url: "https://api.example.com/users",
      });
      expect(second).not.toBe(first);
      expect(useTabStore.getState().tabs).toHaveLength(2);
    });
  });

  describe("closeTab", () => {
    it("removes tab and selects previous tab if active tab is closed", () => {
      const first = useTabStore.getState().openTab({
        name: "First", method: "GET", url: "https://example.com/1",
      });
      const second = useTabStore.getState().openTab({
        name: "Second", method: "GET", url: "https://example.com/2",
      });
      useTabStore.getState().closeTab(second);
      const state = useTabStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.activeTabId).toBe(first);
    });

    it("keeps activeTabId if closing non-active tab", () => {
      const first = useTabStore.getState().openTab({
        name: "First", method: "GET", url: "https://example.com/1",
      });
      useTabStore.getState().openTab({
        name: "Second", method: "GET", url: "https://example.com/2",
      });
      useTabStore.getState().setActiveTab(first);
      const otherTab = getTab(1);
      useTabStore.getState().closeTab(otherTab.id);
      expect(useTabStore.getState().activeTabId).toBe(first);
    });
  });

  describe("closeOtherTabs", () => {
    it("keeps only the specified tab", () => {
      useTabStore.getState().openTab({
        name: "A", method: "GET", url: "https://a.com",
      });
      const keep = useTabStore.getState().openTab({
        name: "B", method: "POST", url: "https://b.com",
      });
      useTabStore.getState().openTab({
        name: "C", method: "PUT", url: "https://c.com",
      });
      useTabStore.getState().closeOtherTabs(keep);
      const state = useTabStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0]!.id).toBe(keep);
      expect(state.activeTabId).toBe(keep);
    });
  });

  describe("closeAllTabs", () => {
    it("clears all tabs and activeTabId", () => {
      useTabStore.getState().openTab({
        name: "A", method: "GET", url: "https://a.com",
      });
      useTabStore.getState().openTab({
        name: "B", method: "GET", url: "https://b.com",
      });
      useTabStore.getState().closeAllTabs();
      expect(useTabStore.getState().tabs).toEqual([]);
      expect(useTabStore.getState().activeTabId).toBeNull();
    });
  });

  describe("setActiveTab", () => {
    it("switches active tab", () => {
      const first = useTabStore.getState().openTab({
        name: "A", method: "GET", url: "https://a.com",
      });
      const second = useTabStore.getState().openTab({
        name: "B", method: "GET", url: "https://b.com",
      });
      useTabStore.getState().setActiveTab(first);
      expect(useTabStore.getState().activeTabId).toBe(first);
      useTabStore.getState().setActiveTab(second);
      expect(useTabStore.getState().activeTabId).toBe(second);
    });
  });

  describe("updateTab", () => {
    it("merges partial updates", () => {
      const id = useTabStore.getState().openTab({
        name: "Original", method: "GET", url: "https://example.com",
      });
      useTabStore.getState().updateTab(id, {
        method: "POST",
        url: "https://example.com/updated",
      });
      const tab = getTab(0);
      expect(tab.method).toBe("POST");
      expect(tab.url).toBe("https://example.com/updated");
      expect(tab.name).toBe("Original");
    });

    it("does nothing for non-existent tab id", () => {
      useTabStore.getState().openTab({
        name: "A", method: "GET", url: "https://a.com",
      });
      useTabStore.getState().updateTab("nonexistent", { name: "Ghost" });
      const tab = getTab(0);
      expect(tab.name).toBe("A");
    });
  });

  describe("protocol support", () => {
    it("stores websocket protocol", () => {
      useTabStore.getState().openTab({
        name: "WS Chat", method: "GET", url: "wss://echo.test",
        protocol: "websocket",
      });
      expect(getTab(0).protocol).toBe("websocket");
    });

    it("stores sse protocol", () => {
      useTabStore.getState().openTab({
        name: "Events", method: "GET", url: "https://events.test",
        protocol: "sse",
      });
      expect(getTab(0).protocol).toBe("sse");
    });

    it("stores mqtt protocol", () => {
      useTabStore.getState().openTab({
        name: "MQTT", method: "GET", url: "mqtt://broker.test",
        protocol: "mqtt",
      });
      expect(getTab(0).protocol).toBe("mqtt");
    });

    it("stores grpc protocol", () => {
      useTabStore.getState().openTab({
        name: "gRPC", method: "POST", url: "grpc://svc.test",
        protocol: "grpc",
      });
      expect(getTab(0).protocol).toBe("grpc");
    });

    it("stores mock protocol", () => {
      useTabStore.getState().openTab({
        name: "Mock", method: "GET", url: "",
        protocol: "mock",
      });
      expect(getTab(0).protocol).toBe("mock");
    });
  });

  describe("tab metadata", () => {
    it("stores collection and folder metadata", () => {
      useTabStore.getState().openTab({
        name: "Nested",
        method: "GET",
        url: "https://example.com",
        meta: { collectionId: "col-99", folderId: "f-1", folderPath: ["Users", "Auth"] },
      });
      const tab = getTab(0);
      expect(tab.meta?.collectionId).toBe("col-99");
      expect(tab.meta?.folderId).toBe("f-1");
      expect(tab.meta?.folderPath).toEqual(["Users", "Auth"]);
    });
  });
});