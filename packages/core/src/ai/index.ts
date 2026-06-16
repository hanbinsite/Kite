export interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

import type { AiChatWithToolsRequest, AiChatWithToolsResponse } from "./action-types";

export interface AiChatRequest {
  providerId: string;
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
}

export interface AiChatResponse {
  id: string;
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface AiProviderConfig {
  id: string;
  name: string;
  providerType: string;
  baseUrl: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  isDefault: boolean;
}

export interface AiStreamChunk {
  sessionId: string;
  delta: string;
  done: boolean;
}

export interface AiApiKeyStatus {
  hasKey: boolean;
}

export interface AgentAction {
  type: "create_request" | "modify_request" | "write_test" | "generate_doc" | "fix_error" | "extract_variables" | "generate_mock" | "explain_response";
  data: Record<string, unknown>;
  description: string;
}

export interface SlashCommand {
  key: string;
  label: string;
  description: string;
  prompt: string;
  needsResponse?: boolean;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { key: "explain", label: "/explain", description: "Explain current response", prompt: "Explain the current HTTP response in detail. What does the status code mean? What is the structure of the response body? Are there any potential issues?", needsResponse: true },
  { key: "fix", label: "/fix", description: "Fix request errors", prompt: "The current request returned an error response. Analyze the request (method, URL, headers, body, auth) and the error response, then suggest specific fixes. Return a JSON action with type 'fix_error' containing the specific modifications needed.", needsResponse: true },
  { key: "test", label: "/test", description: "Generate test scripts", prompt: "Generate pm.test() test scripts for the current request based on its method, URL, and expected response. Return a JSON action with type 'write_test' containing the script code." },
  { key: "doc", label: "/doc", description: "Generate API documentation", prompt: "Generate API documentation in Markdown format for the current request. Include endpoint description, parameters, request/response examples. Return a JSON action with type 'generate_doc' containing the markdown content." },
  { key: "mock", label: "/mock", description: "Generate mock data", prompt: "Based on the current response body structure, generate realistic mock data. Return a JSON action with type 'generate_mock' containing the mock data and route configuration.", needsResponse: true },
  { key: "extract", label: "/extract", description: "Extract variables from response", prompt: "Analyze the current response body and identify variables that could be extracted for reuse (e.g., IDs, tokens, names). Return a JSON action with type 'extract_variables' containing the variable names, JSONPath expressions, and target environment.", needsResponse: true },
  { key: "diff", label: "/diff", description: "Compare two responses", prompt: "Compare the current response with the previous response for the same request. Highlight any differences in status code, headers, and body. Return a structured comparison.", needsResponse: true },
  { key: "create", label: "/create", description: "Create request from description", prompt: "Create an HTTP request based on my description. Return a JSON action with type 'create_request' containing: method, url, headers (array of {key, value}), body (if needed), auth (if needed)." },
  { key: "analyze", label: "/analyze", description: "Analyze collection", prompt: "Analyze the current API collection and report: 1) Endpoints missing tests 2) Endpoints missing documentation 3) Inconsistent auth configurations 4) Hardcoded URLs that should use variables" },
];

export async function listProviders(): Promise<AiProviderConfig[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<AiProviderConfig[]>("ai_list_providers");
}

export async function setProvider(providerId: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<void>("ai_set_provider", { providerId });
}

export async function addProvider(config: AiProviderConfig): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<void>("ai_add_provider", { config });
}

export async function removeProvider(providerId: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<void>("ai_remove_provider", { providerId });
}

export async function setApiKey(providerId: string, apiKey: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<void>("ai_set_api_key", { providerId, apiKey });
}

export async function getApiKeyStatus(providerId: string): Promise<AiApiKeyStatus> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<AiApiKeyStatus>("ai_get_api_key_status", { providerId });
}

export async function testConnection(providerId: string, baseUrl: string, model: string): Promise<{ promptTokens: number; completionTokens: number; totalTokens: number }> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<{ promptTokens: number; completionTokens: number; totalTokens: number }>("ai_test_connection", { providerId, baseUrl, model });
}

export async function aiChat(request: AiChatRequest): Promise<AiChatResponse> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<AiChatResponse>("ai_chat", { request });
}

export async function aiStreamChat(request: AiChatRequest): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("ai_stream_chat", { request });
}

export async function aiChatWithTools(request: AiChatWithToolsRequest): Promise<AiChatWithToolsResponse> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<AiChatWithToolsResponse>("ai_chat_with_tools", { request });
}

export async function aiSaveSession(sessionId: string, messages: AiMessage[]): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<void>("ai_save_session", { sessionId, messages });
}

export async function aiLoadSession(sessionId: string): Promise<AiMessage[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<AiMessage[]>("ai_load_session", { sessionId });
}

export async function aiDeleteSession(sessionId: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<void>("ai_delete_session", { sessionId });
}

export { useProviderStore, useChatStore } from "./store";
export type { ProviderStore, ChatState } from "./store";
export { buildContextMessage } from "./context-builder";
export type { AiContextData } from "./context-builder";
export { parseAgentAction, AGENT_TOOLS } from "./action-types";
export type { CreateRequestAction, ModifyRequestAction, WriteTestAction, GenerateDocAction, FixErrorAction, ExtractVariablesAction, GenerateMockAction, ToolDefinition, AiChatWithToolsRequest, AiChatWithToolsResponse, AiToolCall } from "./action-types";
export { chatAndParseActions } from "./action-dispatcher";
export type { DispatchResult } from "./action-dispatcher";
