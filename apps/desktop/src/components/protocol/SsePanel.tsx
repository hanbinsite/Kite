import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSseStore, type SseConnectionStatus } from "../../stores/sse-store";
import { Trash2, Link, Unlink, AlertCircle, Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";

interface SsePanelProps {
  connectionId: string;
}

const VIRTUALIZATION_THRESHOLD = 200;
const ROW_HEIGHT = 32;

function StatusDot({ status }: { status: SseConnectionStatus }) {
  const colors: Record<SseConnectionStatus, string> = {
    connected: "bg-accent-success",
    connecting: "bg-accent-warning animate-pulse",
    disconnected: "bg-fg-tertiary",
    error: "bg-accent-danger",
  };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[status]}`} />;
}

export function SsePanel({ connectionId }: SsePanelProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("https://example.com/events");
  const [filter, setFilter] = useState("");
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const connection = useSseStore((s) => s.connections[connectionId]);
  const connect = useSseStore((s) => s.connect);
  const disconnect = useSseStore((s) => s.disconnect);
  const clearEvents = useSseStore((s) => s.clearEvents);
  const setPaused = useSseStore((s) => s.setPaused);

  const status = connection?.status ?? "disconnected";
  const events = connection?.events ?? [];
  const error = connection?.error ?? null;
  const paused = connection?.paused ?? false;

  const handleConnect = useCallback(() => {
    if (status === "connected" || status === "connecting") {
      disconnect(connectionId);
    } else {
      connect(connectionId, url);
    }
  }, [connectionId, url, status, connect, disconnect]);

  const filteredEvents = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return events;
    return events.filter((e) => e.event.toLowerCase().includes(f));
  }, [events, filter]);

  const useVirtual = filteredEvents.length > VIRTUALIZATION_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: useVirtual ? filteredEvents.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
    enabled: useVirtual,
  });

  useEffect(() => {
    if (!useVirtual) {
      eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredEvents.length, useVirtual]);

  const renderEventRow = (evt: { event: string; data: string; timestamp: number }, index: number, virtualStyle?: React.CSSProperties) => {
    const isSystemEvent =
      evt.event === "connected" || evt.event === "disconnected" || evt.event === "error";
    return (
      <div
        key={index}
        style={virtualStyle}
        className={`sse-event flex items-start gap-2 px-3 py-1.5 border-b border-border-muted text-[12px] ${
          evt.event === "error"
            ? "bg-accent-danger/8"
            : isSystemEvent
              ? "bg-bg-elevated"
              : ""
        }`}
      >
        <span
          className={`shrink-0 mt-0.5 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${
            evt.event === "error"
              ? "bg-accent-danger/15 text-accent-danger"
              : evt.event === "connected" || evt.event === "disconnected"
                ? "bg-fg-tertiary/15 text-fg-tertiary"
                : "bg-method-sse/15 text-method-sse"
          }`}
        >
          {evt.event}
        </span>
        <span className="flex-1 break-all font-mono leading-snug text-fg-primary truncate">{evt.data}</span>
        <span className="shrink-0 text-fg-tertiary text-[10px] tabular-nums">
          {new Date(evt.timestamp).toLocaleTimeString()}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 h-[44px] px-3 border-b border-border-muted shrink-0">
        <StatusDot status={status} />
        <span className="text-[11px] font-medium text-fg-secondary shrink-0">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("sse.urlPlaceholder")}
          disabled={status === "connected" || status === "connecting"}
          className="flex-1 h-[28px] px-2 bg-bg-input border border-border-muted rounded text-[12px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus disabled:opacity-50 font-mono"
        />
        <button
          onClick={handleConnect}
          disabled={status === "connecting" || (!url.trim() && status === "disconnected")}
          className={`flex items-center gap-1 h-[28px] px-3 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
            status === "connected"
              ? "bg-accent-danger/15 text-accent-danger hover:bg-accent-danger/25"
              : "bg-method-sse/15 text-method-sse hover:bg-method-sse/25"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {status === "connected" ? <Unlink size={12} /> : <Link size={12} />}
          {status === "connected" ? t("sse.disconnect") : status === "connecting" ? t("sse.connecting") : t("sse.connect")}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-danger/8 border-b border-border-muted text-[11px] text-accent-danger">
          <AlertCircle size={12} className="shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between h-[28px] px-3 border-b border-border-muted shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em] shrink-0">
            {t("sse.events", { count: filteredEvents.length })}
          </span>
          {filter.trim() && (
            <span className="font-sans text-[10px] text-fg-tertiary shrink-0">
              {t("sse.filtered", { shown: filteredEvents.length, total: events.length })}
            </span>
          )}
          {paused && (
            <span className="font-sans text-[10px] font-bold text-accent-warning bg-accent-warning/15 px-1.5 py-0.5 rounded shrink-0">
              {t("sse.paused")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setPaused(connectionId, !paused)}
            disabled={status !== "connected"}
            className={`flex items-center gap-1 h-[22px] px-2 rounded text-[10px] font-medium cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              paused
                ? "bg-accent-success/15 text-accent-success hover:bg-accent-success/25"
                : "bg-accent-warning/15 text-accent-warning hover:bg-accent-warning/25"
            }`}
            title={paused ? t("sse.resume") : t("sse.pause")}
          >
            {paused ? <Play size={11} /> : <Pause size={11} />}
            {paused ? t("sse.resume") : t("sse.pause")}
          </button>
          <button
            onClick={() => clearEvents(connectionId)}
            className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-secondary cursor-pointer transition-colors"
            title={t("sse.clearEvents")}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="flex items-center h-[28px] px-3 border-b border-border-muted shrink-0">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("sse.filterPlaceholder")}
          className="flex-1 h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus"
        />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0" ref={scrollRef}>
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-fg-tertiary text-[12px]">
            {status === "connected" ? t("sse.emptyConnected") : t("sse.emptyDisconnected")}
          </div>
        ) : useVirtual ? (
          <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const evt = filteredEvents[virtualRow.index];
              if (!evt) return null;
              return renderEventRow(evt, virtualRow.index, {
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              });
            })}
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredEvents.map((evt, i) => renderEventRow(evt, i))}
            <div ref={eventsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
