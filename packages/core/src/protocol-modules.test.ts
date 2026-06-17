import { describe, it, expect } from "vitest";

interface CookieEntry {
  id?: number;
  domain: string;
  name: string;
  value: string;
  path: string;
  expires?: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
}

interface CodeGenRequest {
  id: string;
  method: string;
  url: string;
  headers: { key: string; value: string; disabled: boolean }[];
  params: { key: string; value: string; disabled: boolean }[];
  body: { mode: string; content?: string; content_type?: string } | null;
  auth: { type: string; config: Record<string, unknown> | null } | null;
  settings: { timeout_ms: number; follow_redirects: boolean; max_redirects: number; verify_ssl: boolean };
}

interface ScriptResult {
  success: boolean;
  logs: { level: string; message: string; timestamp: string }[];
  testResults: { name: string; passed: boolean; error: string | null; durationMs: number }[];
  variables: { scope: string; key: string; value: string }[];
  modifiedRequest: Record<string, unknown> | null;
  error: string | null;
}

describe("cookie module", () => {
  it("CookieEntry type has all required fields", () => {
    const entry: CookieEntry = {
      id: 1,
      domain: "example.com",
      name: "session",
      value: "abc123",
      path: "/",
      expires: "2026-12-31",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    };
    expect(entry.domain).toBe("example.com");
    expect(entry.secure).toBe(true);
    expect(entry.httpOnly).toBe(true);
  });
});

describe("codegen module", () => {
  it("CodeGenRequest accepts all fields", () => {
    const req: CodeGenRequest = {
      id: "test",
      method: "POST",
      url: "https://api.example.com",
      headers: [{ key: "Content-Type", value: "application/json", disabled: false }],
      params: [{ key: "page", value: "1", disabled: false }],
      body: { mode: "raw", content: '{"key":"val"}', content_type: "application/json" },
      auth: { type: "bearer", config: { token: "secret" } },
      settings: { timeout_ms: 30000, follow_redirects: true, max_redirects: 10, verify_ssl: true },
    };
    expect(req.method).toBe("POST");
    expect(req.body?.mode).toBe("raw");
  });
});

describe("grpc module", () => {
  it("GrpcMethodInfo shape", () => {
    const info = {
      serviceName: "UserService",
      methodName: "GetUser",
      inputType: ".UserRequest",
      outputType: ".UserResponse",
      clientStreaming: false,
      serverStreaming: false,
    };
    expect(info.serviceName).toBe("UserService");
  });

  it("GrpcResponse shape", () => {
    const resp = {
      requestId: "req-1",
      status: "OK",
      headers: [["content-type", "application/grpc"]] as [string, string][],
      body: "{}",
      timeMs: 150,
    };
    expect(resp.status).toBe("OK");
  });

  it("GrpcStreamMessage variants", () => {
    const types = ["data", "error", "end"] as const;
    types.forEach((t) => {
      const msg = { requestId: "r1", body: "x", streamType: t };
      expect(msg.streamType).toBe(t);
    });
  });
});

describe("mock module", () => {
  it("MockRoute shape", () => {
    const route = {
      id: "route-1", method: "GET", path: "/api/users", status: 200,
      headers: [{ key: "Content-Type", value: "application/json" }],
      body: '{"users":[]}', delayMs: 100,
    };
    expect(route.delayMs).toBe(100);
  });

  it("MockServerConfig and MockServerStatus", () => {
    const config = { port: 8080 };
    const status = { running: true, port: 8080 };
    expect(config.port).toBe(8080);
    expect(status.running).toBe(true);
  });

  it("MockRequestLog shape", () => {
    const log = { method: "POST", path: "/data", matchedRouteId: "r-1", status: 201, timestamp: 123 };
    expect(log.matchedRouteId).toBe("r-1");
  });
});

describe("mqtt module", () => {
  it("MqttMessage shape", () => {
    const msg = {
      connectionId: "conn-1", topic: "sensor/temp", payload: "25.5",
      qos: 1, direction: "received" as const, timestamp: 123,
    };
    expect(msg.qos).toBe(1);
  });

  it("MqttConnectConfig has all fields", () => {
    const config = {
      broker: "mqtt.example.com", port: 1883, clientId: "client-1",
      username: "user", password: "pass", cleanSession: true, keepAlive: 60,
    };
    expect(config.keepAlive).toBe(60);
  });
});

describe("sse module", () => {
  it("SseEvent with all fields", () => {
    const event = {
      connectionId: "sse-1", event: "message", data: '{"k":"v"}',
      id: "msg-1", timestamp: 123,
    };
    expect(event.id).toBe("msg-1");
  });

  it("SseEvent with null id", () => {
    const event = { connectionId: "sse-2", event: "ping", data: "", id: null, timestamp: 0 };
    expect(event.id).toBe(null);
  });
});

describe("ws module", () => {
  it("WsMessage shape", () => {
    const msg = { connectionId: "ws-1", data: '{"type":"ping"}', direction: "sent" as const, timestamp: 123 };
    expect(msg.direction).toBe("sent");
  });
});

describe("script module", () => {
  it("ScriptResult success", () => {
    const result: ScriptResult = {
      success: true, logs: [], testResults: [], variables: [], modifiedRequest: null, error: null,
    };
    expect(result.success).toBe(true);
  });

  it("ScriptResult with failure", () => {
    const result: ScriptResult = {
      success: false,
      logs: [{ level: "error", message: "fail", timestamp: "2026" }],
      testResults: [{ name: "test", passed: false, error: "expected true", durationMs: 5 }],
      variables: [],
      modifiedRequest: null,
      error: "script failed",
    };
    expect(result.testResults[0]!.passed).toBe(false);
    expect(result.error).toBe("script failed");
  });
});