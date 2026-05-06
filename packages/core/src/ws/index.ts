import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface WsMessage {
  connectionId: string;
  data: string;
  direction: "sent" | "received" | "system" | "error";
  timestamp: number;
}

export async function wsConnect(
  connectionId: string,
  url: string,
  headers?: [string, string][],
): Promise<void> {
  return invoke<void>("ws_connect", { connectionId, url, headers: headers ?? null });
}

export async function wsSend(
  connectionId: string,
  message: string,
): Promise<void> {
  return invoke<void>("ws_send", { connectionId, message });
}

export async function wsClose(
  connectionId: string,
): Promise<void> {
  return invoke<void>("ws_close", { connectionId });
}

export async function onWsMessage(
  callback: (msg: WsMessage) => void,
): Promise<UnlistenFn> {
  return listen<WsMessage>("ws-message", (event) => {
    callback(event.payload);
  });
}
