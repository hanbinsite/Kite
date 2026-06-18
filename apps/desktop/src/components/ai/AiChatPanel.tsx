import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore, useProviderStore, buildContextMessage, SLASH_COMMANDS } from "@api-client/core/ai";
import type { SlashCommand, AiProviderConfig } from "@api-client/core/ai";
import { useTabStore, useUIStore } from "@api-client/core";
import { useCollectionStore, useEnvironmentStore, useRequestStore } from "../../stores";
import { Send, Bot, User, Loader2, X, PanelRightClose, FileText, Globe, FolderOpen, Zap, ChevronRight, Key, Copy, RotateCw, Wrench } from "lucide-react";
import { AiActionCard } from "./AiActionCard";
import { McpToolsPanel } from "./McpToolsPanel";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-bg-input rounded-md p-3 text-xs font-mono overflow-x-auto my-2"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-bg-input text-brand px-1 rounded text-xs">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\n/g, '<br/>');
}

export function AiChatPanel() {
  const { t } = useTranslation();
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const sessionId = activeTabId ?? "global";
  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useUIStore((s) => s.setAiPanelOpen);

  const chatMessages = useChatStore((s) => s.messages);
  const loadingSessions = useChatStore((s) => s.loadingSessions);
  const streamingSessions = useChatStore((s) => s.streamingSessions);
  const messages = chatMessages[sessionId] ?? [];
  const loading = loadingSessions[sessionId] ?? false;
  const isStreaming = streamingSessions[sessionId] !== undefined;
  const pendingActions = useChatStore((s) => s.pendingActions[sessionId]) ?? [];
  const sendMessage = useChatStore((s) => s.sendMessage);
  const sendSlashCommand = useChatStore((s) => s.sendSlashCommand);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const loadSession = useChatStore((s) => s.loadSession);

  const providers = useProviderStore((s) => s.providers);
  const activeProviderId = useProviderStore((s) => s.activeProviderId);
  const setActiveProvider = useProviderStore((s) => s.setActiveProvider);
  const apiKeyStatus = useProviderStore((s) => s.apiKeyStatus);

  const environments = useEnvironmentStore((s) => s.environments);
  const collections = useCollectionStore((s) => s.collections);
  const currentResponse = useRequestStore((s) => activeTabId ? s.responses[activeTabId] : undefined);

  const [input, setInput] = useState("");
  const [showProviders, setShowProviders] = useState(false);
  const [includeRequest, setIncludeRequest] = useState(true);
  const [includeEnvironment, setIncludeEnvironment] = useState(true);
  const [includeCollection, setIncludeCollection] = useState(true);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [showMcpTools, setShowMcpTools] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeProvider = providers.find((p: AiProviderConfig) => p.id === activeProviderId);

  useEffect(() => {
    if (aiPanelOpen && sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId, aiPanelOpen, loadSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const buildContextMsgs = useCallback(() => {
    const contextMsgs: { role: "user" | "assistant" | "system"; content: string }[] = [];

    if (includeRequest && activeTab) {
      const reqInfo: string[] = [`Active request: ${activeTab.method ?? "GET"} ${activeTab.url ?? ""}`];
      if (currentResponse) {
        reqInfo.push(`Response: ${currentResponse.status} ${currentResponse.statusText}`);
        reqInfo.push(`Content-Type: ${currentResponse.contentType}`);
        const bodyPreview = currentResponse.body.slice(0, 500);
        if (bodyPreview) reqInfo.push(`Body preview: ${bodyPreview}`);
      }
      contextMsgs.push(buildContextMessage({ request: { method: activeTab.method ?? "GET", url: activeTab.url ?? "" } }));
      if (currentResponse) {
        contextMsgs.push({ role: "system" as const, content: `[Response Context] Status: ${currentResponse.status} ${currentResponse.statusText}\nContent-Type: ${currentResponse.contentType}\nBody preview: ${currentResponse.body.slice(0, 500)}` });
      }
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
      contextMsgs.push(buildContextMessage({ collections: collections.map((c) => c.name) }));
    }
    return contextMsgs;
  }, [activeTab, currentResponse, environments, collections, includeRequest, includeEnvironment, includeCollection]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !activeProviderId || loading) return;
    setInput("");

    if (text.startsWith("/")) {
      sendSlashCommand(sessionId, activeProviderId, text, buildContextMsgs());
    } else {
      sendMessage(sessionId, activeProviderId, { role: "user", content: text }, buildContextMsgs());
    }
  }, [input, activeProviderId, loading, sessionId, sendMessage, sendSlashCommand, buildContextMsgs]);

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    if (!activeProviderId || loading) return;
    setShowSlashMenu(false);
    setSlashFilter("");
    setInput("");
    sendSlashCommand(sessionId, activeProviderId, `/${cmd.key}`, buildContextMsgs());
  }, [activeProviderId, loading, sessionId, sendSlashCommand, buildContextMsgs]);

  const handleActionApply = useCallback((resultMessage: string) => {
    useChatStore.getState().applyPendingActions(sessionId);
    useChatStore.getState().addMessage(sessionId, { role: "assistant", content: resultMessage });
  }, [sessionId]);

  const handleActionReject = useCallback(() => {
    useChatStore.getState().rejectPendingActions(sessionId);
  }, [sessionId]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val.startsWith("/")) {
      setShowSlashMenu(true);
      setSlashFilter(val.slice(1).toLowerCase());
    } else {
      setShowSlashMenu(false);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") {
        setShowSlashMenu(false);
      }
    },
    [handleSend],
  );

  const filteredCommands = SLASH_COMMANDS.filter((cmd) =>
    cmd.key.toLowerCase().includes(slashFilter) || cmd.description.toLowerCase().includes(slashFilter)
  );

  if (!aiPanelOpen) return null;

  return (
    <div className="h-full flex flex-col bg-bg-base border-l border-border-default">
      <div className="h-10 flex items-center justify-between px-3 border-b border-border-default">
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-brand" />
          <span className="text-[12px] font-semibold text-fg-primary">{t("ai.assistant")}</span>
          {activeProvider && (
            <button
              onClick={() => setShowProviders(!showProviders)}
              className="flex items-center gap-1 text-[10px] text-fg-tertiary hover:text-fg-primary transition-colors cursor-pointer"
            >
              {activeProvider.model}
              {apiKeyStatus[activeProvider.id] ? (
                <Key className="w-2.5 h-2.5 text-accent-success" />
              ) : (
                <Key className="w-2.5 h-2.5 text-accent-danger" />
              )}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowMcpTools(!showMcpTools)}
            className={`p-1 rounded cursor-pointer transition-colors ${showMcpTools ? "text-brand bg-brand/10" : "text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover"}`}
            title={t("ai.mcpTools")}
          >
            <Wrench className="w-3 h-3" />
          </button>
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
              className={`w-full text-left px-3 py-1.5 text-[11px] cursor-pointer transition-colors flex items-center gap-2 ${p.id === activeProviderId ? "bg-brand/10 text-brand" : "text-fg-secondary hover:bg-bg-hover"}`}
            >
              <span className="flex-1">{p.name} — {p.model}</span>
              {apiKeyStatus[p.id] ? (
                <Key className="w-2.5 h-2.5 text-accent-success" />
              ) : (
                <Key className="w-2.5 h-2.5 text-accent-danger" />
              )}
            </button>
          ))}
        </div>
      )}

      {showMcpTools && (
        <div className="border-b border-border-default bg-bg-base px-3 py-2 max-h-[40%] overflow-y-auto">
          <McpToolsPanel />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-fg-tertiary text-xs gap-3">
            <span>{t("ai.emptyState")}</span>
            <div className="flex flex-wrap gap-1 justify-center">
              {SLASH_COMMANDS.slice(0, 5).map((cmd) => (
                <button
                  key={cmd.key}
                  onClick={() => handleSlashSelect(cmd)}
                  className="px-2 py-1 bg-bg-elevated border border-border-default rounded text-[10px] hover:border-brand hover:text-brand transition-colors cursor-pointer"
                >
                  {cmd.label}
                </button>
              ))}
            </div>
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
                __html: msg.role === "assistant" ? renderMarkdown(msg.content) : escapeHtml(msg.content),
              }}
            />
            <div className="flex items-center gap-0.5 mt-0.5">
              <button
                onClick={() => navigator.clipboard.writeText(msg.content)}
                className="p-0.5 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary transition-colors cursor-pointer"
                title={t("ai.copy")}
              >
                <Copy className="w-3 h-3" />
              </button>
              {msg.role === "assistant" && (
                <button
                  onClick={() => { setInput(""); if (activeProviderId) useChatStore.getState().sendMessage(sessionId, activeProviderId, { role: "user", content: "Please retry the previous action. Return a valid JSON action in a ```json code block." }, buildContextMsgs()); }}
                  className="p-0.5 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary transition-colors cursor-pointer"
                  title={t("ai.retry")}
                >
                  <RotateCw className="w-3 h-3" />
                </button>
              )}
            </div>
            {msg.role === "user" && (
              <User className="w-5 h-5 text-fg-tertiary shrink-0 mt-0.5" />
            )}
          </div>
        )        )}
        {pendingActions.length > 0 && (
          <AiActionCard
            actions={pendingActions}
            onApply={handleActionApply}
            onReject={handleActionReject}
          />
        )}
        {loading && !isStreaming && (
          <div className="flex gap-2">
            <Bot className="w-5 h-5 text-brand shrink-0 mt-0.5" />
            <div className="bg-bg-elevated border border-border-default rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 text-brand animate-spin" />
            </div>
          </div>
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-brand animate-pulse rounded-sm" />
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border-default">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <label className="flex items-center gap-1 text-[10px] text-fg-tertiary cursor-pointer select-none">
            <input type="checkbox" checked={includeRequest} onChange={(e) => setIncludeRequest(e.target.checked)} className="accent-brand" />
            <FileText className="w-3 h-3" /> {t("common.request")}
          </label>
          <label className="flex items-center gap-1 text-[10px] text-fg-tertiary cursor-pointer select-none">
            <input type="checkbox" checked={includeEnvironment} onChange={(e) => setIncludeEnvironment(e.target.checked)} className="accent-brand" />
            <Globe className="w-3 h-3" /> {t("common.environment")}
          </label>
          <label className="flex items-center gap-1 text-[10px] text-fg-tertiary cursor-pointer select-none">
            <input type="checkbox" checked={includeCollection} onChange={(e) => setIncludeCollection(e.target.checked)} className="accent-brand" />
            <FolderOpen className="w-3 h-3" /> {t("common.collection")}
          </label>
        </div>
        <div className="px-3 pb-3 relative">
          {!activeProviderId ? (
            <div className="text-[11px] text-fg-tertiary text-center py-2">
              {t("ai.noProvider")}
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={t("ai.messagePlaceholder")}
                  rows={2}
                  disabled={loading}
                  className="w-full bg-bg-input border border-border-default rounded-md px-3 py-2 text-xs text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus resize-none disabled:opacity-50"
                />
                {showSlashMenu && filteredCommands.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-bg-elevated border border-border-default rounded-md shadow-lg max-h-[200px] overflow-auto z-10">
                    {filteredCommands.map((cmd) => (
                      <button
                        key={cmd.key}
                        onClick={() => handleSlashSelect(cmd)}
                        className="w-full text-left px-3 py-2 hover:bg-bg-hover cursor-pointer transition-colors flex items-center gap-2"
                      >
                        <Zap className="w-3 h-3 text-brand shrink-0" />
                        <div>
                          <div className="text-[11px] text-fg-primary font-medium">{cmd.label}</div>
                          <div className="text-[10px] text-fg-tertiary">{cmd.description}</div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-fg-tertiary ml-auto" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
