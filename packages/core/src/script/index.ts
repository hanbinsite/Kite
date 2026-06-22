import { invoke } from "@tauri-apps/api/core";

export interface ScriptLog {
  level: string;
  message: string;
  timestamp: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error: string | null;
  durationMs: number;
}

export interface ScriptVariableChange {
  scope: string;
  key: string;
  value: string;
}

export interface ScriptResult {
  success: boolean;
  logs: ScriptLog[];
  testResults: TestResult[];
  variables: ScriptVariableChange[];
  modifiedRequest: Record<string, unknown> | null;
  error: string | null;
}

export interface AuthHeaderEntry {
  key: string;
  value: string;
}

export interface ScriptContext {
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  environment?: Record<string, string>;
  collectionVariables?: Record<string, string>;
  globals?: Record<string, string>;
  folderPath?: string[];
  collectionName?: string;
  cookieHeader?: string;
  authHeader?: AuthHeaderEntry;
}

export interface ExecuteScriptParams {
  code: string;
  context: ScriptContext;
  timeoutMs?: number;
}

export async function executeScript(params: ExecuteScriptParams): Promise<ScriptResult> {
  return invoke<ScriptResult>("execute_script", { params });
}

export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
  category: string;
  isBuiltin: boolean;
}

export function listScriptTemplates(): Promise<ScriptTemplate[]> {
  return invoke<ScriptTemplate[]>("list_script_templates");
}

export function saveScriptTemplate(template: ScriptTemplate): Promise<void> {
  return invoke<void>("save_script_template", { template });
}

export function deleteScriptTemplate(templateId: string): Promise<void> {
  return invoke<void>("delete_script_template", { templateId });
}
