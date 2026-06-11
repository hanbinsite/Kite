import { useState, useRef, useEffect, useCallback } from "react";
import { useMqttStore, type MqttConnectionStatus } from "../../stores/mqtt-store";
import type { MqttConnectConfig } from "@api-client/core/mqtt";
import { Trash2, Link, Unlink, AlertCircle, ArrowUp, ArrowDown, Send } from "lucide-react";
import { useTranslation } from "react-i18next";

interface MqttPanelProps {
  connectionId: string;
}

const QOS_OPTIONS = [
  { value: 0, label: "0 - At most once" },
  { value: 1, label: "1 - At least once" },
  { value: 2, label: "2 - Exactly once" },
];

function StatusDot({ status }: { status: MqttConnectionStatus }) {
  const colors: Record<MqttConnectionStatus, string> = {
    connected: "bg-accent-success",
    connecting: "bg-accent-warning animate-pulse",
    disconnected: "bg-fg-tertiary",
    error: "bg-accent-danger",
  };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[status]}`} />;
}

const DEFAULT_CONFIG: MqttConnectConfig = {
  broker: "localhost",
  port: 1883,
  clientId: `mqtt-client-${Math.random().toString(36).slice(2, 8)}`,
  cleanSession: true,
  keepAlive: 60,
};

export function MqttPanel({ connectionId }: MqttPanelProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<MqttConnectConfig>(DEFAULT_CONFIG);
  const [subTopic, setSubTopic] = useState("");
  const [subQos, setSubQos] = useState(0);
  const [pubTopic, setPubTopic] = useState("");
  const [pubPayload, setPubPayload] = useState("");
  const [pubQos, setPubQos] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const connection = useMqttStore((s) => s.connections[connectionId]);
  const doConnect = useMqttStore((s) => s.connect);
  const subscribe = useMqttStore((s) => s.subscribe);
  const publish = useMqttStore((s) => s.publish);
  const doDisconnect = useMqttStore((s) => s.disconnect);
  const clearMessages = useMqttStore((s) => s.clearMessages);

  const status = connection?.status ?? "disconnected";
  const messages = connection?.messages ?? [];
  const subscriptions = connection?.subscriptions ?? [];
  const error = connection?.error ?? null;

  const handleConnect = useCallback(() => {
    if (status === "connected" || status === "connecting") {
      doDisconnect(connectionId);
    } else {
      doConnect(connectionId, config);
    }
  }, [connectionId, config, status, doConnect, doDisconnect]);

  const handleSubscribe = useCallback(() => {
    if (!subTopic.trim()) return;
    subscribe(connectionId, subTopic.trim(), subQos);
    setSubTopic("");
  }, [connectionId, subTopic, subQos, subscribe]);

  const handlePublish = useCallback(() => {
    if (!pubTopic.trim()) return;
    publish(connectionId, pubTopic.trim(), pubPayload, pubQos);
    setPubPayload("");
  }, [connectionId, pubTopic, pubPayload, pubQos, publish]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 h-[44px] px-3 border-b border-border-muted shrink-0">
        <StatusDot status={status} />
        <input
          type="text"
          value={config.broker}
          onChange={(e) => setConfig((c) => ({ ...c, broker: e.target.value }))}
          placeholder="Broker host"
          disabled={status === "connected" || status === "connecting"}
          className="flex-1 h-[28px] px-2 bg-bg-input border border-border-muted rounded text-[12px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus disabled:opacity-50 font-mono"
        />
        <input
          type="number"
          value={config.port}
          onChange={(e) => setConfig((c) => ({ ...c, port: Number(e.target.value) || 1883 }))}
          disabled={status === "connected" || status === "connecting"}
          className="w-[72px] h-[28px] px-2 bg-bg-input border border-border-muted rounded text-[12px] text-fg-primary outline-none focus:border-border-focus disabled:opacity-50 font-mono"
        />
        <button
          onClick={handleConnect}
          disabled={status === "connecting" || (!config.broker.trim() && status === "disconnected")}
          className={`flex items-center gap-1 h-[28px] px-3 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
            status === "connected"
              ? "bg-accent-danger/15 text-accent-danger hover:bg-accent-danger/25"
              : "bg-method-mqtt/15 text-method-mqtt hover:bg-method-mqtt/25"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {status === "connected" ? <Unlink size={12} /> : <Link size={12} />}
          {status === "connected" ? "Disconnect" : status === "connecting" ? "Connecting..." : "Connect"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-danger/8 border-b border-border-muted text-[11px] text-accent-danger">
          <AlertCircle size={12} className="shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {status === "connected" && (
        <div className="flex flex-col gap-1 px-3 py-2 border-b border-border-muted shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em] w-[60px] shrink-0">{t("mqtt.subscribe")}</span>
            <input
              type="text"
              value={subTopic}
              onChange={(e) => setSubTopic(e.target.value)}
              placeholder="topic/filter"
              className="flex-1 h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleSubscribe()}
            />
            <select
              value={subQos}
              onChange={(e) => setSubQos(Number(e.target.value))}
              className="h-[24px] px-1 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none"
            >
              {QOS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em] w-[60px] shrink-0">{t("mqtt.publish")}</span>
            <input
              type="text"
              value={pubTopic}
              onChange={(e) => setPubTopic(e.target.value)}
              placeholder="topic"
              className="w-[140px] h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus font-mono"
            />
            <input
              type="text"
              value={pubPayload}
              onChange={(e) => setPubPayload(e.target.value)}
              placeholder="payload"
              className="flex-1 h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus font-mono"
              onKeyDown={(e) => e.key === "Enter" && handlePublish()}
            />
            <select
              value={pubQos}
              onChange={(e) => setPubQos(Number(e.target.value))}
              className="h-[24px] px-1 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none"
            >
              {QOS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
              onClick={handlePublish}
              disabled={!pubTopic.trim()}
              className="flex items-center gap-1 h-[24px] px-2 rounded bg-brand text-white text-[10px] font-semibold cursor-pointer hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={10} />
{t("common.send")}
            </button>
          </div>
          {subscriptions.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-sans text-[10px] text-fg-tertiary">Subs:</span>
              {subscriptions.map((t) => (
                <span key={t} className="font-mono text-[10px] px-1.5 py-0.5 bg-method-mqtt/10 text-method-mqtt rounded">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between h-[28px] px-3 border-b border-border-muted shrink-0">
        <span className="font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em]">
          Messages ({messages.length})
        </span>
        <button
          onClick={() => clearMessages(connectionId)}
          className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-secondary cursor-pointer transition-colors"
          title="Clear messages"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-fg-tertiary text-[12px]">
            {status === "connected" ? t("mqtt.emptyConnected") : t("mqtt.emptyDisconnected")}
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`mqtt-msg flex items-start gap-2 px-3 py-1.5 border-b border-border-muted text-[12px] ${
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
                {msg.topic && (
                  <span className="shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-method-mqtt/15 text-method-mqtt">
                    {msg.topic}
                  </span>
                )}
                <span className="flex-1 break-all font-mono leading-snug text-fg-primary">{msg.payload}</span>
                <span className="shrink-0 text-fg-tertiary text-[10px] tabular-nums">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
