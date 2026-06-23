import { invoke } from "@tauri-apps/api/core";

export interface KeyValue {
  key: string;
  value: string;
}

export interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: number;
  requiresAuth?: boolean;
  username?: string;
  password?: string;
}

export interface ProxyStatus {
  running: boolean;
  port: number | null;
  interceptedCount: number;
}

export interface InterceptedRequest {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  host: string;
  path: string;
  headers: KeyValue[];
  body: string;
  status: number;
  responseHeaders: KeyValue[];
  responseBody: string;
  durationMs: number;
}

export async function startProxy(config: ProxyConfig): Promise<ProxyStatus> {
  return invoke<ProxyStatus>("start_proxy", { config });
}

export async function stopProxy(): Promise<ProxyStatus> {
  return invoke<ProxyStatus>("stop_proxy");
}

export async function getProxyStatus(): Promise<ProxyStatus> {
  return invoke<ProxyStatus>("get_proxy_status");
}

export async function getInterceptedRequests(): Promise<InterceptedRequest[]> {
  return invoke<InterceptedRequest[]>("get_intercepted_requests");
}

export async function clearInterceptedRequests(): Promise<void> {
  return invoke("clear_intercepted_requests");
}

export async function exportProxyCa(): Promise<string> {
  return invoke<string>("export_proxy_ca");
}