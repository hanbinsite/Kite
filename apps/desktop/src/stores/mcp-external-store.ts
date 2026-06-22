import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  mcpListExternalServers,
  mcpSaveExternalServer,
  mcpDeleteExternalServer,
  mcpConnectServer,
  mcpDisconnectServer,
  mcpListExternalTools,
  mcpCallExternalTool,
  type McpServerConfig,
  type McpServerStatus,
  type McpToolInfo,
} from "@api-client/core/ai/mcp-external";
import { handleError } from "@api-client/core";

export interface McpExternalState {
  servers: McpServerConfig[];
  statuses: Record<string, McpServerStatus>;
  tools: McpToolInfo[];
  loading: boolean;
  error: string | null;
}

export interface McpExternalActions {
  loadServers: () => Promise<void>;
  saveServer: (config: McpServerConfig) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  connectServer: (id: string) => Promise<McpServerStatus | null>;
  disconnectServer: (id: string) => Promise<void>;
  refreshTools: () => Promise<void>;
  callTool: (serverId: string, toolName: string, args: unknown) => Promise<unknown>;
}

export type McpExternalStore = McpExternalState & McpExternalActions;

export const useMcpExternalStore = create<McpExternalStore>()(
  immer((set, get) => ({
    servers: [],
    statuses: {},
    tools: [],
    loading: false,
    error: null,

    loadServers: async () => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });
      try {
        const servers = await mcpListExternalServers();
        set((state) => {
          state.servers = servers;
          state.loading = false;
        });
        await get().refreshTools();
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
          state.loading = false;
        });
      }
    },

    saveServer: async (config) => {
      try {
        await mcpSaveExternalServer(config);
        set((state) => {
          const idx = state.servers.findIndex((s) => s.id === config.id);
          if (idx >= 0) {
            state.servers[idx] = config;
          } else {
            state.servers.push(config);
          }
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    deleteServer: async (id) => {
      try {
        await mcpDeleteExternalServer(id);
        set((state) => {
          state.servers = state.servers.filter((s) => s.id !== id);
          delete state.statuses[id];
          state.tools = state.tools.filter((t) => t.serverId !== id);
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    connectServer: async (id) => {
      try {
        const status = await mcpConnectServer(id);
        set((state) => {
          state.statuses[id] = status;
        });
        await get().refreshTools();
        return status;
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.statuses[id] = {
            id,
            name: get().servers.find((s) => s.id === id)?.name ?? id,
            connected: false,
            toolCount: 0,
            error: handled.description,
          };
          state.error = handled.description;
        });
        return null;
      }
    },

    disconnectServer: async (id) => {
      try {
        await mcpDisconnectServer(id);
        set((state) => {
          if (state.statuses[id]) {
            state.statuses[id].connected = false;
            state.statuses[id].toolCount = 0;
            state.statuses[id].error = undefined;
          }
          state.tools = state.tools.filter((t) => t.serverId !== id);
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    refreshTools: async () => {
      try {
        const tools = await mcpListExternalTools();
        set((state) => {
          state.tools = tools;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    callTool: async (serverId, toolName, args) => {
      try {
        return await mcpCallExternalTool(serverId, toolName, args);
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
        throw err;
      }
    },
  })),
);
