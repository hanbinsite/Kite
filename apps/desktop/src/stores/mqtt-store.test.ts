import { describe, it, expect, beforeEach } from "vitest";
import { useMqttStore, type MqttStore } from "./mqtt-store";

const initial: MqttStore = {
  connections: {},
  connect: expect.any(Function) as unknown as MqttStore["connect"],
  subscribe: expect.any(Function) as unknown as MqttStore["subscribe"],
  publish: expect.any(Function) as unknown as MqttStore["publish"],
  disconnect: expect.any(Function) as unknown as MqttStore["disconnect"],
  clearMessages: expect.any(Function) as unknown as MqttStore["clearMessages"],
  removeConnection: expect.any(Function) as unknown as MqttStore["removeConnection"],
  pushMessage: expect.any(Function) as unknown as MqttStore["pushMessage"],
};

beforeEach(() => {
  useMqttStore.setState({ connections: {} });
});

describe("useMqttStore", () => {
  it("exports a store", () => {
    expect(useMqttStore).toBeDefined();
    expect(useMqttStore.getState()).toMatchObject(initial);
  });

  it("clearMessages empties messages for connection", () => {
    useMqttStore.setState({
      connections: {
        c1: {
          status: "connected",
          config: null,
          messages: [
            {
              connectionId: "c1",
              topic: "t",
              payload: "p",
              qos: 0,
              direction: "received",
              timestamp: 1,
            },
          ],
          subscriptions: [],
          error: null,
        },
      },
    });
    useMqttStore.getState().clearMessages("c1");
    expect(useMqttStore.getState().connections.c1?.messages).toEqual([]);
  });

  it("removeConnection deletes connection", () => {
    useMqttStore.setState({
      connections: {
        c1: { status: "disconnected", config: null, messages: [], subscriptions: [], error: null },
      },
    });
    useMqttStore.getState().removeConnection("c1");
    expect(useMqttStore.getState().connections.c1).toBeUndefined();
  });

  it("pushMessage appends and caps at 500", () => {
    const msgs = Array.from({ length: 500 }, (_, i) => ({
      connectionId: "c1",
      topic: `t${i}`,
      payload: `p${i}`,
      qos: 0,
      direction: "received" as const,
      timestamp: i,
    }));
    useMqttStore.setState({
      connections: {
        c1: { status: "connected", config: null, messages: msgs, subscriptions: [], error: null },
      },
    });
    useMqttStore.getState().pushMessage("c1", {
      connectionId: "c1",
      topic: "t500",
      payload: "p500",
      qos: 0,
      direction: "received",
      timestamp: 500,
    });
    const conn = useMqttStore.getState().connections.c1;
    expect(conn?.messages).toHaveLength(500);
    expect(conn?.messages[0]?.topic).toBe("t1");
    expect(conn?.messages[499]?.topic).toBe("t500");
  });

  it("pushMessage with direction=error sets status=error", () => {
    useMqttStore.setState({
      connections: {
        c1: { status: "connected", config: null, messages: [], subscriptions: [], error: null },
      },
    });
    useMqttStore.getState().pushMessage("c1", {
      connectionId: "c1",
      topic: "err",
      payload: "connection lost",
      qos: 0,
      direction: "error",
      timestamp: 10,
    });
    const conn = useMqttStore.getState().connections.c1;
    expect(conn?.status).toBe("error");
    expect(conn?.error).toBe("connection lost");
  });

  it("pushMessage with system disconnected sets status=disconnected", () => {
    useMqttStore.setState({
      connections: {
        c1: { status: "connected", config: null, messages: [], subscriptions: [], error: null },
      },
    });
    useMqttStore.getState().pushMessage("c1", {
      connectionId: "c1",
      topic: "system",
      payload: "Socket disconnected by server",
      qos: 0,
      direction: "system",
      timestamp: 20,
    });
    expect(useMqttStore.getState().connections.c1?.status).toBe("disconnected");
  });

  it("pushMessage with direction=received leaves status unchanged", () => {
    useMqttStore.setState({
      connections: {
        c1: { status: "connected", config: null, messages: [], subscriptions: [], error: null },
      },
    });
    useMqttStore.getState().pushMessage("c1", {
      connectionId: "c1",
      topic: "data",
      payload: "ok",
      qos: 0,
      direction: "received",
      timestamp: 30,
    });
    expect(useMqttStore.getState().connections.c1?.status).toBe("connected");
  });
});