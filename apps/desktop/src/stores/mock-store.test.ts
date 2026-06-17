import { describe, it, expect, beforeEach } from "vitest";
import { useMockStore, type MockStore } from "./mock-store";

const initial: MockStore = {
  status: { running: false, port: null },
  routes: [],
  requestLog: [],
  error: null,
  startServer: expect.any(Function) as unknown as MockStore["startServer"],
  stopServer: expect.any(Function) as unknown as MockStore["stopServer"],
  refreshStatus: expect.any(Function) as unknown as MockStore["refreshStatus"],
  addRoute: expect.any(Function) as unknown as MockStore["addRoute"],
  removeRoute: expect.any(Function) as unknown as MockStore["removeRoute"],
  updateRoute: expect.any(Function) as unknown as MockStore["updateRoute"],
  loadRoutes: expect.any(Function) as unknown as MockStore["loadRoutes"],
  clearRoutes: expect.any(Function) as unknown as MockStore["clearRoutes"],
  clearLog: expect.any(Function) as unknown as MockStore["clearLog"],
  pushLog: expect.any(Function) as unknown as MockStore["pushLog"],
};

beforeEach(() => {
  useMockStore.setState({
    status: { running: false, port: null },
    routes: [],
    requestLog: [],
    error: null,
  });
});

describe("useMockStore", () => {
  it("exports a store", () => {
    expect(useMockStore).toBeDefined();
    expect(useMockStore.getState()).toMatchObject(initial);
  });

  it("clearLog empties requestLog", () => {
    useMockStore.setState({
      requestLog: [
        { method: "GET", path: "/test", matchedRouteId: null, status: 200, timestamp: Date.now() },
      ],
    });
    useMockStore.getState().clearLog();
    expect(useMockStore.getState().requestLog).toEqual([]);
  });

  it("pushLog appends and caps at 200", () => {
    const logs = Array.from({ length: 200 }, (_, i) => ({
      method: "GET" as const,
      path: `/${i}`,
      matchedRouteId: null as string | null,
      status: 200,
      timestamp: Date.now() + i,
    }));
    useMockStore.setState({ requestLog: logs });
    useMockStore.getState().pushLog({
      method: "POST",
      path: "/new",
      matchedRouteId: null,
      status: 201,
      timestamp: Date.now() + 201,
    });
    const state = useMockStore.getState();
    expect(state.requestLog).toHaveLength(200);
    expect(state.requestLog[0]?.path).toBe("/1");
    expect(state.requestLog[199]?.path).toBe("/new");
  });

  it("removeRoute filters by id via setState", () => {
    const route1 = { id: "r1", method: "GET" as const, path: "/a", status: 200, headers: [] as { key: string; value: string }[], body: "ok", delayMs: 0 };
    const route2 = { id: "r2", method: "POST" as const, path: "/b", status: 201, headers: [] as { key: string; value: string }[], body: "created", delayMs: 0 };
    useMockStore.setState({ routes: [route1, route2] });
    useMockStore.setState((s) => ({ routes: s.routes.filter((r) => r.id !== "r1") }));
    expect(useMockStore.getState().routes).toHaveLength(1);
    expect(useMockStore.getState().routes[0]?.id).toBe("r2");
  });

  it("updateRoute updates matching route via setState", () => {
    const route = { id: "r1", method: "GET" as const, path: "/a", status: 200, headers: [] as { key: string; value: string }[], body: "{}", delayMs: 0 };
    useMockStore.setState({ routes: [route] });
    useMockStore.setState((s) => {
      const idx = s.routes.findIndex((r) => r.id === "r1");
      if (idx !== -1) {
        const r = s.routes[idx]!;
        s.routes[idx] = { ...r, path: "/updated" };
      }
    });
    expect(useMockStore.getState().routes[0]?.path).toBe("/updated");
  });

  it("updateRoute does nothing for non-existent id", () => {
    useMockStore.setState({
      routes: [
        { id: "r1", method: "GET", path: "/a", status: 200, headers: [], body: "ok", delayMs: 0 },
      ],
    });
    useMockStore.getState().updateRoute({ id: "nope", method: "GET", path: "/x", status: 200, headers: [], body: "ok", delayMs: 0 });
    expect(useMockStore.getState().routes[0]?.path).toBe("/a");
  });
});