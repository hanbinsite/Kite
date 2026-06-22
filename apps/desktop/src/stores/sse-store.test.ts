import { describe, it, expect, beforeEach } from "vitest";
import { useSseStore, type SseStore } from "./sse-store";

const initial: SseStore = {
  connections: {},
  connect: expect.any(Function) as unknown as SseStore["connect"],
  disconnect: expect.any(Function) as unknown as SseStore["disconnect"],
  clearEvents: expect.any(Function) as unknown as SseStore["clearEvents"],
  removeConnection: expect.any(Function) as unknown as SseStore["removeConnection"],
  pushEvent: expect.any(Function) as unknown as SseStore["pushEvent"],
  setPaused: expect.any(Function) as unknown as SseStore["setPaused"],
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

function makeConn(overrides: Partial<{ status: string; url: string; events: ReturnType<typeof makeEvent>[]; error: string | null; buffer: ReturnType<typeof makeEvent>[]; paused: boolean }> = {}) {
  return {
    status: (overrides.status ?? "connected") as "connected" | "disconnected" | "connecting" | "error",
    url: overrides.url ?? "http://sse",
    events: overrides.events ?? [],
    buffer: overrides.buffer ?? [],
    paused: overrides.paused ?? false,
    error: overrides.error ?? null,
  };
}

describe("useSseStore", () => {
  it("exports a store", () => {
    expect(useSseStore).toBeDefined();
    expect(useSseStore.getState()).toMatchObject(initial);
  });

  it("clearEvents empties events and buffer for connection", () => {
    useSseStore.setState({
      connections: {
        c1: makeConn({ events: [makeEvent()], buffer: [makeEvent({ id: "b1" })] }),
      },
    });
    useSseStore.getState().clearEvents("c1");
    expect(useSseStore.getState().connections.c1?.events).toEqual([]);
    expect(useSseStore.getState().connections.c1?.buffer).toEqual([]);
  });

  it("removeConnection deletes connection", () => {
    useSseStore.setState({
      connections: {
        c1: makeConn({ status: "disconnected", url: "" }),
      },
    });
    useSseStore.getState().removeConnection("c1");
    expect(useSseStore.getState().connections.c1).toBeUndefined();
  });

  it("pushEvent appends and caps at MAX_EVENTS", () => {
    const events = Array.from({ length: 5000 }, (_, i) => makeEvent({ id: `${i}` }));
    useSseStore.setState({
      connections: {
        c1: makeConn({ events }),
      },
    });
    useSseStore.getState().pushEvent("c1", makeEvent({ id: "5000" }));
    const conn = useSseStore.getState().connections.c1;
    expect(conn?.events).toHaveLength(5000);
    expect(conn?.events[0]?.id).toBe("1");
    expect(conn?.events[4999]?.id).toBe("5000");
  });

  it("pushEvent with event=error sets status=error", () => {
    useSseStore.setState({
      connections: {
        c1: makeConn(),
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
        c1: makeConn(),
      },
    });
    useSseStore.getState().pushEvent("c1", makeEvent({ event: "disconnected" }));
    expect(useSseStore.getState().connections.c1?.status).toBe("disconnected");
  });

  it("pushEvent with regular event leaves status unchanged", () => {
    useSseStore.setState({
      connections: {
        c1: makeConn(),
      },
    });
    useSseStore.getState().pushEvent("c1", makeEvent());
    expect(useSseStore.getState().connections.c1?.status).toBe("connected");
  });

  it("pushEvent while paused buffers event instead of appending to events", () => {
    useSseStore.setState({
      connections: {
        c1: makeConn({ paused: true, events: [makeEvent({ id: "e1" })] }),
      },
    });
    useSseStore.getState().pushEvent("c1", makeEvent({ id: "b1" }));
    const conn = useSseStore.getState().connections.c1;
    expect(conn?.events).toHaveLength(1);
    expect(conn?.buffer).toHaveLength(1);
    expect(conn?.buffer[0]?.id).toBe("b1");
  });

  it("setPaused(false) flushes buffer into events", () => {
    useSseStore.setState({
      connections: {
        c1: makeConn({ paused: true, events: [], buffer: [makeEvent({ id: "b1" }), makeEvent({ id: "b2" })] }),
      },
    });
    useSseStore.getState().setPaused("c1", false);
    const conn = useSseStore.getState().connections.c1;
    expect(conn?.paused).toBe(false);
    expect(conn?.buffer).toEqual([]);
    expect(conn?.events).toHaveLength(2);
    expect(conn?.events[0]?.id).toBe("b1");
    expect(conn?.events[1]?.id).toBe("b2");
  });
});
