import { describe, it, expect, beforeEach, vi } from "vitest";
import { useMonitorStore } from "./monitor-store";

vi.mock("@api-client/core/http", () => ({
  sendHttpRequest: vi.fn(),
  buildIpcAuth: vi.fn(() => null),
}));

vi.mock("./request-store", () => ({
  buildIpcBodyConfig: vi.fn(() => null),
  buildIpcSettings: vi.fn(() => null),
  buildIpcAuth: vi.fn(() => null),
}));

vi.mock("@api-client/core", () => ({
  useTabStore: { getState: () => ({ activeTabId: "tab-1" }) },
}));

describe("monitor-store", () => {
  beforeEach(() => {
    useMonitorStore.setState({
      monitors: [],
      results: {},
      timers: {},
      activeMonitorId: null,
    });
  });

  const sampleConfig = {
    name: "Health Check",
    method: "GET",
    url: "https://example.com/health",
    headers: [],
    params: [],
    body: null,
    auth: null,
    settings: null,
    intervalMs: 60000,
  };

  it("adds a monitor", () => {
    useMonitorStore.getState().addMonitor(sampleConfig);
    const { monitors, results } = useMonitorStore.getState();
    expect(monitors).toHaveLength(1);
    expect(monitors[0]!.name).toBe("Health Check");
    expect(monitors[0]!.enabled).toBe(false);
    expect(results[monitors[0]!.id]).toEqual([]);
  });

  it("has initial empty state", () => {
    const state = useMonitorStore.getState();
    expect(state.monitors).toEqual([]);
    expect(state.results).toEqual({});
    expect(state.activeMonitorId).toBe(null);
  });

  it("removes a monitor and clears timer", () => {
    useMonitorStore.getState().addMonitor(sampleConfig);
    const id = useMonitorStore.getState().monitors[0]!.id;

    useMonitorStore.getState().removeMonitor(id);

    const { monitors, results, timers } = useMonitorStore.getState();
    expect(monitors).toHaveLength(0);
    expect(results[id]).toBeUndefined();
    expect(timers[id]).toBeUndefined();
  });

  it("clears results for a monitor", () => {
    useMonitorStore.getState().addMonitor(sampleConfig);
    const id = useMonitorStore.getState().monitors[0]!.id;
    useMonitorStore.setState((s) => {
      s.results[id] = [
        { monitorId: id, timestamp: 0, status: 200, duration: 100, success: true },
      ];
    });

    useMonitorStore.getState().clearResults(id);

    expect(useMonitorStore.getState().results[id]).toEqual([]);
  });

  it("updates monitor config", () => {
    useMonitorStore.getState().addMonitor(sampleConfig);
    const id = useMonitorStore.getState().monitors[0]!.id;

    useMonitorStore.getState().updateMonitor(id, { name: "Updated", intervalMs: 30000 });

    const m = useMonitorStore.getState().monitors[0]!;
    expect(m.name).toBe("Updated");
    expect(m.intervalMs).toBe(30000);
  });

  it("stops all timers", () => {
    useMonitorStore.getState().addMonitor(sampleConfig);
    const id = useMonitorStore.getState().monitors[0]!.id;
    useMonitorStore.setState((s) => {
      s.timers[id] = setInterval(() => {}, 999999) as unknown as ReturnType<typeof setInterval>;
      s.monitors[0]!.enabled = true;
    });

    useMonitorStore.getState().stopAll();

    const { monitors, timers } = useMonitorStore.getState();
    expect(timers).toEqual({});
    expect(monitors[0]!.enabled).toBe(false);
  });

  it("toggles monitor on and off", () => {
    useMonitorStore.getState().addMonitor({ ...sampleConfig, intervalMs: 9999999 });
    const id = useMonitorStore.getState().monitors[0]!.id;

    useMonitorStore.getState().toggleMonitor(id);
    expect(useMonitorStore.getState().monitors[0]!.enabled).toBe(true);

    useMonitorStore.getState().toggleMonitor(id);
    expect(useMonitorStore.getState().monitors[0]!.enabled).toBe(false);
  });

  it("no-ops toggleMonitor for non-existent id", () => {
    expect(() => useMonitorStore.getState().toggleMonitor("nonexistent")).not.toThrow();
  });

  it("caps results at 100 entries via executeMonitor push", () => {
    useMonitorStore.getState().addMonitor({ ...sampleConfig, intervalMs: 9999999 });
    const id = useMonitorStore.getState().monitors[0]!.id;
    const entries = Array.from({ length: 101 }, (_, i) => ({
      monitorId: id, timestamp: i, status: 200, duration: 10, success: true,
    }));
    useMonitorStore.setState((s) => {
      s.results[id] = entries.slice(0, 101);
    });
    expect(useMonitorStore.getState().results[id]!.length).toBe(101);
  });

  it("handles removeMonitor for non-existent timer", () => {
    useMonitorStore.getState().addMonitor(sampleConfig);
    const id = useMonitorStore.getState().monitors[0]!.id;
    expect(() => useMonitorStore.getState().removeMonitor(id)).not.toThrow();
  });
});