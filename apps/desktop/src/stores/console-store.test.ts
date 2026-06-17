import { describe, it, expect, beforeEach } from "vitest";
import { useConsoleStore } from "./console-store";

describe("console-store", () => {
  beforeEach(() => {
    useConsoleStore.setState({ entries: {} });
  });

  it("starts with empty entries", () => {
    expect(useConsoleStore.getState().entries).toEqual({});
  });

  it("adds log entry to a tab", () => {
    useConsoleStore.getState().addEntry("tab-1", { level: "log", message: "hello" });
    const entries = useConsoleStore.getState().getEntries("tab-1");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe("log");
    expect(entries[0]!.message).toBe("hello");
    expect(entries[0]!.tabId).toBe("tab-1");
    expect(entries[0]!.id).toBeTruthy();
    expect(entries[0]!.timestamp).toBeGreaterThan(0);
  });

  it("adds error entry", () => {
    useConsoleStore.getState().addEntry("tab-1", { level: "error", message: "boom" });
    expect(useConsoleStore.getState().getEntries("tab-1")[0]!.level).toBe("error");
  });

  it("adds warn entry", () => {
    useConsoleStore.getState().addEntry("tab-1", { level: "warn", message: "careful" });
    expect(useConsoleStore.getState().getEntries("tab-1")[0]!.level).toBe("warn");
  });

  it("adds info entry", () => {
    useConsoleStore.getState().addEntry("tab-1", { level: "info", message: "fyi" });
    expect(useConsoleStore.getState().getEntries("tab-1")[0]!.level).toBe("info");
  });

  it("stores source metadata", () => {
    useConsoleStore.getState().addEntry("tab-1", {
      level: "log",
      message: "script done",
      source: "pre-request",
    });
    expect(useConsoleStore.getState().getEntries("tab-1")[0]!.source).toBe("pre-request");
  });

  it("isolates entries per tab", () => {
    useConsoleStore.getState().addEntry("tab-1", { level: "log", message: "a" });
    useConsoleStore.getState().addEntry("tab-2", { level: "error", message: "b" });
    expect(useConsoleStore.getState().getEntries("tab-1")).toHaveLength(1);
    expect(useConsoleStore.getState().getEntries("tab-2")).toHaveLength(1);
    expect(useConsoleStore.getState().getEntries("tab-1")[0]!.message).toBe("a");
    expect(useConsoleStore.getState().getEntries("tab-2")[0]!.message).toBe("b");
  });

  it("clears entries for a tab", () => {
    useConsoleStore.getState().addEntry("tab-1", { level: "log", message: "x" });
    useConsoleStore.getState().addEntry("tab-1", { level: "log", message: "y" });
    useConsoleStore.getState().clearEntries("tab-1");
    expect(useConsoleStore.getState().getEntries("tab-1")).toEqual([]);
  });

  it("clearing one tab does not affect another", () => {
    useConsoleStore.getState().addEntry("tab-1", { level: "log", message: "keep" });
    useConsoleStore.getState().addEntry("tab-2", { level: "log", message: "clear" });
    useConsoleStore.getState().clearEntries("tab-2");
    expect(useConsoleStore.getState().getEntries("tab-1")).toHaveLength(1);
    expect(useConsoleStore.getState().getEntries("tab-2")).toEqual([]);
  });

  it("returns empty array for unknown tab", () => {
    expect(useConsoleStore.getState().getEntries("nonexistent")).toEqual([]);
  });
});