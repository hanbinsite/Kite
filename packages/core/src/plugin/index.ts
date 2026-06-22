import { invoke } from "@tauri-apps/api/core";

export interface PluginCommand {
  id: string;
  title: string;
  description?: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  entry: string;
  permissions: string[];
  hooks: string[];
  commands: PluginCommand[];
}

export interface PluginInfo {
  manifest: PluginManifest;
  enabled: boolean;
  hasError: boolean;
  error?: string;
}

export interface PluginHookContext {
  event: string;
  data: unknown;
}

export interface PluginHookResult {
  pluginId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  logs: string[];
  uiInject?: string;
}

export const pluginList = () => invoke<PluginInfo[]>("plugin_list");
export const pluginInstall = (zipPath: string) => invoke<PluginInfo>("plugin_install", { zipPath });
export const pluginUninstall = (id: string) => invoke<void>("plugin_uninstall", { id });
export const pluginToggle = (id: string, enabled: boolean) => invoke<void>("plugin_toggle", { id, enabled });
export const pluginExecuteHook = (hook: string, context: PluginHookContext) =>
  invoke<PluginHookResult[]>("plugin_execute_hook", { hook, context });
export const pluginExecuteCommand = (pluginId: string, commandId: string, context: PluginHookContext) =>
  invoke<PluginHookResult>("plugin_execute_command", { pluginId, commandId, context });
export const pluginGetCode = (pluginId: string) => invoke<string>("plugin_get_code", { pluginId });
export const pluginSaveCode = (pluginId: string, code: string) => invoke<void>("plugin_save_code", { pluginId, code });
