import { create } from "zustand";
import type { AiProviderConfig } from "./index";
import { listProviders, addProvider as addProviderIpc, removeProvider as removeProviderIpc, setProvider as setProviderIpc, testConnection, aiChat } from "./index";
import type { AiMessage } from "./index";

export interface ProviderStore {
  providers: AiProviderConfig[];
  activeProviderId: string | null;
  isLoaded: boolean;

  loadProviders: () => Promise<void>;
  addProvider: (config: AiProviderConfig) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  setActiveProvider: (id: string) => Promise<void>;
  testProviderConnection: (providerId: string, baseUrl: string, model: string) => Promise<string | null>;
}

export const useProviderStore = create<ProviderStore>((set) => ({
  providers: [],
  activeProviderId: null,
  isLoaded: false,

  loadProviders: async () => {
    try {
      const providers = await listProviders();
      const active = providers.find((p) => p.isDefault);
      set({
        providers,
        activeProviderId: active?.id ?? providers[0]?.id ?? null,
        isLoaded: true,
      });
    } catch (e) {
      console.error("Failed to load AI providers:", e);
    }
  },

  addProvider: async (config) => {
    await addProviderIpc(config);
    set((s) => ({
      providers: s.providers.filter((p) => p.id !== config.id).concat(config),
      activeProviderId: s.activeProviderId ?? config.id,
    }));
  },

  removeProvider: async (id) => {
    await removeProviderIpc(id);
    set((s) => ({
      providers: s.providers.filter((p) => p.id !== id),
      activeProviderId: s.activeProviderId === id ? (s.providers.filter((p) => p.id !== id)[0]?.id ?? null) : s.activeProviderId,
    }));
  },

  setActiveProvider: async (id) => {
    await setProviderIpc(id);
    set({ activeProviderId: id });
  },

  testProviderConnection: async (providerId, baseUrl, model) => {
    try {
      const result = await testConnection(providerId, baseUrl, model);
      return `Connected (${result.totalTokens} tokens)`;
    } catch (e) {
      return `Connection failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
}));

export interface ChatState {
  messages: Record<string, AiMessage[]>;
  loadingSessions: Record<string, boolean>;

  setMessages: (sessionId: string, messages: AiMessage[]) => void;
  addMessage: (sessionId: string, message: AiMessage) => void;
  sendMessage: (sessionId: string, providerId: string, message: AiMessage, contextMessages?: AiMessage[]) => Promise<void>;
  clearMessages: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  loadingSessions: {},

  setMessages: (sessionId, messages) => {
    set((s) => ({ messages: { ...s.messages, [sessionId]: messages } }));
  },

  addMessage: (sessionId, message) => {
    set((s) => ({
      messages: { ...s.messages, [sessionId]: [...(s.messages[sessionId] ?? []), message] },
    }));
  },

  sendMessage: async (sessionId, providerId, message, contextMessages) => {
    set((s) => ({ loadingSessions: { ...s.loadingSessions, [sessionId]: true } }));

    const prevMessages = get().messages[sessionId] ?? [];
    const updatedMessages = [...prevMessages, message];
    set((s) => ({ messages: { ...s.messages, [sessionId]: updatedMessages } }));

    const allMessages = [...(contextMessages ?? []), ...updatedMessages];

    try {
      const response = await aiChat({
        providerId,
        messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
      });
      set((s) => ({
        messages: { ...s.messages, [sessionId]: [...updatedMessages, { role: "assistant", content: response.content }] },
        loadingSessions: { ...s.loadingSessions, [sessionId]: false },
      }));
    } catch (e) {
      console.error("AI chat failed:", e);
      set((s) => ({
        messages: {
          ...s.messages,
          [sessionId]: [
            ...updatedMessages,
            { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Unknown error"}` },
          ],
        },
        loadingSessions: { ...s.loadingSessions, [sessionId]: false },
      }));
    }
  },

  clearMessages: (sessionId) => {
    set((s) => {
      const { [sessionId]: _, ...rest } = s.messages;
      return { messages: rest };
    });
  },
}));