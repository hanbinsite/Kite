import { create } from "zustand";
import type { AiProviderConfig, AiStreamChunk } from "./index";
import { listProviders, addProvider as addProviderIpc, removeProvider as removeProviderIpc, setProvider as setProviderIpc, testConnection, aiStreamChat } from "./index";
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
  streamingSessions: Record<string, string>;

  setMessages: (sessionId: string, messages: AiMessage[]) => void;
  addMessage: (sessionId: string, message: AiMessage) => void;
  updateLastAssistantMessage: (sessionId: string, content: string) => void;
  sendMessage: (sessionId: string, providerId: string, message: AiMessage, contextMessages?: AiMessage[]) => Promise<void>;
  sendSlashCommand: (sessionId: string, providerId: string, command: string, contextMessages?: AiMessage[]) => Promise<void>;
  clearMessages: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  loadingSessions: {},
  streamingSessions: {},

  setMessages: (sessionId, messages) => {
    set((s) => ({ messages: { ...s.messages, [sessionId]: messages } }));
  },

  addMessage: (sessionId, message) => {
    set((s) => ({
      messages: { ...s.messages, [sessionId]: [...(s.messages[sessionId] ?? []), message] },
    }));
  },

  updateLastAssistantMessage: (sessionId, content) => {
    set((s) => {
      const msgs = [...(s.messages[sessionId] ?? [])];
      if (msgs.length > 0 && msgs[msgs.length - 1]!.role === "assistant") {
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1]!, content };
      }
      return { messages: { ...s.messages, [sessionId]: msgs } };
    });
  },

  sendMessage: async (sessionId, providerId, message, contextMessages) => {
    set((s) => ({
      loadingSessions: { ...s.loadingSessions, [sessionId]: true },
      streamingSessions: { ...s.streamingSessions, [sessionId]: "" },
    }));

    const prevMessages = get().messages[sessionId] ?? [];
    const updatedMessages = [...prevMessages, message];
    set((s) => ({ messages: { ...s.messages, [sessionId]: updatedMessages } }));

    const allMessages = [...(contextMessages ?? []), ...updatedMessages];

    let unlisten: (() => void) | null = null;

    try {
      const { listen } = await import("@tauri-apps/api/event");

      unlisten = await listen<AiStreamChunk>("ai-stream-chunk", (event) => {
        const chunk = event.payload;
        const currentStreaming = get().streamingSessions[sessionId];
        if (currentStreaming !== undefined) {
          const newContent = currentStreaming + chunk.delta;
          set((s) => ({
            streamingSessions: { ...s.streamingSessions, [sessionId]: newContent },
          }));
          get().updateLastAssistantMessage(sessionId, newContent);
        }
      });

      set((s) => ({
        messages: { ...s.messages, [sessionId]: [...updatedMessages, { role: "assistant" as const, content: "" }] },
      }));

      await aiStreamChat({
        providerId,
        messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
      });
    } catch (e) {
      console.error("AI chat failed:", e);
      const streaming = get().streamingSessions[sessionId];
      if (!streaming) {
        set((s) => ({
          messages: {
            ...s.messages,
            [sessionId]: [...updatedMessages, { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Unknown error"}` }],
          },
        }));
      }
    } finally {
      if (unlisten) unlisten();
      set((s) => {
        const { [sessionId]: _, ...rest } = s.streamingSessions;
        return {
          loadingSessions: { ...s.loadingSessions, [sessionId]: false },
          streamingSessions: rest,
        };
      });
    }
  },

  sendSlashCommand: async (sessionId, providerId, command, contextMessages) => {
    const cmd = command.trim();
    if (!cmd.startsWith("/")) return;

    const commandKey = cmd.slice(1).split(" ")[0] ?? "";
    const { SLASH_COMMANDS } = await import("./index");
    const slashCmd = SLASH_COMMANDS.find((c) => c.key === commandKey);
    if (!slashCmd) return;

    const userMessage: AiMessage = { role: "user", content: slashCmd.label };
    set((s) => ({
      loadingSessions: { ...s.loadingSessions, [sessionId]: true },
      streamingSessions: { ...s.streamingSessions, [sessionId]: "" },
    }));

    const prevMessages = get().messages[sessionId] ?? [];
    const updatedMessages = [...prevMessages, userMessage];
    set((s) => ({ messages: { ...s.messages, [sessionId]: updatedMessages } }));

    const systemMessage: AiMessage = {
      role: "system",
      content: slashCmd.prompt,
    };
    const allMessages = [...(contextMessages ?? []), systemMessage, ...updatedMessages];

    let unlisten: (() => void) | null = null;

    try {
      const { listen } = await import("@tauri-apps/api/event");

      unlisten = await listen<AiStreamChunk>("ai-stream-chunk", (event) => {
        const chunk = event.payload;
        const currentStreaming = get().streamingSessions[sessionId];
        if (currentStreaming !== undefined) {
          const newContent = currentStreaming + chunk.delta;
          set((s) => ({
            streamingSessions: { ...s.streamingSessions, [sessionId]: newContent },
          }));
          get().updateLastAssistantMessage(sessionId, newContent);
        }
      });

      set((s) => ({
        messages: { ...s.messages, [sessionId]: [...updatedMessages, { role: "assistant" as const, content: "" }] },
      }));

      await aiStreamChat({
        providerId,
        messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
      });
    } catch (e) {
      console.error("AI slash command failed:", e);
      const streaming = get().streamingSessions[sessionId];
      if (!streaming) {
        set((s) => ({
          messages: {
            ...s.messages,
            [sessionId]: [...updatedMessages, { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Unknown error"}` }],
          },
        }));
      }
    } finally {
      if (unlisten) unlisten();
      set((s) => {
        const { [sessionId]: _, ...rest } = s.streamingSessions;
        return {
          loadingSessions: { ...s.loadingSessions, [sessionId]: false },
          streamingSessions: rest,
        };
      });
    }
  },

  clearMessages: (sessionId) => {
    set((s) => {
      const { [sessionId]: _, ...rest } = s.messages;
      return { messages: rest };
    });
  },
}));