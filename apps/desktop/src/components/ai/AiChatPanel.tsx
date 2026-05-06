import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore, useProviderStore, buildContextMessage } from "@api-client/core/ai";
import { useTabStore, useUIStore } from "@api-client/core";
import { useCollectionStore, useEnvironmentStore } from "../../stores";
import { Send, Bot, User, Loader2, X, PanelRightClose, FileText, Globe, FolderOpen } from "lucide-react";
import type { AiProviderConfig } from "@api-client/core/ai";

function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-bg-input rounded-md p-3 text-xs font-mono overflow-x-auto my-2"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-bg-input text-brand px-1 rounded text-xs">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\n/g, '<br/>');
}

export function AiChatPanel() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const sessionId = activeTabId ?? "global";
  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useUIStore((s) => s.setAiPanelOpen);

  const chatMessages = useChatStore((s) => s.messages);
  const loadingSessions = useChatStore((s) => s.loadingSessions);
  const messages = chatMessages[sessionId] ?? [];
  const loading = loadingSessions[sessionId] ?? false;
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const providers = useProviderStore((s) => s.providers);
  const activeProviderId = useProviderStore((s) => s.activeProviderId);
  const setActiveProvider = useProviderStore((s) => s.setActiveProvider);

  const environments = useEnvironmentStore((s) => s.environments);
  const collections = useCollectionStore((s) => s.collections);

  const [input, setInput] = useState("");
  const [showProviders, setShowProviders] = useState(false);
  const [includeRequest, setIncludeRequest] = useState(true);
  const [includeEnvironment, setIncludeEnvironment] = useState(true);
  const [includeCollection, setIncludeCollection] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeProvider = providers.find((p: AiProviderConfig) => p.id === activeProviderId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !activeProviderId || loading) return;
    setInput("");

    const contextMsgs: { role: "user" | "assistant" | "system"; content: string }[] = [];

    if (includeRequest && activeTab) {
      contextMsgs.push(buildContextMessage({
        request: { method: activeTab.method ?? "GET", url: activeTab.url ?? "" },
      }));
    }
    if (includeEnvironment && environments.length > 0) {
      contextMsgs.push(buildContextMessage({
        environments: environments.map((e) => ({
          name: e.name,
          variables: e.variables.filter((v) => v.enabled).map((v) => ({ key: v.key, value: v.value })),
        })),
      }));
    }
    if (includeCollection && collections.length > 0) {
      contextMsgs.push(buildContextMessage({
        collections: collections.map((c) => c.name),
      }));
    }

    sendMessage(sessionId, activeProviderId, { role: "user", content: text }, contextMsgs);
  }, [input, activeProviderId, loading, sessionId, sendMessage, activeTab, environments, collections, includeRequest, includeEnvironment, includeCollection]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!aiPanelOpen) return null;

  return (
    <div className="h-full flex flex-col bg-bg-base border-l border-border-default">
      <div className="h-10 flex items-center justify-between px-3 border-b border-border-default">
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-brand" />
          <span className="text-[12px] font-semibold text-fg-primary">AI Assistant</span>
          {activeProvider && (
            <button
              onClick={() => setShowProviders(!showProviders)}
              className="text-[10px] text-fg-tertiary hover:text-fg-primary transition-colors cursor-pointer"
            >
              {activeProvider.model}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => clearMessages(sessionId)}
              className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary cursor-pointer transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => setAiPanelOpen(false)}
            className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary cursor-pointer transition-colors"
          >
            <PanelRightClose className="w-3 h-3" />
          </button>
        </div>
      </div>

      {showProviders && (
        <div className="max-h-[120px] overflow-auto border-b border-border-default bg-bg-elevated">
          {providers.map((p: AiProviderConfig) => (
            <button
              key={p.id}
              onClick={() => { setActiveProvider(p.id); setShowProviders(false); }}
              className={`w-full text-left px-3 py-1.5 text-[11px] cursor-pointer transition-colors ${p.id === activeProviderId ? "bg-brand/10 text-brand" : "text-fg-secondary hover:bg-bg-hover"}`}
            >
              {p.name} — {p.model}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-fg-tertiary text-xs">
            Ask me anything about your APIs
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <Bot className="w-5 h-5 text-brand shrink-0 mt-0.5" />
            )}
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-brand text-white"
                  : "bg-bg-elevated text-fg-primary border border-border-default"
              }`}
              dangerouslySetInnerHTML={{
                __html: msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content,
              }}
            />
            {msg.role === "user" && (
              <User className="w-5 h-5 text-fg-tertiary shrink-0 mt-0.5" />
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <Bot className="w-5 h-5 text-brand shrink-0 mt-0.5" />
            <div className="bg-bg-elevated border border-border-default rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 text-brand animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border-default">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <label className="flex items-center gap-1 text-[10px] text-fg-tertiary cursor-pointer select-none">
            <input type="checkbox" checked={includeRequest} onChange={(e) => setIncludeRequest(e.target.checked)} className="accent-brand" />
            <FileText className="w-3 h-3" /> Request
          </label>
          <label className="flex items-center gap-1 text-[10px] text-fg-tertiary cursor-pointer select-none">
            <input type="checkbox" checked={includeEnvironment} onChange={(e) => setIncludeEnvironment(e.target.checked)} className="accent-brand" />
            <Globe className="w-3 h-3" /> Env
          </label>
          <label className="flex items-center gap-1 text-[10px] text-fg-tertiary cursor-pointer select-none">
            <input type="checkbox" checked={includeCollection} onChange={(e) => setIncludeCollection(e.target.checked)} className="accent-brand" />
            <FolderOpen className="w-3 h-3" /> Collection
          </label>
        </div>
        <div className="px-3 pb-3">
          {!activeProviderId ? (
            <div className="text-[11px] text-fg-tertiary text-center py-2">
              No AI provider configured. Add one in Settings → AI.
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={2}
                disabled={loading}
                className="flex-1 bg-bg-input border border-border-default rounded-md px-3 py-2 text-xs text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus resize-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="h-8 w-8 flex items-center justify-center bg-brand hover:bg-brand-hover text-white rounded-md cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}