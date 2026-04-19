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

// Collection IPC

export interface IpcSavedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: { key: string; value: string; disabled: boolean; description?: string }[];
  params: { key: string; value: string; disabled: boolean; description?: string }[];
  body?: { mode: string; content?: string; content_type?: string; language?: string; formdata: { key: string; value: string; param_type: string; disabled: boolean }[]; urlencoded: { key: string; value: string; disabled: boolean; description?: string }[]; graphql_query?: string; graphql_variables?: string };
  auth?: { type: string; config?: unknown };
  scripts: { pre_request?: string; post_response?: string };
  settings: { timeout_ms: number; follow_redirects: boolean; verify_ssl: boolean };
}

export interface IpcCollectionFile {
  id: string;
  name: string;
  description?: string;
  requests: IpcSavedRequest[];
  variables?: { key: string; value: string; enabled: boolean }[];
  created_at: string;
  updated_at: string;
}

export interface IpcCollectionSummary {
  id: string;
  name: string;
  description?: string;
  request_count: number;
  updated_at: string;
}

export async function listCollections(): Promise<IpcCollectionSummary[]> {
  return invoke<IpcCollectionSummary[]>("list_collections");
}

export async function getCollection(collectionId: string): Promise<IpcCollectionFile> {
  return invoke<IpcCollectionFile>("get_collection", { collectionId });
}

export async function saveCollection(collection: IpcCollectionFile): Promise<void> {
  return invoke<void>("save_collection", { collection });
}

export async function deleteCollection(collectionId: string): Promise<void> {
  return invoke<void>("delete_collection", { collectionId });
}

// Environment IPC

export interface IpcEnvironmentFile {
  id: string;
  name: string;
  variables: { key: string; value: string; enabled: boolean }[];
  created_at: string;
  updated_at: string;
}

export interface IpcEnvironmentSummary {
  id: string;
  name: string;
  variable_count: number;
  updated_at: string;
}

export async function listEnvironments(): Promise<IpcEnvironmentSummary[]> {
  return invoke<IpcEnvironmentSummary[]>("list_environments");
}

export async function getEnvironment(environmentId: string): Promise<IpcEnvironmentFile> {
  return invoke<IpcEnvironmentFile>("get_environment", { environmentId });
}

export async function saveEnvironment(environment: IpcEnvironmentFile): Promise<void> {
  return invoke<void>("save_environment", { environment });
}

export async function deleteEnvironment(environmentId: string): Promise<void> {
  return invoke<void>("delete_environment", { environmentId });
}

export { useUIStore } from "../navigation";
export type { UIStore, Theme } from "../navigation";

export { useTabStore } from "../navigation";
export type { TabStore, Tab } from "../navigation";