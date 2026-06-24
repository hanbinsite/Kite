import { useState, useEffect, useCallback, Fragment } from "react";
import { Play, Square, Trash2, ChevronDown, ChevronRight, ShieldAlert, Download, Key, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProxyStore } from "../../stores/proxy-store";
import type { InterceptedRequest } from "@api-client/core/proxy";
import { useRequestStore } from "../../stores";
import { useTabStore } from "@api-client/core";
import type { Header } from "@api-client/types";
import { invoke } from "@tauri-apps/api/core";

const METHOD_COLORS: Record<string, string> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  PATCH: "text-method-patch",
  DELETE: "text-method-delete",
  HEAD: "text-fg-secondary",
  OPTIONS: "text-fg-secondary",
};

const STATUS_COLORS: Record<string, string> = {
  "2": "text-accent-success",
  "3": "text-[#4DACFF]",
  "4": "text-[#FFB800]",
  "5": "text-accent-danger",
};

function getStatusColorClass(status: number): string {
  return STATUS_COLORS[String(status)[0] ?? ""] ?? "text-fg-secondary";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBodyPreview(body: string): string {
  if (!body) return "";
  if (body.length <= 200) return body;
  return body.slice(0, 200) + "...";
}

function RequestRow({ req }: { req: InterceptedRequest }) {
  const { t } = useTranslation();
  const expandedId = useProxyStore((s) => s.expandedId);
  const setExpandedId = useProxyStore((s) => s.setExpandedId);
  const isExpanded = expandedId === req.id;

  const statusColorClass = getStatusColorClass(req.status);

  const handleImport = useCallback(() => {
    const tabId = useTabStore.getState().openTab({ name: `${req.method} ${req.path}`, method: req.method, url: req.url, protocol: "http" });
    const store = useRequestStore.getState();

    const headers: Header[] = req.headers.map((h) => ({
      key: h.key,
      value: h.value,
      disabled: false,
    }));

    store.initTabData(tabId, {
      headers,
      body: req.body ? { mode: "raw", raw: { language: "json", content: req.body } } : { mode: "none" },
    });

    setExpandedId(null);
  }, [req]);

  return (
    <div className="border-b border-border-muted">
      <div
        className="flex items-center gap-2 h-[36px] px-3 hover:bg-bg-elevated cursor-pointer select-none text-[12px]"
        onClick={() => setExpandedId(isExpanded ? null : req.id)}
      >
        <span className={METHOD_COLORS[req.method] ?? "text-fg-secondary"} style={{ fontWeight: 600, minWidth: 52 }}>
          {req.method}
        </span>
        <span className="text-fg-primary truncate flex-1">{req.path}</span>
        <span className={`${statusColorClass} min-w-[32px] text-right`}>{req.status || "-"}</span>
        <span className="text-fg-tertiary min-w-[48px] text-right">{formatDuration(req.durationMs)}</span>
        <span className="text-fg-tertiary min-w-[80px] text-right text-[11px]">{new Date(req.timestamp).toLocaleTimeString()}</span>
        {isExpanded ? <ChevronDown size={14} className="text-fg-tertiary shrink-0" /> : <ChevronRight size={14} className="text-fg-tertiary shrink-0" />}
      </div>
      {isExpanded && (
        <div className="px-4 pb-3 space-y-2 text-[12px]">
          <div>
            <div className="text-fg-secondary font-semibold mb-1">{t("proxy.fullUrl")}</div>
            <div className="text-fg-primary bg-bg-base px-2 py-1 rounded font-mono break-all">{req.url}</div>
          </div>

          <div>
            <div className="text-fg-secondary font-semibold mb-1">{t("proxy.host")}</div>
            <div className="text-fg-primary font-mono">{req.host}</div>
          </div>

          {req.headers.length > 0 && (
            <div>
              <div className="text-fg-secondary font-semibold mb-1">{t("proxy.requestHeaders")}</div>
              <div className="bg-bg-base rounded p-2 space-y-1 font-mono">
                {req.headers.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-brand shrink-0">{h.key}:</span>
                    <span className="text-fg-primary break-all">{h.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {req.body && (
            <div>
              <div className="text-fg-secondary font-semibold mb-1">{t("proxy.requestBody")}</div>
              <pre className="bg-bg-base rounded p-2 font-mono text-fg-primary whitespace-pre-wrap break-all text-[11px] max-h-[200px] overflow-auto">
                {formatBodyPreview(req.body)}
              </pre>
            </div>
          )}

          <div>
            <div className="text-fg-secondary font-semibold mb-1">{t("proxy.status")}</div>
            <span className={`${statusColorClass} font-semibold`}>{req.status}</span>
          </div>

          {req.responseHeaders.length > 0 && (
            <div>
              <div className="text-fg-secondary font-semibold mb-1">{t("proxy.responseHeaders")}</div>
              <div className="bg-bg-base rounded p-2 space-y-1 font-mono">
                {req.responseHeaders.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-brand shrink-0">{h.key}:</span>
                    <span className="text-fg-primary break-all">{h.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {req.responseBody && (
            <div>
              <div className="text-fg-secondary font-semibold mb-1">{t("proxy.responseBody")}</div>
              <pre className="bg-bg-base rounded p-2 font-mono text-fg-primary whitespace-pre-wrap break-all text-[11px] max-h-[200px] overflow-auto">
                {formatBodyPreview(req.responseBody)}
              </pre>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleImport}
              className="flex items-center gap-1 px-2 py-1 rounded bg-brand text-white text-[12px] hover:bg-brand-hover transition-colors"
            >
              <Download size={12} />
              {t("proxy.importToCollection")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProxyPanel() {
  const { t } = useTranslation();
  const status = useProxyStore((s) => s.status);
  const requests = useProxyStore((s) => s.requests);
  const startProxy = useProxyStore((s) => s.startProxy);
  const stopProxy = useProxyStore((s) => s.stopProxy);
  const refreshRequests = useProxyStore((s) => s.refreshRequests);
  const clearRequests = useProxyStore((s) => s.clearRequests);

  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState(8080);
  const [isStarting, setIsStarting] = useState(false);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [caCert, setCaCert] = useState<string | null>(null);
  const [showCaCert, setShowCaCert] = useState(false);

  const handleExportCaCert = async () => {
    try {
      const pem = await invoke<string>("export_proxy_ca");
      setCaCert(pem);
      setShowCaCert(true);
    } catch (e) {
      console.error("Failed to export CA certificate:", e);
    }
  };

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    try {
      await startProxy({ enabled: true, host, port });
      const interval = setInterval(() => { void refreshRequests(); }, 1500);
      setPollInterval(interval);
    } finally {
      setIsStarting(false);
    }
  }, [host, port, startProxy, refreshRequests]);

  const handleStop = useCallback(async () => {
    await stopProxy();
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  }, [stopProxy, pollInterval]);

  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const displayHost = status.port ? `127.0.0.1:${status.port}` : "-";

  return (
    <Fragment>
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 h-[44px] border-b border-border-muted shrink-0">
        <ShieldAlert size={16} className="text-brand" />
        <span className="text-[13px] font-semibold text-fg-primary">{t("proxy.panelTitle")}</span>
        {status.running && (
          <span className="text-[11px] text-accent-success bg-accent-success/10 px-2 py-0.5 rounded-full">
            {t("proxy.running", { addr: displayHost })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-muted shrink-0">
        {!status.running ? (
          <>
            <input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-[120px] h-[28px] px-2 bg-bg-input border border-border-muted rounded text-[12px] text-fg-primary font-mono outline-none placeholder:text-fg-tertiary"
              placeholder="127.0.0.1"
            />
            <span className="text-fg-tertiary text-[12px]">:</span>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              className="w-[70px] h-[28px] px-2 bg-bg-input border border-border-muted rounded text-[12px] text-fg-primary font-mono outline-none"
              min={1024}
              max={65535}
            />
            <button
              onClick={handleStart}
              disabled={isStarting}
              className="flex items-center gap-1 h-[28px] px-3 bg-brand text-white rounded text-[12px] font-semibold hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              <Play size={12} />
              {isStarting ? t("common.starting") : t("proxy.start")}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleStop}
              className="flex items-center gap-1 h-[28px] px-3 bg-accent-danger text-white rounded text-[12px] font-semibold hover:opacity-90 transition-opacity"
            >
              <Square size={12} />
              {t("proxy.stop")}
            </button>
            <span className="text-fg-tertiary text-[12px]">
              {t("proxy.interceptedCount", { count: requests.length > 0 ? requests.length : 0 })}
            </span>
            {requests.length > 0 && (
              <button
                onClick={clearRequests}
                className="flex items-center gap-1 h-[28px] px-2 text-fg-secondary hover:text-fg-primary text-[12px] transition-colors"
              >
                <Trash2 size={12} />
                {t("proxy.clear")}
              </button>
            )}
            <button
              onClick={handleExportCaCert}
              className="flex items-center gap-1 h-[28px] px-2 text-brand hover:text-brand-hover text-[12px] transition-colors"
            >
              <Key size={12} />
              {t("proxy.exportCaCert")}
            </button>
          </>
        )}
        <div className="flex-1" />
        <div className="text-fg-tertiary text-[11px]">
          {t("proxy.mitmNote")}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-fg-tertiary text-[13px] gap-2">
            <ShieldAlert size={32} className="opacity-30" />
            <span>{status.running ? t("proxy.waitingForRequests") : t("proxy.notRunning")}</span>
          </div>
        ) : (
          <div>
            <div className="flex items-center h-[28px] px-3 text-[11px] text-fg-secondary font-semibold bg-bg-elevated border-b border-border-muted">
              <span style={{ minWidth: 52 }}>{t("proxy.method")}</span>
              <span className="flex-1">{t("proxy.path")}</span>
              <span className="min-w-[32px] text-right">{t("proxy.status")}</span>
              <span className="min-w-[48px] text-right">{t("proxy.time")}</span>
              <span className="min-w-[80px] text-right">{t("proxy.timestamp")}</span>
              <span style={{ width: 14 }} />
            </div>
            {requests.map((req) => (
              <RequestRow key={req.id} req={req} />
            ))}
          </div>
        )}
      </div>
    </div>

      {showCaCert && caCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCaCert(false)}>
          <div className="bg-bg-surface border border-border-default rounded-lg shadow-2xl w-[500px] max-w-[90vw] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
              <span className="font-sans text-[13px] font-semibold text-fg-primary">{t("proxy.caCertTitle")}</span>
              <button onClick={() => setShowCaCert(false)} className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary cursor-pointer transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="px-4 py-3">
              <textarea
                readOnly
                value={caCert}
                className="w-full h-[240px] px-3 py-2 bg-bg-input border border-border-muted rounded-md font-mono text-[11px] text-fg-primary outline-none resize-none"
              />
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => {
                    const blob = new Blob([caCert], { type: "application/x-pem-file" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "kite-proxy-ca.pem";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="h-8 px-4 rounded-md bg-brand text-white text-[12px] font-medium cursor-pointer hover:bg-brand-hover transition-colors"
                >
                  <Download size={12} className="inline mr-1" />
                  {t("proxy.downloadCaCert")}
                </button>
                <button
                  onClick={() => setShowCaCert(false)}
                  className="h-8 px-4 rounded-md text-fg-secondary text-[12px] cursor-pointer hover:text-fg-primary transition-colors"
                >
                  {t("common.close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Fragment>
  );
}