import { describe, it, expect, beforeEach } from "vitest";
import { useSseStore, type SseStore } from "./sse-store";

const initial: SseStore = {
  connections: {},
  connect: expect.any(Function) as unknown as SseStore["connect"],
  disconnect: expect.any(Function) as unknown as SseStore["disconnect"],
  clearEvents: expect.any(Function) as unknown as SseStore["clearEvents"],
  removeConnection: expect.any(Function) as unknown as SseStore["removeConnection"],
  pushEvent: expect.any(Function) as unknown as SseStore["pushEvent"],
};

beforeEach(() => {
  useSseStore.setState({ connections: {} });
});

function makeEvent(overrides: Partial<{ event: string; data: string; id: string | null; connectionId: string }> = {}) {
  return {
    connectionId: overrides.connectionId ?? "c1",
    event: overrides.event ?? "message",
    data: overrides.data ?? "ok",
    id: overrides.id ?? "1",
    timestamp: Date.now(),
  };
}

describe("useSseStore", () => {
  it("exports a store", () => {
    expect(useSseStore).toBeDefined();
    expect(useSseStore.getState()).toMatchObject(initial);
  });

  it("clearEvents empties events for connection", () => {
    useSseStore.setState({
      connections: {
        c1: {
          status: "connected",
          url: "http://example.com/sse",
          events: [makeEvent()],
          error: null,
        },
      },
    });
    useSseStore.getState().clearEvents("c1");
    expect(useSseStore.getState().connections.c1?.events).toEqual([]);
  });

  it("removeConnection deletes connection", () => {
    useSseStore.setState({
      connections: {
        c1: { status: "disconnected", url: "", events: [], error: null },
      },
    });
    useSseStore.getState().removeConnection("c1");
    expect(useSseStore.getState().connections.c1).toBeUndefined();
  });

  it("pushEvent appends and caps at 200", () => {
    const events = Array.from({ length: 200 }, (_, i) => makeEvent({ id: `${i}` }));
    useSseStore.setState({
      connections: {
        c1: { status: "connected", url: "http://sse", events, error: null },
      },
    });
    useSseStore.getState().pushEvent("c1", makeEvent({ id: "200" }));
    const conn = useSseStore.getState().connections.c1;
    expect(conn?.events).toHaveLength(200);
    expect(conn?.events[0]?.id).toBe("1");
    expect(conn?.events[199]?.id).toBe("200");
  });

  it("pushEvent with event=error sets status=error", () => {
    useSseStore.setState({
      connections: {
        c1: { status: "connected", url: "http://sse", events: [], error: null },
      },
    });
    useSseStore.getState().pushEvent("c1", makeEvent({ event: "error", data: "something went wrong" }));
    const conn = useSseStore.getState().connections.c1;
    expect(conn?.status).toBe("error");
    expect(conn?.error).toBe("something went wrong");
  });

  it("pushEvent with event=disconnected sets status=disconnected", () => {
    useSseStore.setState({
      connections: {
        c1: { status: "connected", url: "http://sse", events: [], error: null },
      },
    });
    useSseStore.getState().pushEvent("c1", makeEvent({ event: "disconnected" }));
    expect(useSseStore.getState().connections.c1?.status).toBe("disconnected");
  });

  it("pushEvent with regular event leaves status unchanged", () => {
    useSseStore.setState({
      connections: {
        c1: { status: "connected", url: "http://sse", events: [], error: null },
      },
    });
    useSseStore.getState().pushEvent("c1", makeEvent());
    expect(useSseStore.getState().connections.c1?.status).toBe("connected");
  });
});