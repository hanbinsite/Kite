import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface WsMessage {
  connectionId: string;
  data: string;
  direction: "sent" | "received" | "system" | "error";
  timestamp: number;
  isBinary?: boolean;
  byteLen?: number;
  binary?: number[];
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

export async function wsSendBinary(
  connectionId: string,
  data: ArrayBuffer | Uint8Array,
): Promise<void> {
  const bytes = data instanceof Uint8Array ? Array.from(data) : Array.from(new Uint8Array(data));
  return invoke<void>("ws_send_binary", { connectionId, data: bytes });
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
