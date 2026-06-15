import { useState, useCallback, useEffect } from "react";
import { useMockStore } from "../../stores/mock-store";
import type { MockRoute, KeyValue } from "@api-client/core/mock";
import { Play, Square, Plus, Trash2, AlertCircle, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const METHOD_COLORS: Record<string, string> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  PATCH: "text-method-patch",
  DELETE: "text-method-delete",
  HEAD: "text-fg-secondary",
  OPTIONS: "text-fg-secondary",
};

function generateId() {
  return `route-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function RouteEditor({ route, onChange, onRemove }: { route: MockRoute; onChange: (r: MockRoute) => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderValue, setNewHeaderValue] = useState("");

  const addHeader = useCallback(() => {
    if (!newHeaderKey.trim()) return;
    const header: KeyValue = { key: newHeaderKey.trim(), value: newHeaderValue.trim() };
    onChange({ ...route, headers: [...route.headers, header] });
    setNewHeaderKey("");
    setNewHeaderValue("");
  }, [route, newHeaderKey, newHeaderValue, onChange]);

  const removeHeader = useCallback((idx: number) => {
    const headers = route.headers.filter((_: KeyValue, i: number) => i !== idx);
    onChange({ ...route, headers });
  }, [route, onChange]);

  return (
    <div className="border border-border-muted rounded-md overflow-hidden">
      <div
        className="flex items-center gap-2 h-[32px] px-2 bg-bg-elevated cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical size={12} className="text-fg-tertiary shrink-0 cursor-grab" />
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="shrink-0"
        >
          {expanded ? <ChevronDown size={12} className="text-fg-tertiary" /> : <ChevronRight size={12} className="text-fg-tertiary" />}
        </button>
        <select
          value={route.method}
          onChange={(e) => onChange({ ...route, method: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="h-[22px] px-1 bg-bg-input border border-border-muted rounded text-[11px] font-semibold outline-none cursor-pointer"
        >
          {HTTP_METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span className={`font-mono text-[11px] font-semibold ${METHOD_COLORS[route.method] ?? "text-fg-primary"}`}>
          {route.method}
        </span>
        <input
          type="text"
          value={route.path}
          onChange={(e) => onChange({ ...route, path: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder={t("mock.pathPlaceholder")}
          className="flex-1 h-[22px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus font-mono"
        />
        <span className="font-mono text-[11px] text-fg-secondary tabular-nums">{route.status}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-accent-danger cursor-pointer transition-colors shrink-0"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 px-3 py-2 border-t border-border-muted">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em] w-[50px] shrink-0">{t("common.status")}</span>
            <input
              type="number"
              value={route.status}
              onChange={(e) => onChange({ ...route, status: Number(e.target.value) || 200 })}
              className="w-[72px] h-[22px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none focus:border-border-focus font-mono"
            />
            <span className="font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em] w-[50px] shrink-0 ml-2">{t("mock.delay")}</span>
            <input
              type="number"
              value={route.delayMs}
              onChange={(e) => onChange({ ...route, delayMs: Number(e.target.value) || 0 })}
              className="w-[72px] h-[22px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none focus:border-border-focus font-mono"
              placeholder="0"
            />
            <span className="font-sans text-[10px] text-fg-tertiary">{t("mock.delayUnit")}</span>
          </div>

          <div>
            <span className="font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em]">{t("request.headers")}</span>
            <div className="flex flex-col gap-1 mt-1">
              {route.headers.map((h: KeyValue, i: number) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={h.key}
                    onChange={(e) => {
                      const headers = route.headers.map((hdr: KeyValue, j: number) => j === i ? { ...hdr, key: e.target.value } : hdr);
                      onChange({ ...route, headers });
                    }}
                    className="w-[120px] h-[22px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none focus:border-border-focus font-mono"
                    placeholder={t("mock.headerPlaceholder")}
                  />
                  <input
                    type="text"
                    value={h.value}
                    onChange={(e) => {
                      const headers = route.headers.map((hdr: KeyValue, j: number) => j === i ? { ...hdr, value: e.target.value } : hdr);
                      onChange({ ...route, headers });
                    }}
                    className="flex-1 h-[22px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none focus:border-border-focus font-mono"
                    placeholder={t("mock.valuePlaceholder")}
                  />
                  <button
                    onClick={() => removeHeader(i)}
                    className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-accent-danger cursor-pointer transition-colors shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newHeaderKey}
                  onChange={(e) => setNewHeaderKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addHeader()}
                  className="w-[120px] h-[22px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus font-mono"
                  placeholder={t("mock.headerPlaceholder")}
                />
                <input
                  type="text"
                  value={newHeaderValue}
                  onChange={(e) => setNewHeaderValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addHeader()}
                  className="flex-1 h-[22px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus font-mono"
                  placeholder={t("mock.valuePlaceholder")}
                />
                <button
                  onClick={addHeader}
                  disabled={!newHeaderKey.trim()}
                  className="h-[22px] px-2 rounded bg-bg-elevated border border-border-muted text-[10px] text-fg-secondary cursor-pointer hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
{t("common.add")}
                </button>
              </div>
            </div>
          </div>

          <div>
            <span className="font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em]">{t("mock.body")}</span>
            <textarea
              value={route.body}
              onChange={(e) => onChange({ ...route, body: e.target.value })}
              className="w-full h-[60px] mt-1 px-2 py-1 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none focus:border-border-focus font-mono resize-none placeholder:text-fg-tertiary"
              placeholder={t("mock.bodyPlaceholder")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function MockPanel() {
  const { t } = useTranslation();
  const status = useMockStore((s) => s.status);
  const routes = useMockStore((s) => s.routes);
  const requestLog = useMockStore((s) => s.requestLog);
  const error = useMockStore((s) => s.error);
  const startServer = useMockStore((s) => s.startServer);
  const stopServer = useMockStore((s) => s.stopServer);
  const addRoute = useMockStore((s) => s.addRoute);
  const removeRoute = useMockStore((s) => s.removeRoute);
  const updateRoute = useMockStore((s) => s.updateRoute);
  const clearRoutes = useMockStore((s) => s.clearRoutes);
  const clearLog = useMockStore((s) => s.clearLog);

  const MOCK_PORT_KEY = "api-client-mock-port";
const savedPort = (() => { try { const v = localStorage.getItem(MOCK_PORT_KEY); return v ? Number(v) : 0; } catch { return 0; } })();
const [port, setPort] = useState(savedPort || 4010);

  useEffect(() => {
    useMockStore.getState().loadRoutes();
    useMockStore.getState().refreshStatus();
  }, []);

  const handleToggle = useCallback(() => {
    if (status.running) {
      stopServer();
    } else {
      startServer({ port });
    }
  }, [status.running, port, startServer, stopServer]);

  const handleAddRoute = useCallback(() => {
    const route: MockRoute = {
      id: generateId(),
      method: "GET",
      path: "/api/hello",
      status: 200,
      headers: [{ key: "Content-Type", value: "application/json" }],
      body: '{"message": "Hello from mock server!"}',
      delayMs: 0,
    };
    addRoute(route);
  }, [addRoute]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 h-[44px] px-3 border-b border-border-muted shrink-0">
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${status.running ? "bg-accent-success" : "bg-fg-tertiary"}`} />
        <span className="font-sans text-[13px] font-semibold text-fg-primary">{t("mock.serverTitle")}</span>
        {status.running && status.port && (
          <span className="font-mono text-[10px] text-accent-success">:{status.port}</span>
        )}
        <div className="flex-1" />
        <label className="font-sans text-[10px] text-fg-tertiary">{t("mock.port")}</label>
        <input
          type="number"
          value={port}
          onChange={(e) => { const v = Number(e.target.value) || 4010; setPort(v); try { localStorage.setItem(MOCK_PORT_KEY, String(v)); } catch {} }}
          disabled={status.running}
          className="w-[72px] h-[28px] px-2 bg-bg-input border border-border-muted rounded text-[12px] text-fg-primary outline-none focus:border-border-focus disabled:opacity-50 font-mono"
        />
        <button
          onClick={handleToggle}
          disabled={!status.running && port < 1}
          className={`flex items-center gap-1 h-[28px] px-3 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
            status.running
              ? "bg-accent-danger/15 text-accent-danger hover:bg-accent-danger/25"
              : "bg-accent-success/15 text-accent-success hover:bg-accent-success/25"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {status.running ? <Square size={12} /> : <Play size={12} />}
          {status.running ? t("mock.stop") : t("mock.start")}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-danger/8 border-b border-border-muted text-[11px] text-accent-danger">
          <AlertCircle size={12} className="shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between h-[28px] px-3 border-b border-border-muted shrink-0">
        <span className="font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em]">
          {t("mock.routes", { count: routes.length })}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAddRoute}
            className="flex items-center gap-1 h-[22px] px-2 rounded bg-brand/10 text-brand text-[10px] font-semibold cursor-pointer hover:bg-brand/20 transition-colors"
          >
            <Plus size={10} />
            {t("mock.addRoute")}
          </button>
          <button
            onClick={clearRoutes}
            className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-secondary cursor-pointer transition-colors"
            title={t("mock.clearRoutes")}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {routes.length === 0 ? (
          <div className="flex items-center justify-center h-[120px] text-fg-tertiary text-[12px]">
            {t("mock.noRoutes")}
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {routes.map((route) => (
              <RouteEditor
                key={route.id}
                route={route}
                onChange={(r) => updateRoute(r)}
                onRemove={() => removeRoute(route.id)}
              />
            ))}
          </div>
        )}
      </div>

      {status.running && (
        <>
          <div className="flex items-center justify-between h-[28px] px-3 border-t border-b border-border-muted shrink-0">
            <span className="font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em]">
              {t("mock.requests", { count: requestLog.length })}
            </span>
            <button
              onClick={clearLog}
              className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-secondary cursor-pointer transition-colors"
              title={t("mock.clearLog")}
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div className="h-[140px] overflow-y-auto min-h-0">
            {requestLog.length === 0 ? (
              <div className="flex items-center justify-center h-full text-fg-tertiary text-[11px]">
                {t("mock.waitingForRequests", { port: status.port })}
              </div>
            ) : (
              <div className="flex flex-col">
                {requestLog.map((log, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-3 py-1 border-b border-border-muted text-[11px] ${
                      log.status >= 400 ? "bg-accent-danger/5" : ""
                    }`}
                  >
                    <span className={`font-mono text-[10px] font-semibold ${METHOD_COLORS[log.method] ?? "text-fg-primary"}`}>
                      {log.method}
                    </span>
                    <span className="font-mono text-[11px] text-fg-primary flex-1 truncate">{log.path}</span>
                    <span className={`font-mono text-[10px] tabular-nums ${log.status >= 400 ? "text-accent-danger" : "text-accent-success"}`}>
                      {log.status}
                    </span>
                    <span className="text-fg-tertiary text-[10px] tabular-nums shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
