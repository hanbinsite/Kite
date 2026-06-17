import { invoke } from "@tauri-apps/api/core";

export interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: number;
  requiresAuth: boolean;
  username?: string;
  password?: string;
}

export interface ProxyStatus {
  running: boolean;
  port: number | null;
  interceptedCount: number;
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