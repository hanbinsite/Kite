import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface KeyValue {
  key: string;
  value: string;
}

export interface MockRoute {
  id: string;
  method: string;
  path: string;
  status: number;
  headers: KeyValue[];
  body: string;
  delayMs: number;
}

export interface MockServerConfig {
  port: number;
}

export interface MockServerStatus {
  running: boolean;
  port: number | null;
}

export interface MockRequestLog {
  method: string;
  path: string;
  matchedRouteId: string | null;
  status: number;
  timestamp: number;
}

export async function startMockServer(config: MockServerConfig): Promise<void> {
  return invoke<void>("start_mock_server", { config });
}

export async function stopMockServer(): Promise<void> {
  return invoke<void>("stop_mock_server");
}

export async function getMockServerStatus(): Promise<MockServerStatus> {
  return invoke<MockServerStatus>("get_mock_server_status");
}

export async function addMockRoute(route: MockRoute): Promise<void> {
  return invoke<void>("add_mock_route", { route });
}

export async function removeMockRoute(routeId: string): Promise<void> {
  return invoke<void>("remove_mock_route", { routeId });
}

export async function updateMockRoute(route: MockRoute): Promise<void> {
  return invoke<void>("update_mock_route", { route });
}

export async function listMockRoutes(): Promise<MockRoute[]> {
  return invoke<MockRoute[]>("list_mock_routes");
}

export async function clearMockRoutes(): Promise<void> {
  return invoke<void>("clear_mock_routes");
}

export async function onMockRequestReceived(
  callback: (log: MockRequestLog) => void,
): Promise<UnlistenFn> {
  return listen<MockRequestLog>("mock-request-received", (event) => {
    callback(event.payload);
  });
}
