import { useState, useRef, useEffect, useCallback } from "react";
import { useWsStore, type WsConnectionStatus } from "../../stores/websocket-store";
import { Trash2, Send, Link, Unlink, ArrowUp, ArrowDown, AlertCircle } from "lucide-react";
import { KeyValueEditor, type KeyValue } from "../request/KeyValueEditor";
import { useTranslation } from "react-i18next";

interface WebSocketPanelProps {
  connectionId: string;
}

const WS_TABS = [
  { id: "messages", labelKey: "ws.messages" },
  { id: "headers", labelKey: "ws.headers" },
  { id: "protocols", labelKey: "ws.protocols" },
] as const;

type WsTabId = (typeof WS_TABS)[number]["id"];

function StatusDot({ status }: { status: WsConnectionStatus }) {
  const colors: Record<WsConnectionStatus, string> = {
    connected: "bg-accent-success",
    connecting: "bg-accent-warning animate-pulse",
    disconnected: "bg-fg-tertiary",
    error: "bg-accent-danger",
  };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[status]}`} />;
}

export function WebSocketPanel({ connectionId }: WebSocketPanelProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("ws://localhost:8080");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<WsTabId>("messages");
  const [headers, setHeaders] = useState<KeyValue[]>([]);
  const [protocols, setProtocols] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const connection = useWsStore((s) => s.connections[connectionId]);
  const connect = useWsStore((s) => s.connect);
  const send = useWsStore((s) => s.send);
  const disconnect = useWsStore((s) => s.disconnect);
  const clearMessages = useWsStore((s) => s.clearMessages);

  const status = connection?.status ?? "disconnected";
  const messages = connection?.messages ?? [];
  const error = connection?.error ?? null;

  const buildHeaders = useCallback((): [string, string][] => {
    const result: [string, string][] = headers
      .filter((h) => h.enabled && h.key.trim())
      .map((h) => [h.key.trim(), h.value]);
    if (protocols.trim()) {
      result.push(["Sec-WebSocket-Protocol", protocols.trim()]);
    }
    return result;
  }, [headers, protocols]);

  const handleConnect = useCallback(() => {
    if (status === "connected" || status === "connecting") {
      disconnect(connectionId);
    } else {
      connect(connectionId, url, buildHeaders());
    }
  }, [connectionId, url, status, connect, disconnect, buildHeaders]);

  const handleSend = useCallback(() => {
    if (!message.trim()) return;
    send(connectionId, message);
    setMessage("");
  }, [connectionId, message, send]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 h-[44px] px-3 border-b border-border-muted shrink-0">
        <StatusDot status={status} />
        <span className="text-[11px] font-medium text-fg-secondary shrink-0">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("ws.urlPlaceholder")}
          disabled={status === "connected" || status === "connecting"}
          className="flex-1 h-[28px] px-2 bg-bg-input border border-border-muted rounded text-[12px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus disabled:opacity-50 font-mono"
        />
        <button
          onClick={handleConnect}
          disabled={status === "connecting" || (!url.trim() && status === "disconnected")}
          className={`flex items-center gap-1 h-[28px] px-3 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
            status === "connected"
              ? "bg-accent-danger/15 text-accent-danger hover:bg-accent-danger/25"
              : "bg-accent-success/15 text-accent-success hover:bg-accent-success/25"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {status === "connected" ? <Unlink size={12} /> : <Link size={12} />}
          {status === "connected" ? t("ws.disconnect") : status === "connecting" ? t("ws.connecting") : t("ws.connect")}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-danger/8 border-b border-border-muted text-[11px] text-accent-danger">
          <AlertCircle size={12} className="shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      <div className="flex items-center h-[32px] px-3 border-b border-border-muted shrink-0 gap-0">
        {WS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`h-[32px] px-3 flex items-center font-sans text-[11px] font-medium cursor-pointer transition-colors ${
              activeTab === tab.id ? "text-brand border-b-2 border-brand" : "text-fg-secondary hover:text-fg-primary"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === "messages" && (
        <>
          <div className="flex-1 overflow-y-auto min-h-0">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-fg-tertiary text-[12px]">
                {status === "connected" ? t("ws.emptyConnected") : t("ws.emptyDisconnected")}
              </div>
            ) : (
              <div className="flex flex-col">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`ws-msg flex items-start gap-2 px-3 py-1.5 border-b border-border-muted text-[12px] ${
                      msg.direction === "sent"
                        ? "bg-brand-muted/50"
                        : msg.direction === "error"
                          ? "bg-accent-danger/8"
                          : msg.direction === "system"
                            ? "bg-bg-elevated"
                            : ""
                    }`}
                  >
                    <span className="shrink-0 mt-0.5">
                      {msg.direction === "sent" && <ArrowUp size={12} className="text-brand" />}
                      {msg.direction === "received" && <ArrowDown size={12} className="text-accent-success" />}
                      {msg.direction === "system" && <AlertCircle size={12} className="text-fg-tertiary" />}
                      {msg.direction === "error" && <AlertCircle size={12} className="text-accent-danger" />}
                    </span>
                    <span className="flex-1 break-all font-mono leading-snug text-fg-primary">{msg.data}</span>
                    <span className="shrink-0 text-fg-tertiary text-[10px] tabular-nums">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {status === "connected" && (
            <div className="flex items-center gap-2 h-[44px] px-3 border-t border-border-muted shrink-0">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("ws.messagePlaceholder")}
                className="flex-1 h-[28px] px-2 bg-bg-input border border-border-muted rounded text-[12px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus font-mono"
              />
              <button
                onClick={handleSend}
                disabled={!message.trim()}
                className="flex items-center gap-1 h-[28px] px-3 rounded bg-brand text-white text-[11px] font-semibold cursor-pointer hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={12} />
{t("common.send")}
              </button>
              <button
                onClick={() => clearMessages(connectionId)}
                className="flex items-center justify-center w-[28px] h-[28px] rounded text-fg-tertiary hover:text-fg-secondary hover:bg-bg-hover cursor-pointer transition-colors"
                title={t("ws.clearMessages")}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === "headers" && (
        <div className="flex-1 overflow-auto">
          <KeyValueEditor
            items={headers}
            onChange={setHeaders}
            placeholder={{ key: t("request.header"), value: t("common.value") }}
            showDescription={false}
          />
        </div>
      )}

      {activeTab === "protocols" && (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-sans text-[11px] font-semibold text-fg-secondary">
{t("ws.secProtocol")}
            </label>
            <input
              type="text"
              value={protocols}
              onChange={(e) => setProtocols(e.target.value)}
              placeholder={t("ws.protocolsPlaceholder")}
              className="h-[28px] px-2 bg-bg-input border border-border-muted rounded text-[12px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus font-mono"
            />
            <span className="font-sans text-[10px] text-fg-tertiary">
              {t("ws.protocolsHint")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
