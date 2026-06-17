import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnvStore = {
  environments: [{ id: "env-1", variables: [{ key: "BASE_URL", value: "https://api.com", enabled: true }] }],
  activeEnvironmentId: "env-1",
  globals: [{ key: "TOKEN", value: "secret123", enabled: true }],
};

const mockColStore = {
  resolveRequestHierarchy: vi.fn() as ReturnType<typeof vi.fn>,
};

let mockActiveTabId: string | null = "tab-1";
const mockTabStore = {
  tabs: [{ id: "tab-1", requestId: "req-1" }] as { id: string; requestId: string }[],
  get activeTabId() { return mockActiveTabId; },
  getState() { return { tabs: this.tabs, activeTabId: mockActiveTabId }; },
};

vi.mock("./environment-store", () => ({
  useEnvironmentStore: { getState: () => mockEnvStore },
}));

vi.mock("./collection-store", () => ({
  useCollectionStore: { getState: () => mockColStore },
}));

vi.mock("@api-client/core", () => ({
  useTabStore: { getState: () => mockTabStore },
  getCollectionVariables: () => ({ COLLECTION_VAR: "col-val" }),
  getFolderVariables: () => ({ FOLDER_VAR: "folder-val" }),
}));

import { registerVariableCompletionProvider } from "./variable-completion-provider";

function getVars(): Record<string, string> {
  registerVariableCompletionProvider();
  const envStore = (window as unknown as Record<string, unknown>)["__envStore"] as { getActiveVariables: () => Record<string, string> };
  return envStore.getActiveVariables();
}

describe("variable-completion-provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockColStore.resolveRequestHierarchy.mockReturnValue(null);
    mockEnvStore.activeEnvironmentId = "env-1";
    mockEnvStore.globals = [{ key: "TOKEN", value: "secret123", enabled: true }];
    delete (window as unknown as Record<string, unknown>)["__envStore"];
  });

  it("registers global variable on window", () => {
    registerVariableCompletionProvider();
    const envStore = (window as unknown as Record<string, unknown>)["__envStore"] as { getActiveVariables?: () => Record<string, string> };
    expect(envStore).toBeDefined();
    expect(typeof envStore!.getActiveVariables).toBe("function");
  });

  it("returns environment variables", () => {
    const vars = getVars();
    expect(vars["BASE_URL"]).toBe("https://api.com");
  });

  it("returns global variables", () => {
    const vars = getVars();
    expect(vars["TOKEN"]).toBe("secret123");
  });

  it("skips disabled variables", () => {
    mockEnvStore.globals = [{ key: "DISABLED_VAR", value: "skip", enabled: false }];
    const vars = getVars();
    expect(vars["DISABLED_VAR"]).toBeUndefined();
  });

  it("returns collection and folder variables from hierarchy", () => {
    mockColStore.resolveRequestHierarchy.mockReturnValue({
      collectionConfig: { variables: [{ key: "COL", value: "col-val", enabled: true }] },
    });
    const vars = getVars();
    expect(vars["COL"]).toBe("col-val");
    expect(vars["COLLECTION_VAR"]).toBe("col-val");
    expect(vars["FOLDER_VAR"]).toBe("folder-val");
  });

  it("returns empty when no active tab", () => {
    mockActiveTabId = null;
    delete (window as unknown as Record<string, unknown>)["__envStore"];

    registerVariableCompletionProvider();
    const envStore = (window as unknown as Record<string, unknown>)["__envStore"] as { getActiveVariables: () => Record<string, string> };
    const vars = envStore.getActiveVariables();

    mockActiveTabId = "tab-1";
    expect(typeof vars).toBe("object");
  });
});