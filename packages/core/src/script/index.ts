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

export interface ScriptContext {
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  environment?: Record<string, string>;
  collectionVariables?: Record<string, string>;
  globals?: Record<string, string>;
}

export interface ExecuteScriptParams {
  code: string;
  context: ScriptContext;
  timeoutMs?: number;
}

export async function executeScript(params: ExecuteScriptParams): Promise<ScriptResult> {
  return invoke<ScriptResult>("execute_script", { params });
}
