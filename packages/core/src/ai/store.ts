import { create } from "zustand";
import type { AiProviderConfig, AiStreamChunk } from "./index";
import { listProviders, addProvider as addProviderIpc, removeProvider as removeProviderIpc, setProvider as setProviderIpc, testConnection, aiStreamChat, setApiKey as setApiKeyIpc, getApiKeyStatus, aiSaveSession, aiLoadSession, aiDeleteSession, parseAgentAction } from "./index";
import type { AiMessage } from "./index";
import type { AgentAction } from "./action-types";

async function executeStreaming(
  get: () => ChatState,
  set: (fn: (state: ChatState) => Partial<ChatState>) => void,
  sessionId: string,
  providerId: string,
  allMessages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  updatedMessages: AiMessage[],
) {
  let unlisten: (() => void) | null = null;

  try {
    const { listen } = await import("@tauri-apps/api/event");

    unlisten = await listen<AiStreamChunk>("ai-stream-chunk", (event) => {
      const chunk = event.payload;
      if (chunk.sessionId !== sessionId) return;
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
      messages: allMessages,
      sessionId,
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
    get().saveSession(sessionId);
  }
}

export interface ProviderStore {
  providers: AiProviderConfig[];
  apiKeyStatus: Record<string, boolean>;
  activeProviderId: string | null;
  isLoaded: boolean;

  loadProviders: () => Promise<void>;
  addProvider: (config: AiProviderConfig, apiKey?: string) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  setActiveProvider: (id: string) => Promise<void>;
  testProviderConnection: (providerId: string, baseUrl: string, model: string) => Promise<string | null>;
  setApiKey: (providerId: string, apiKey: string) => Promise<void>;
  refreshApiKeyStatus: (providerId: string) => Promise<void>;
}

export const useProviderStore = create<ProviderStore>((set) => ({
  providers: [],
  apiKeyStatus: {},
  activeProviderId: null,
  isLoaded: false,

  loadProviders: async () => {
    try {
      const providers = await listProviders();
      const active = providers.find((p) => p.isDefault);
      const apiKeyStatus: Record<string, boolean> = {};
      for (const p of providers) {
        try {
          const status = await getApiKeyStatus(p.id);
          apiKeyStatus[p.id] = status.hasKey;
        } catch {
          apiKeyStatus[p.id] = false;
        }
      }
      set({
        providers,
        apiKeyStatus,
        activeProviderId: active?.id ?? providers[0]?.id ?? null,
        isLoaded: true,
      });
    } catch (e) {
      console.error("Failed to load AI providers:", e);
    }
  },

  addProvider: async (config, apiKey) => {
    await addProviderIpc(config);
    if (apiKey) {
      await setApiKeyIpc(config.id, apiKey);
    }
    const hasKey = !!apiKey;
    set((s) => ({
      providers: s.providers.filter((p) => p.id !== config.id).concat(config),
      activeProviderId: s.activeProviderId ?? config.id,
      apiKeyStatus: { ...s.apiKeyStatus, [config.id]: hasKey },
    }));
  },

  removeProvider: async (id) => {
    await removeProviderIpc(id);
    set((s) => {
      const { [id]: _, ...restKeys } = s.apiKeyStatus;
      return {
        providers: s.providers.filter((p) => p.id !== id),
        activeProviderId: s.activeProviderId === id ? (s.providers.filter((p) => p.id !== id)[0]?.id ?? null) : s.activeProviderId,
        apiKeyStatus: restKeys,
      };
    });
  },

  setActiveProvider: async (id) => {
    await setProviderIpc(id);
    set({ activeProviderId: id });
  },

  testProviderConnection: async (providerId, baseUrl, model) => {
    try {
      const result = await testConnection(providerId, baseUrl, model);
      return `Connected — ${result.responseContent || "(empty response)"}\nModel: ${result.model}\nTokens: ${result.usage.totalTokens} (${result.usage.promptTokens} prompt + ${result.usage.completionTokens} completion)`;
    } catch (e) {
      const detail = e && typeof e === 'object' ? (e as Record<string, unknown>).detail ?? String(e) : String(e);
      return `Connection failed: ${detail}`;
    }
  },

  setApiKey: async (providerId, apiKey) => {
    await setApiKeyIpc(providerId, apiKey);
    set((s) => ({
      apiKeyStatus: { ...s.apiKeyStatus, [providerId]: true },
    }));
  },

  refreshApiKeyStatus: async (providerId) => {
    try {
      const status = await getApiKeyStatus(providerId);
      set((s) => ({
        apiKeyStatus: { ...s.apiKeyStatus, [providerId]: status.hasKey },
      }));
    } catch {
      set((s) => ({
        apiKeyStatus: { ...s.apiKeyStatus, [providerId]: false },
      }));
    }
  },
}));

export interface ChatState {
  messages: Record<string, AiMessage[]>;
  loadingSessions: Record<string, boolean>;
  streamingSessions: Record<string, string>;
  loadedSessions: Record<string, boolean>;
  pendingActions: Record<string, AgentAction[]>;

  setMessages: (sessionId: string, messages: AiMessage[]) => void;
  addMessage: (sessionId: string, message: AiMessage) => void;
  updateLastAssistantMessage: (sessionId: string, content: string) => void;
  sendMessage: (sessionId: string, providerId: string, message: AiMessage, contextMessages?: AiMessage[]) => Promise<void>;
  sendSlashCommand: (sessionId: string, providerId: string, command: string, contextMessages?: AiMessage[]) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  saveSession: (sessionId: string) => Promise<void>;
  clearMessages: (sessionId: string) => void;
  applyPendingActions: (sessionId: string) => void;
  rejectPendingActions: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  loadingSessions: {},
  streamingSessions: {},
  loadedSessions: {},
  pendingActions: {},

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

      const allMessages = [...(contextMessages ?? []), ...updatedMessages].map((m) => ({ role: m.role, content: m.content }));

      await executeStreaming(get, set, sessionId, providerId, allMessages, updatedMessages);
      detectActions(sessionId, get, set);
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

      const systemMessage = { role: "system" as const, content: slashCmd.prompt };
      const allMessages = [...(contextMessages ?? []), systemMessage, ...updatedMessages].map((m) => ({ role: m.role, content: m.content }));

      await executeStreaming(get, set, sessionId, providerId, allMessages, updatedMessages);
      detectActions(sessionId, get, set);
    },

  loadSession: async (sessionId) => {
    if (get().loadedSessions[sessionId]) return;
    try {
      const messages = await aiLoadSession(sessionId);
      set((s) => ({
        messages: { ...s.messages, [sessionId]: messages },
        loadedSessions: { ...s.loadedSessions, [sessionId]: true },
      }));
    } catch {
      set((s) => ({
        loadedSessions: { ...s.loadedSessions, [sessionId]: true },
      }));
    }
  },

  saveSession: async (sessionId) => {
    const messages = get().messages[sessionId];
    if (!messages || messages.length === 0) return;
    try {
      await aiSaveSession(sessionId, messages);
    } catch (e) {
      console.error("Failed to save AI session:", e);
    }
  },

  clearMessages: (sessionId) => {
    set((s) => {
      const { [sessionId]: _, ...rest } = s.messages;
      const { [sessionId]: __, ...restActions } = s.pendingActions;
      return { messages: rest, pendingActions: restActions };
    });
    aiDeleteSession(sessionId).catch((e) => console.error("Failed to delete AI session:", e));
  },

  applyPendingActions: (sessionId) => {
    set((s) => {
      const { [sessionId]: _, ...rest } = s.pendingActions;
      return { pendingActions: rest };
    });
  },

  rejectPendingActions: (sessionId) => {
    set((s) => {
      const { [sessionId]: _, ...rest } = s.pendingActions;
      return { pendingActions: rest };
    });
  },
}));

function detectActions(sessionId: string, get: () => ChatState, set: (fn: (state: ChatState) => Partial<ChatState>) => void) {
  const msgs = get().messages[sessionId];
  if (!msgs || msgs.length === 0) return;

  const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return;

  const actions: AgentAction[] = [];
  const content = lastAssistant.content;
  console.log("[detectActions] scanning content, length=", content.length, "preview=", content.slice(0, 200));

  // Strategy 1: extract from ```json code blocks
  const codeBlockRe = /```json\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRe.exec(content)) !== null) {
    const jsonStr = match[1]?.trim();
    console.log("[detectActions] code block found:", jsonStr?.slice(0, 100));
    if (jsonStr) {
      const action = tryParseAction(jsonStr);
      if (action) { console.log("[detectActions] parsed action:", action.type); actions.push(action); }
      else console.log("[detectActions] failed to parse code block JSON");
    }
  }

  // Strategy 2: find standalone JSON objects containing "type" field
  if (actions.length === 0) {
    const jsonRe = /\{[\s\S]*?"type"\s*:\s*"[a-z_]+"[\s\S]*?\}/g;
    while ((match = jsonRe.exec(content)) !== null) {
      const jsonStr = match[0]?.trim();
      console.log("[detectActions] inline JSON found:", jsonStr?.slice(0, 100));
      if (jsonStr) {
        const action = tryParseAction(jsonStr);
        if (action) { console.log("[detectActions] parsed action:", action.type); actions.push(action); }
        else console.log("[detectActions] failed to parse inline JSON");
      }
    }
  }

  // Strategy 3: try to parse the entire content as JSON
  if (actions.length === 0) {
    const action = tryParseAction(content);
    if (action) { console.log("[detectActions] parsed whole content as action:", action.type); actions.push(action); }
  }

  console.log("[detectActions] found", actions.length, "actions");
  if (actions.length > 0) {
    set((s) => ({
      pendingActions: { ...s.pendingActions, [sessionId]: actions },
    }));
  }
}

function tryParseAction(jsonStr: string): AgentAction | null {
  try {
    let parsed = JSON.parse(jsonStr);
    parsed = normalizeActionJson(parsed);
    return parseAgentAction(parsed);
  } catch {
    return null;
  }
}

function normalizeActionJson(obj: Record<string, unknown>): Record<string, unknown> {
  const type = obj.type;
  if (typeof type !== "string") return obj;

  if (type === "create_request") {
    if (!obj.data) {
      // Case 1: data is nested under "request" key
      if (obj.request && typeof obj.request === "object") {
        obj.data = obj.request;
        delete obj.request;
      } else {
        // Case 2: flat fields at top level — wrap into data
        const data: Record<string, unknown> = {};
        for (const key of ["method", "url", "name", "headers", "body", "auth"]) {
          if (key in obj) {
            data[key] = obj[key];
            delete obj[key];
          }
        }
        if (Object.keys(data).length > 0) obj.data = data;
      }
    }
    // Add description if missing
    if (!obj.description) {
      const name = (obj.data as Record<string, unknown>)?.name;
      obj.description = typeof name === "string" ? `Create request: ${name}` : "Create request";
    }
  }

  // For other action types: ensure top-level fields are in data
  if (!obj.data && (type === "write_test" || type === "generate_doc" || type === "generate_mock" || type === "fix_error" || type === "extract_variables")) {
    const data: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (key !== "type" && key !== "description") {
        data[key] = obj[key];
        delete obj[key];
      }
    }
    if (Object.keys(data).length > 0) obj.data = data;
  }

  return obj;
}
