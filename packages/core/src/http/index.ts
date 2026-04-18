import { invoke } from "@tauri-apps/api/core";
import type { HttpResponse } from "@api-client/types";

export interface IpcBodyConfig {
  mode: string;
  content: string | null;
  content_type: string | null;
}

export interface IpcRequestSettings {
  timeout_ms: number;
  follow_redirects: boolean;
  verify_ssl: boolean;
}

export interface IpcHttpRequestConfig {
  id: string;
  method: string;
  url: string;
  headers: { key: string; value: string; disabled: boolean }[];
  params: { key: string; value: string; disabled: boolean }[];
  body: IpcBodyConfig | null;
  settings: IpcRequestSettings;
}

export interface HistoryEntry {
  id: number;
  method: string;
  url: string;
  status: number;
  duration: number;
  created_at: string;
}

export async function sendHttpRequest(config: IpcHttpRequestConfig): Promise<HttpResponse> {
  return invoke<HttpResponse>("send_http_request", { config });
}

export async function cancelHttpRequest(requestId: string): Promise<void> {
  return invoke<void>("cancel_http_request", { requestId });
}

export async function insertHistoryEntry(request: {
  method: string;
  url: string;
  status: number;
  duration: number;
}): Promise<number> {
  return invoke<number>("insert_history_entry", { request });
}

export async function queryHistoryEntries(limit: number): Promise<HistoryEntry[]> {
  return invoke<HistoryEntry[]>("query_history_entries", { limit });
}

export { useUIStore } from "../navigation";
export type { UIStore, Theme } from "../navigation";

export { useTabStore } from "../navigation";
export type { TabStore, Tab } from "../navigation";