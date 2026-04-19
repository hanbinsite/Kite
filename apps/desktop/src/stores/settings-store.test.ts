import { describe, it, expect } from "vitest";

describe("settings-store", () => {
  it("should export the store factory", async () => {
    const mod = await import("./settings-store");
    expect(mod.useSettingsStore).toBeDefined();
  });

  it("should have default values", async () => {
    const { useSettingsStore } = await import("./settings-store");
    const state = useSettingsStore.getState();
    expect(state.fontSize).toBe("15");
    expect(state.timeout).toBe("30000");
    expect(state.followRedirects).toBe(true);
    expect(state.verifySSL).toBe(true);
    expect(state.autoSave).toBe(true);
    expect(state.codeFont).toBe("JetBrains Mono");
  });

  it("updateSetting should change value", async () => {
    const { useSettingsStore } = await import("./settings-store");
    useSettingsStore.getState().updateSetting("timeout", "60000");
    expect(useSettingsStore.getState().timeout).toBe("60000");
    useSettingsStore.getState().updateSetting("timeout", "30000");
  });

  it("updateSetting should persist to localStorage", async () => {
    const { useSettingsStore } = await import("./settings-store");
    useSettingsStore.getState().updateSetting("proxyUrl", "http://proxy.test:8080");
    const saved = localStorage.getItem("api-client-settings");
    expect(saved).toContain("proxy.test");
    useSettingsStore.getState().updateSetting("proxyUrl", "");
  });
});