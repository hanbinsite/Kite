import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface SseEvent {
  connectionId: string;
  event: string;
  data: string;
  id: string | null;
  timestamp: number;
}

export async function sseConnect(
  connectionId: string,
  url: string,
  headers?: [string, string][],
): Promise<void> {
  return invoke<void>("sse_connect", { connectionId, url, headers: headers ?? null });
}

export async function sseDisconnect(
  connectionId: string,
): Promise<void> {
  return invoke<void>("sse_disconnect", { connectionId });
}

export async function onSseEvent(
  callback: (event: SseEvent) => void,
): Promise<UnlistenFn> {
  return listen<SseEvent>("sse-event", (event) => {
    callback(event.payload);
  });
}
