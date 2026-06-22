import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  pluginList as ipcList,
  pluginInstall as ipcInstall,
  pluginUninstall as ipcUninstall,
  pluginToggle as ipcToggle,
  pluginExecuteHook as ipcExecuteHook,
  pluginExecuteCommand as ipcExecuteCommand,
  pluginGetCode as ipcGetCode,
  pluginSaveCode as ipcSaveCode,
  type PluginInfo,
  type PluginHookContext,
  type PluginHookResult,
} from "@api-client/core/plugin";
import { handleError } from "@api-client/core/error";

export interface PluginState {
  plugins: PluginInfo[];
  loading: boolean;
  error: string | null;
}

export interface PluginActions {
  loadPlugins: () => Promise<void>;
  installPlugin: (zipPath: string) => Promise<void>;
  uninstallPlugin: (id: string) => Promise<void>;
  togglePlugin: (id: string, enabled: boolean) => Promise<void>;
  executeHook: (hook: string, context: PluginHookContext) => Promise<PluginHookResult[]>;
  executeCommand: (pluginId: string, commandId: string, context: PluginHookContext) => Promise<PluginHookResult>;
  getPluginCode: (pluginId: string) => Promise<string>;
  savePluginCode: (pluginId: string, code: string) => Promise<void>;
}

export type PluginStore = PluginState & PluginActions;

export const usePluginStore = create<PluginStore>()(
  immer((set, get) => ({
    plugins: [],
    loading: false,
    error: null,

    loadPlugins: async () => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });
      try {
        const plugins = await ipcList();
        set((state) => {
          state.plugins = plugins;
          state.loading = false;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
          state.loading = false;
        });
      }
    },

    installPlugin: async (zipPath) => {
      set((state) => {
        state.error = null;
      });
      try {
        await ipcInstall(zipPath);
        await get().loadPlugins();
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    uninstallPlugin: async (id) => {
      set((state) => {
        state.error = null;
      });
      try {
        await ipcUninstall(id);
        set((state) => {
          state.plugins = state.plugins.filter((p) => p.manifest.id !== id);
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    togglePlugin: async (id, enabled) => {
      set((state) => {
        const plugin = state.plugins.find((p) => p.manifest.id === id);
        if (plugin) plugin.enabled = enabled;
        state.error = null;
      });
      try {
        await ipcToggle(id, enabled);
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
        await get().loadPlugins();
      }
    },

    executeHook: async (hook, context) => {
      try {
        return await ipcExecuteHook(hook, context);
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
        return [];
      }
    },

    executeCommand: async (pluginId, commandId, context) => {
      try {
        return await ipcExecuteCommand(pluginId, commandId, context);
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
        throw err;
      }
    },

    getPluginCode: async (pluginId) => {
      try {
        return await ipcGetCode(pluginId);
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
        throw err;
      }
    },

    savePluginCode: async (pluginId, code) => {
      set((state) => {
        state.error = null;
      });
      try {
        await ipcSaveCode(pluginId, code);
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
