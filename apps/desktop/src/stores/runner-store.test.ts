import { describe, it, expect, beforeEach } from "vitest";
import { useRunnerStore } from "./runner-store";
import type { RunnerConfig } from "./runner-store";

function makeRunnerConfig(): RunnerConfig {
  return {
    collectionId: "col-1",
    collectionName: "Test Collection",
    environmentId: "env-1",
    iterationCount: 1,
    delayMs: 0,
    persistVariables: false,
    requests: [],
  };
}

describe("runner-store", () => {
  beforeEach(() => {
    useRunnerStore.getState().resetRunner();
  });

  it("starts with idle status", () => {
    expect(useRunnerStore.getState().status).toBe("idle");
    expect(useRunnerStore.getState().config).toBeNull();
    expect(useRunnerStore.getState().result).toBeNull();
    expect(useRunnerStore.getState().currentIteration).toBe(0);
    expect(useRunnerStore.getState().currentRequestIndex).toBe(0);
    expect(useRunnerStore.getState().abortController).toBeNull();
    expect(useRunnerStore.getState().selectedResultDetail).toBeNull();
  });

  it("startRun transitions to running", () => {
    useRunnerStore.getState().startRun(makeRunnerConfig());
    const state = useRunnerStore.getState();
    expect(state.status).toBe("running");
    expect(state.config).not.toBeNull();
    expect(state.config!.collectionId).toBe("col-1");
    expect(state.result).not.toBeNull();
    expect(state.result!.id).toMatch(/^run-/);
    expect(state.abortController).not.toBeNull();
    expect(state.selectedResultDetail).toBeNull();
  });

  it("startRun initializes result structure", () => {
    useRunnerStore.getState().startRun(makeRunnerConfig());
    const result = useRunnerStore.getState().result!;
    expect(result.collectionId).toBe("col-1");
    expect(result.collectionName).toBe("Test Collection");
    expect(result.totalRequests).toBe(0);
    expect(result.passedRequests).toBe(0);
    expect(result.failedRequests).toBe(0);
    expect(result.iterations).toEqual([]);
    expect(result.startTime).toBeGreaterThan(0);
    expect(result.endTime).toBe(0);
  });

  it("cancelRun sets cancelled status", () => {
    useRunnerStore.getState().startRun(makeRunnerConfig());
    useRunnerStore.getState().cancelRun();
    const state = useRunnerStore.getState();
    expect(state.status).toBe("cancelled");
    expect(state.abortController).toBeNull();
    if (state.result) {
      expect(state.result.endTime).toBeGreaterThan(0);
      expect(state.result.duration).toBeGreaterThanOrEqual(0);
    }
  });

  it("resetRunner sets back to idle", () => {
    useRunnerStore.getState().startRun(makeRunnerConfig());
    useRunnerStore.getState().resetRunner();
    const state = useRunnerStore.getState();
    expect(state.status).toBe("idle");
    expect(state.config).toBeNull();
    expect(state.result).toBeNull();
    expect(state.currentIteration).toBe(0);
    expect(state.currentRequestIndex).toBe(0);
    expect(state.abortController).toBeNull();
    expect(state.selectedResultDetail).toBeNull();
  });

  it("setSelectedResultDetail stores and clears", () => {
    const detail = { iteration: 0, requestIndex: 2 };
    useRunnerStore.getState().setSelectedResultDetail(detail);
    expect(useRunnerStore.getState().selectedResultDetail).toEqual(detail);

    useRunnerStore.getState().setSelectedResultDetail(null);
    expect(useRunnerStore.getState().selectedResultDetail).toBeNull();
  });

  it("startRun creates unique run IDs", async () => {
    useRunnerStore.getState().startRun(makeRunnerConfig());
    const id1 = useRunnerStore.getState().result!.id;
    useRunnerStore.getState().resetRunner();
    // Allow time to pass for unique timestamp-based ID
    await new Promise((r) => setTimeout(r, 1));
    useRunnerStore.getState().startRun(makeRunnerConfig());
    const id2 = useRunnerStore.getState().result!.id;
    expect(id1).not.toBe(id2);
  });

  it("cancelRun sets endTime on result", () => {
    useRunnerStore.getState().startRun(makeRunnerConfig());
    // Simulate partial progress
    const initialResult = useRunnerStore.getState().result!;
    expect(initialResult.endTime).toBe(0);

    useRunnerStore.getState().cancelRun();
    const finalResult = useRunnerStore.getState().result;
    if (finalResult) {
      expect(finalResult.endTime).toBeGreaterThan(0);
      expect(finalResult.duration).toBeGreaterThanOrEqual(0);
    }
  });
});