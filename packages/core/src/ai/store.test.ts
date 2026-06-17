import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore, useProviderStore } from "./store";
import type { AiMessage } from "./index";

describe("useChatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: {},
      loadingSessions: {},
      streamingSessions: {},
      loadedSessions: {},
      pendingActions: {},
    });
  });

  it("starts with empty state", () => {
    const state = useChatStore.getState();
    expect(state.messages).toEqual({});
    expect(state.loadingSessions).toEqual({});
    expect(state.streamingSessions).toEqual({});
    expect(state.pendingActions).toEqual({});
  });

  it("setMessages stores messages per session", () => {
    const msgs: AiMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ];
    useChatStore.getState().setMessages("sess-1", msgs);
    expect(useChatStore.getState().messages["sess-1"]).toEqual(msgs);
  });

  it("addMessage appends to session", () => {
    useChatStore.getState().setMessages("sess-1", [{ role: "user", content: "Hi" }]);
    useChatStore.getState().addMessage("sess-1", { role: "assistant", content: "Hello!" });
    expect(useChatStore.getState().messages["sess-1"]).toHaveLength(2);
  });

  it("addMessage creates session if not exists", () => {
    useChatStore.getState().addMessage("new-sess", { role: "user", content: "First" });
    expect(useChatStore.getState().messages["new-sess"]).toHaveLength(1);
  });

  it("updateLastAssistantMessage updates the last assistant message", () => {
    useChatStore.getState().setMessages("sess-1", [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hel" },
    ]);
    useChatStore.getState().updateLastAssistantMessage("sess-1", "Hello World");
    const last = useChatStore.getState().messages["sess-1"]!.at(-1)!;
    expect(last.content).toBe("Hello World");
    expect(last.role).toBe("assistant");
  });

  it("updateLastAssistantMessage does nothing if last msg is not assistant", () => {
    useChatStore.getState().setMessages("sess-1", [{ role: "user", content: "Hi" }]);
    useChatStore.getState().updateLastAssistantMessage("sess-1", "Should not appear");
    const last = useChatStore.getState().messages["sess-1"]!.at(-1)!;
    expect(last.content).toBe("Hi");
    expect(last.role).toBe("user");
  });

  it("clearMessages removes session messages and pending actions", () => {
    useChatStore.getState().setMessages("sess-1", [{ role: "user", content: "data" }]);
    useChatStore.getState().setPendingActions("sess-1", [
      { type: "create_request", description: "test", data: { name: "X", method: "GET", url: "https://x.com" } },
    ]);
    useChatStore.getState().clearMessages("sess-1");
    expect(useChatStore.getState().messages["sess-1"]).toBeUndefined();
    expect(useChatStore.getState().pendingActions["sess-1"]).toBeUndefined();
  });

  it("setPendingActions stores actions", () => {
    const actions = [
      { type: "create_request" as const, description: "test", data: { name: "API", method: "GET" as const, url: "https://api.example.com" } },
    ];
    useChatStore.getState().setPendingActions("sess-1", actions);
    expect(useChatStore.getState().pendingActions["sess-1"]).toEqual(actions);
  });

  it("applyPendingActions removes pending actions", () => {
    useChatStore.getState().setPendingActions("sess-1", [
      { type: "create_request" as const, description: "test", data: { name: "X", method: "GET" as const, url: "https://x.com" } },
    ]);
    useChatStore.getState().applyPendingActions("sess-1");
    expect(useChatStore.getState().pendingActions["sess-1"]).toBeUndefined();
  });

  it("rejectPendingActions removes pending actions", () => {
    useChatStore.getState().setPendingActions("sess-1", [
      { type: "create_request" as const, description: "test", data: { name: "X", method: "GET" as const, url: "https://x.com" } },
    ]);
    useChatStore.getState().rejectPendingActions("sess-1");
    expect(useChatStore.getState().pendingActions["sess-1"]).toBeUndefined();
  });
});

describe("useProviderStore", () => {
  beforeEach(() => {
    useProviderStore.setState({
      providers: [],
      apiKeyStatus: {},
      activeProviderId: null,
      isLoaded: false,
    });
  });

  it("starts with empty providers", () => {
    const state = useProviderStore.getState();
    expect(state.providers).toEqual([]);
    expect(state.activeProviderId).toBeNull();
    expect(state.isLoaded).toBe(false);
    expect(state.apiKeyStatus).toEqual({});
  });
});