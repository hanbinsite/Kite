import type { HttpResponse } from "@api-client/types";

export function createHttpResponse(overrides: Partial<HttpResponse> = {}): HttpResponse {
  return {
    id: "resp-1",
    requestId: "req-1",
    status: 200,
    statusText: "OK",
    headers: [],
    body: '{"data": "test"}',
    bodySize: 16,
    time: 150,
    contentType: "application/json",
    ...overrides,
  };
}

export function createMockTab(id = "tab-1") {
  return { id, title: `Request ${id}`, method: "GET" as const, url: "", isDirty: false };
}