import { invoke } from "@tauri-apps/api/core";
import type { HttpResponse } from "@api-client/types";

export interface IpcBodyConfig {
  mode: string;
  content: string | ArrayBuffer | null;
  content_type: string | null;
  formdata?: IpcFormDataParam[];
  urlencoded?: IpcUrlEncodedParam[];
  graphql_query?: string;
  graphql_variables?: string;
}

export interface IpcFormDataParam {
    key: string;
    value: string;
    param_type: string;
    disabled: boolean;
    content_type?: string;
}

export interface IpcUrlEncodedParam {
    key: string;
    value: string;
    disabled: boolean;
}

export interface IpcRequestSettings {
    timeout_ms: number;
    follow_redirects: boolean;
    max_redirects: number;
    verify_ssl: boolean;
}

export interface IpcAuthConfig {
  type: string;
  config: Record<string, unknown> | null;
}

export function buildIpcAuth(type: string, config: Record<string, unknown> | null): IpcAuthConfig {
  const requiredFields: Record<string, string[]> = {
    bearer: ["token"],
    basic: ["username", "password"],
    apikey: ["key", "value"],
    jwt: ["token"],
    oauth2: ["accessToken"],
  };
  const required = requiredFields[type];
  if (required && config) {
    for (const field of required) {
      if (config[field] === undefined || config[field] === null) {
        console.warn(`IpcAuthConfig: missing required field "${field}" for auth type "${type}"`);
      }
    }
  }
  return { type, config };
}

export interface IpcHttpRequestConfig {
    id: string;
    method: string;
    url: string;
    headers: { key: string; value: string; disabled: boolean }[];
    params: { key: string; value: string; disabled: boolean }[];
    body: IpcBodyConfig | null;
    auth: IpcAuthConfig | null;
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

export interface CookieEntry {
    id?: number;
    domain: string;
    name: string;
    value: string;
    path: string;
    expires?: string;
    secure: boolean;
    http_only: boolean;
    same_site: string;
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

export async function searchHistoryEntries(query: string, limit: number): Promise<HistoryEntry[]> {
    return invoke<HistoryEntry[]>("search_history_entries", { query, limit });
}

export async function deleteHistoryEntry(id: number): Promise<void> {
    return invoke<void>("delete_history_entry", { id });
}

export async function clearHistory(): Promise<void> {
    return invoke<void>("clear_history");
}

export async function getSetting(key: string): Promise<string | null> {
    return invoke<string | null>("get_setting", { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
    return invoke<void>("set_setting", { key, value });
}

export async function insertCookie(cookie: CookieEntry): Promise<number> {
    return invoke<number>("insert_cookie", { cookie });
}

export async function queryCookies(domain?: string): Promise<CookieEntry[]> {
    return invoke<CookieEntry[]>("query_cookies", { domain: domain ?? null });
}

export async function deleteCookie(id: number): Promise<void> {
    return invoke<void>("delete_cookie", { id });
}

export async function clearCookies(): Promise<void> {
    return invoke<void>("clear_cookies");
}

// Collection IPC

export interface IpcSavedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: { key: string; value: string; disabled: boolean; description?: string }[];
  params: { key: string; value: string; disabled: boolean; description?: string }[];
  body?: { mode: string; content?: string; content_type?: string; language?: string; formdata: IpcFormDataParam[]; urlencoded: IpcUrlEncodedParam[]; graphql_query?: string; graphql_variables?: string };
  auth?: IpcAuthConfig;
  scripts: { pre_request?: string; post_response?: string };
  settings: IpcRequestSettings;
}

export interface IpcCollectionItem {
    type: "folder" | "request";
    id: string;
    name: string;
    items?: IpcCollectionItem[];
    method?: string;
    url?: string;
    headers?: { key: string; value: string; disabled: boolean; description?: string }[];
    params?: { key: string; value: string; disabled: boolean; description?: string }[];
    body?: { mode: string; content?: string; content_type?: string; language?: string; formdata: IpcFormDataParam[]; urlencoded: IpcUrlEncodedParam[]; graphql_query?: string; graphql_variables?: string };
    auth?: IpcAuthConfig;
    scripts?: { pre_request?: string; post_response?: string };
    settings?: IpcRequestSettings;
    description?: string;
}

export interface IpcCollectionFile {
    id: string;
    name: string;
    description?: string;
    items: IpcCollectionItem[];
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
