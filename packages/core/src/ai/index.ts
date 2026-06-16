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
  { key: "fix", label: "/fix", description: "Fix request errors", prompt: "Analyze the request error. Return ONLY a ```json code block with:\n{\"type\":\"fix_error\",\"description\":\"Fix request\",\"data\":{\"suggestions\":[{\"path\":\"url\",\"issue\":\"wrong URL\",\"fix\":\"https://correct.url\"}]}}", needsResponse: true },
  { key: "test", label: "/test", description: "Generate test scripts", prompt: "Generate pm.test() scripts. Return ONLY a ```json code block with:\n{\"type\":\"write_test\",\"description\":\"Test script\",\"data\":{\"script\":\"pm.test('status 200',function(){pm.expect(pm.response.status).to.equal(200)})\"}}" },
  { key: "doc", label: "/doc", description: "Generate API documentation", prompt: "Generate API docs in Markdown. Return ONLY a ```json code block with:\n{\"type\":\"generate_doc\",\"description\":\"API docs\",\"data\":{\"markdown\":\"# Endpoint\\n\\nGET /api/users\\n\\n...\"}}" },
  { key: "mock", label: "/mock", description: "Generate mock data", prompt: "Generate mock data based on the response structure. Return ONLY a ```json code block with:\n{\"type\":\"generate_mock\",\"description\":\"Mock data\",\"data\":{\"route\":\"/api/users/:id\",\"method\":\"GET\",\"statusCode\":200,\"responseBody\":{\"id\":1,\"name\":\"John\"}}}", needsResponse: true },
  { key: "extract", label: "/extract", description: "Extract variables from response", prompt: "Extract reusable variables from the response. Return ONLY a ```json code block with:\n{\"type\":\"extract_variables\",\"description\":\"Variables\",\"data\":{\"variables\":[{\"key\":\"userId\",\"value\":\"42\",\"source\":\"$.data.id\"}]}}", needsResponse: true },
  { key: "create", label: "/create", description: "Create request from NL", prompt: "Create an HTTP request. Return ONLY a ```json code block with:\n{\"type\":\"create_request\",\"description\":\"New request\",\"data\":{\"name\":\"...\",\"method\":\"GET\",\"url\":\"https://...\"}}" },
  { key: "diff", label: "/diff", description: "Compare two responses", prompt: "Compare the current response with the previous response. Highlight differences in status, headers, and body.", needsResponse: true },
  { key: "analyze", label: "/analyze", description: "Analyze collection", prompt: "Analyze the current collection and report: missing tests, missing docs, inconsistent auth, hardcoded URLs." },
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

export async function testConnection(providerId: string, baseUrl: string, model: string): Promise<{ usage: { promptTokens: number; completionTokens: number; totalTokens: number }; model: string; responseContent: string }> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<{ usage: { promptTokens: number; completionTokens: number; totalTokens: number }; model: string; responseContent: string }>("ai_test_connection", { providerId, baseUrl, model });
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
