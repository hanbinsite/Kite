const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("environment-store", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("should export the store factory", async () => {
    const mod = await import("./environment-store");
    expect(mod.useEnvironmentStore).toBeDefined();
  });

  it("should start empty and become loaded after loadFromDisk with no disk data", async () => {
    const { useEnvironmentStore } = await import("./environment-store");
    invoke.mockResolvedValue([]);
    await useEnvironmentStore.getState().loadFromDisk();
    const state = useEnvironmentStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.environments.length).toBeGreaterThanOrEqual(3);
    expect(state.globals.length).toBeGreaterThanOrEqual(1);
  });

  it("setActiveEnvironment should update active id", async () => {
    const { useEnvironmentStore } = await import("./environment-store");
    invoke.mockResolvedValue([]);
    await useEnvironmentStore.getState().loadFromDisk();
    const env = useEnvironmentStore.getState().environments[0];
    useEnvironmentStore.getState().setActiveEnvironment(env!.id);
    expect(useEnvironmentStore.getState().activeEnvironmentId).toBe(env!.id);
  });

  it("getVariable should resolve from active environment", async () => {
    const { useEnvironmentStore } = await import("./environment-store");
    invoke.mockResolvedValue([]);
    await useEnvironmentStore.getState().loadFromDisk();
    useEnvironmentStore.getState().addEnvironment({
      id: "env-getvar",
      name: "Dev",
      variables: [{ key: "base_url", value: "http://localhost:3000", enabled: true }],
      isActive: false,
    });
    useEnvironmentStore.getState().setActiveEnvironment("env-getvar");
    const val = useEnvironmentStore.getState().getVariable("base_url");
    expect(val).toBe("http://localhost:3000");
  });

  it("getVariable should return undefined for unknown keys", async () => {
    const { useEnvironmentStore } = await import("./environment-store");
    invoke.mockResolvedValue([]);
    await useEnvironmentStore.getState().loadFromDisk();
    const val = useEnvironmentStore.getState().getVariable("nonexistent_var");
    expect(val).toBeUndefined();
  });

  it("addEnvironment should add a new env", async () => {
    const { useEnvironmentStore } = await import("./environment-store");
    invoke.mockResolvedValue([]);
    await useEnvironmentStore.getState().loadFromDisk();
    const prevLen = useEnvironmentStore.getState().environments.length;
    useEnvironmentStore.getState().addEnvironment({
      id: "env-test",
      name: "Test",
      variables: [],
      isActive: false,
    });
    expect(useEnvironmentStore.getState().environments.length).toBe(prevLen + 1);
  });

  it("deleteEnvironment should remove env and clear active if it was active", async () => {
    const { useEnvironmentStore } = await import("./environment-store");
    invoke.mockResolvedValue([]);
    await useEnvironmentStore.getState().loadFromDisk();
    invoke.mockResolvedValue(undefined);
    useEnvironmentStore.getState().addEnvironment({
      id: "env-del",
      name: "ToDelete",
      variables: [],
      isActive: false,
    });
    useEnvironmentStore.getState().setActiveEnvironment("env-del");
    useEnvironmentStore.getState().deleteEnvironment("env-del");
    expect(useEnvironmentStore.getState().environments.find((e) => e.id === "env-del")).toBeUndefined();
    expect(useEnvironmentStore.getState().activeEnvironmentId).toBeNull();
  });

  it("setGlobalVariable should update existing global", async () => {
    const { useEnvironmentStore } = await import("./environment-store");
    invoke.mockResolvedValue([]);
    await useEnvironmentStore.getState().loadFromDisk();
    useEnvironmentStore.getState().setGlobalVariable("timestamp", "1234567890");
    const g = useEnvironmentStore.getState().globals.find((v) => v.key === "timestamp");
    expect(g?.value).toBe("1234567890");
  });

  it("setGlobalVariable should add new global if not existing", async () => {
    const { useEnvironmentStore } = await import("./environment-store");
    invoke.mockResolvedValue([]);
    await useEnvironmentStore.getState().loadFromDisk();
    useEnvironmentStore.getState().setGlobalVariable("new_global", "value123");
    const g = useEnvironmentStore.getState().globals.find((v) => v.key === "new_global");
    expect(g?.value).toBe("value123");
    expect(g?.enabled).toBe(true);
  });
});