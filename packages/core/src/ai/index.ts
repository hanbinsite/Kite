export interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiChatRequest {
  providerId: string;
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
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

export async function testConnection(providerId: string, baseUrl: string, model: string): Promise<{ promptTokens: number; completionTokens: number; totalTokens: number }> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<{ promptTokens: number; completionTokens: number; totalTokens: number }>("ai_test_connection", { providerId, baseUrl, model });
}

export async function aiChat(request: AiChatRequest): Promise<AiChatResponse> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<AiChatResponse>("ai_chat", { request });
}

export { useProviderStore, useChatStore } from "./store";
export type { ProviderStore, ChatState } from "./store";
export { buildContextMessage } from "./context-builder";
export type { AiContextData } from "./context-builder";