import { describe, it, expect, beforeEach } from "vitest";
import { useWsStore, type WsStore } from "./websocket-store";

const initial: WsStore = {
  connections: {},
  connect: expect.any(Function) as unknown as WsStore["connect"],
  send: expect.any(Function) as unknown as WsStore["send"],
  sendBinary: expect.any(Function) as unknown as WsStore["sendBinary"],
  disconnect: expect.any(Function) as unknown as WsStore["disconnect"],
  clearMessages: expect.any(Function) as unknown as WsStore["clearMessages"],
  removeConnection: expect.any(Function) as unknown as WsStore["removeConnection"],
  pushMessage: expect.any(Function) as unknown as WsStore["pushMessage"],
};

beforeEach(() => {
  useWsStore.setState({ connections: {} });
});

describe("useWsStore", () => {
  it("exports a store", () => {
    expect(useWsStore).toBeDefined();
    expect(useWsStore.getState()).toMatchObject(initial);
  });

  it("clearMessages empties messages for connection", () => {
    useWsStore.setState({
      connections: {
        c1: {
          status: "connected",
          url: "ws://example.com",
          messages: [
            { connectionId: "c1", data: "hello", direction: "received", timestamp: 1 },
          ],
          error: null,
        },
      },
    });
    useWsStore.getState().clearMessages("c1");
    expect(useWsStore.getState().connections.c1?.messages).toEqual([]);
  });

  it("removeConnection deletes connection", () => {
    useWsStore.setState({
      connections: {
        c1: { status: "disconnected", url: "", messages: [], error: null },
      },
    });
    useWsStore.getState().removeConnection("c1");
    expect(useWsStore.getState().connections.c1).toBeUndefined();
  });

  it("pushMessage appends and caps at 500", () => {
    const msgs = Array.from({ length: 500 }, (_, i) => ({
      connectionId: "c1",
      data: `d${i}`,
      direction: "received" as const,
      timestamp: i,
    }));
    useWsStore.setState({
      connections: {
        c1: { status: "connected", url: "ws://x", messages: msgs, error: null },
      },
    });
    useWsStore.getState().pushMessage("c1", {
      connectionId: "c1",
      data: "d500",
      direction: "received",
      timestamp: 500,
    });
    const conn = useWsStore.getState().connections.c1;
    expect(conn?.messages).toHaveLength(500);
    expect(conn?.messages[0]?.data).toBe("d1");
    expect(conn?.messages[499]?.data).toBe("d500");
  });

  it("pushMessage with direction=error sets status=error", () => {
    useWsStore.setState({
      connections: {
        c1: { status: "connected", url: "ws://x", messages: [], error: null },
      },
    });
    useWsStore.getState().pushMessage("c1", {
      connectionId: "c1",
      data: "oops",
      direction: "error",
      timestamp: 10,
    });
    const conn = useWsStore.getState().connections.c1;
    expect(conn?.status).toBe("error");
    expect(conn?.error).toBe("oops");
  });

  it("pushMessage with system closed sets status=disconnected", () => {
    useWsStore.setState({
      connections: {
        c1: { status: "connected", url: "ws://x", messages: [], error: null },
      },
    });
    useWsStore.getState().pushMessage("c1", {
      connectionId: "c1",
      data: "Connection closed by server",
      direction: "system",
      timestamp: 20,
    });
    expect(useWsStore.getState().connections.c1?.status).toBe("disconnected");
  });

  it("pushMessage with direction=received leaves status unchanged", () => {
    useWsStore.setState({
      connections: {
        c1: { status: "connected", url: "ws://x", messages: [], error: null },
      },
    });
    useWsStore.getState().pushMessage("c1", {
      connectionId: "c1",
      data: "ok",
      direction: "received",
      timestamp: 30,
    });
    expect(useWsStore.getState().connections.c1?.status).toBe("connected");
  });
});