import { describe, it, expect, beforeEach } from "vitest";
import { useGrpcStore, type GrpcStore } from "./grpc-store";

const initial: GrpcStore = {
  parsedProtos: {},
  requests: {},
  discoveredServices: {},
  parseProto: expect.any(Function) as unknown as GrpcStore["parseProto"],
  sendRequest: expect.any(Function) as unknown as GrpcStore["sendRequest"],
  clearResponse: expect.any(Function) as unknown as GrpcStore["clearResponse"],
  pushStreamMessage: expect.any(Function) as unknown as GrpcStore["pushStreamMessage"],
  reflectServices: expect.any(Function) as unknown as GrpcStore["reflectServices"],
  clearDiscoveredServices: expect.any(Function) as unknown as GrpcStore["clearDiscoveredServices"],
};

beforeEach(() => {
  useGrpcStore.setState({ parsedProtos: {}, requests: {}, discoveredServices: {} });
});

describe("useGrpcStore", () => {
  it("exports a store", () => {
    expect(useGrpcStore).toBeDefined();
    expect(useGrpcStore.getState()).toMatchObject(initial);
  });

  it("clearResponse removes a request entry", () => {
    useGrpcStore.setState({
      requests: {
        r1: { loading: true, response: null, error: null, streamMessages: [] },
      },
    });
    useGrpcStore.getState().clearResponse("r1");
    expect(useGrpcStore.getState().requests.r1).toBeUndefined();
  });

  it("pushStreamMessage appends a message for existing connection", () => {
    useGrpcStore.setState({
      requests: {
        r1: { loading: true, response: null, error: null, streamMessages: [] },
      },
    });
    useGrpcStore.getState().pushStreamMessage("r1", {
      requestId: "r1",
      body: "hello",
      streamType: "data",
    });
    const req = useGrpcStore.getState().requests.r1;
    expect(req?.streamMessages).toHaveLength(1);
    expect(req?.streamMessages[0]?.body).toBe("hello");
  });

  it("pushStreamMessage with streamType=end stops loading", () => {
    useGrpcStore.setState({
      requests: {
        r1: { loading: true, response: null, error: null, streamMessages: [] },
      },
    });
    useGrpcStore.getState().pushStreamMessage("r1", {
      requestId: "r1",
      body: "",
      streamType: "end",
    });
    expect(useGrpcStore.getState().requests.r1?.loading).toBe(false);
  });

  it("pushStreamMessage with streamType=error stops loading", () => {
    useGrpcStore.setState({
      requests: {
        r1: { loading: true, response: null, error: null, streamMessages: [] },
      },
    });
    useGrpcStore.getState().pushStreamMessage("r1", {
      requestId: "r1",
      body: "boom",
      streamType: "error",
    });
    expect(useGrpcStore.getState().requests.r1?.loading).toBe(false);
  });

  it("pushStreamMessage auto-creates entry if missing", () => {
    useGrpcStore.getState().pushStreamMessage("r_new", {
      requestId: "r_new",
      body: "auto",
      streamType: "data",
    });
    const req = useGrpcStore.getState().requests.r_new;
    expect(req).toBeDefined();
    expect(req?.streamMessages).toHaveLength(1);
    expect(req?.loading).toBe(true);
  });
});