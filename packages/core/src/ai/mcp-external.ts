import { invoke } from "@tauri-apps/api/core";

export interface McpServerConfig {
  id: string;
  name: string;
  transport: McpTransport;
  enabled: boolean;
}

export type McpTransport =
  | { type: "stdio"; command: string; args: string[]; env?: Record<string, string> }
  | { type: "http"; url: string; headers?: [string, string][] };

export interface McpServerStatus {
  id: string;
  name: string;
  connected: boolean;
  toolCount: number;
  error?: string;
}

export interface McpToolInfo {
  serverId: string;
  serverName: string;
  name: string;
  description: string;
  inputSchema: unknown;
}

export const mcpListExternalServers = () => invoke<McpServerConfig[]>("mcp_list_external_servers");
export const mcpSaveExternalServer = (config: McpServerConfig) => invoke<void>("mcp_save_external_server", { config });
export const mcpDeleteExternalServer = (id: string) => invoke<void>("mcp_delete_external_server", { id });
export const mcpConnectServer = (serverId: string) => invoke<McpServerStatus>("mcp_connect_server", { serverId });
export const mcpDisconnectServer = (serverId: string) => invoke<void>("mcp_disconnect_server", { serverId });
export const mcpListExternalTools = () => invoke<McpToolInfo[]>("mcp_list_external_tools");
export const mcpCallExternalTool = (serverId: string, toolName: string, args: unknown) =>
  invoke<unknown>("mcp_call_external_tool", { serverId, toolName, args });
