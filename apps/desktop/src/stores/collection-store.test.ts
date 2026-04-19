const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("collection-store", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("should export the store factory", async () => {
    const mod = await import("./collection-store");
    expect(mod.useCollectionStore).toBeDefined();
  });

  it("should load default collection when disk is empty", async () => {
    const { useCollectionStore } = await import("./collection-store");
    invoke.mockResolvedValue([]);
    await useCollectionStore.getState().loadFromDisk();
    const state = useCollectionStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.collections.length).toBeGreaterThanOrEqual(1);
  });

  it("addCollection should add a new collection", async () => {
    const { useCollectionStore } = await import("./collection-store");
    invoke.mockResolvedValue([]);
    await useCollectionStore.getState().loadFromDisk();
    invoke.mockResolvedValue(undefined);
    const prevLen = useCollectionStore.getState().collections.length;
    useCollectionStore.getState().addCollection("col-test", "Test Collection");
    expect(useCollectionStore.getState().collections.length).toBe(prevLen + 1);
    const col = useCollectionStore.getState().collections.find((c) => c.id === "col-test");
    expect(col?.name).toBe("Test Collection");
    expect(col?.requests.length).toBe(0);
  });

  it("deleteCollection should remove a collection", async () => {
    const { useCollectionStore } = await import("./collection-store");
    invoke.mockResolvedValue([]);
    await useCollectionStore.getState().loadFromDisk();
    invoke.mockResolvedValue(undefined);
    useCollectionStore.getState().addCollection("col-del", "ToDelete");
    useCollectionStore.getState().deleteCollection("col-del");
    expect(useCollectionStore.getState().collections.find((c) => c.id === "col-del")).toBeUndefined();
  });

  it("renameCollection should update name", async () => {
    const { useCollectionStore } = await import("./collection-store");
    invoke.mockResolvedValue([]);
    await useCollectionStore.getState().loadFromDisk();
    invoke.mockResolvedValue(undefined);
    useCollectionStore.getState().addCollection("col-rename", "Original");
    useCollectionStore.getState().renameCollection("col-rename", "Renamed");
    const col = useCollectionStore.getState().collections.find((c) => c.id === "col-rename");
    expect(col?.name).toBe("Renamed");
  });

  it("addRequestToCollection should add request", async () => {
    const { useCollectionStore } = await import("./collection-store");
    invoke.mockResolvedValue([]);
    await useCollectionStore.getState().loadFromDisk();
    invoke.mockResolvedValue(undefined);
    useCollectionStore.getState().addCollection("col-req", "ReqTest");
    useCollectionStore.getState().addRequestToCollection("col-req", {
      id: "req-1",
      method: "GET",
      name: "Get Users",
      url: "https://api.example.com/users",
    });
    const col = useCollectionStore.getState().collections.find((c) => c.id === "col-req");
    expect(col!.requests).toHaveLength(1);
    expect(col!.requests[0]!.name).toBe("Get Users");
  });

  it("deleteRequest should remove request from collection", async () => {
    const { useCollectionStore } = await import("./collection-store");
    invoke.mockResolvedValue([]);
    await useCollectionStore.getState().loadFromDisk();
    invoke.mockResolvedValue(undefined);
    useCollectionStore.getState().addCollection("col-dr", "DelReqTest");
    useCollectionStore.getState().addRequestToCollection("col-dr", {
      id: "req-dr",
      method: "GET",
      name: "DelReq",
      url: "",
    });
    useCollectionStore.getState().deleteRequest("col-dr", "req-dr");
    const col = useCollectionStore.getState().collections.find((c) => c.id === "col-dr");
    expect(col?.requests.length).toBe(0);
  });

  it("renameRequest should update request name", async () => {
    const { useCollectionStore } = await import("./collection-store");
    invoke.mockResolvedValue([]);
    await useCollectionStore.getState().loadFromDisk();
    invoke.mockResolvedValue(undefined);
    useCollectionStore.getState().addCollection("col-rn", "RenameReqTest");
    useCollectionStore.getState().addRequestToCollection("col-rn", {
      id: "req-rn",
      method: "POST",
      name: "Original",
      url: "",
    });
    useCollectionStore.getState().renameRequest("col-rn", "req-rn", "Renamed");
    const col = useCollectionStore.getState().collections.find((c) => c.id === "col-rn");
    expect(col!.requests[0]!.name).toBe("Renamed");
  });

  it("duplicateRequest should copy request with new id", async () => {
    const { useCollectionStore } = await import("./collection-store");
    invoke.mockResolvedValue([]);
    await useCollectionStore.getState().loadFromDisk();
    invoke.mockResolvedValue(undefined);
    useCollectionStore.getState().addCollection("col-dup", "DupTest");
    useCollectionStore.getState().addRequestToCollection("col-dup", {
      id: "req-dup",
      method: "GET",
      name: "Original",
      url: "https://api.example.com",
    });
    useCollectionStore.getState().duplicateRequest("col-dup", "req-dup");
    const col = useCollectionStore.getState().collections.find((c) => c.id === "col-dup");
    expect(col!.requests).toHaveLength(2);
    expect(col!.requests[1]!.name).toBe("Original (copy)");
    expect(col!.requests[1]!.id).not.toBe("req-dup");
  });
});