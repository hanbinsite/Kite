import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore, useUIStore } from "@api-client/core";
import { useChatStore, useProviderStore, buildContextMessage } from "@api-client/core/ai";
import { useRequestStore } from "../../stores";
import { JsonViewer } from "../response/JsonViewer";
import { ConsolePanel } from "../console/ConsolePanel";
import { TestsTab } from "../response/TestsTab";
import { ScriptErrorCard } from "../response/ScriptErrorCard";
import type { ResponseHeader, Cookie } from "@api-client/types";
import { Clock, HardDrive, ArrowDownToLine, Maximize2, Columns2, Zap, AlertTriangle, RefreshCw, Search, Copy, Brain, Wrench } from "lucide-react";

const RESPONSE_TABS = (t: (key: string) => string) => [
  { id: "body", label: t("response.body") },
  { id: "headers", label: t("response.headers") },
  { id: "cookies", label: t("response.cookies") },
  { id: "console", label: t("response.console") },
  { id: "tests", label: t("response.tests") },
] as const;

type ResponseTabId = ReturnType<typeof RESPONSE_TABS>[number]["id"];

type BodyViewMode = "pretty" | "raw" | "preview";

function getStatusClass(status: number): string {
  if (status >= 200 && status < 300) return "s2xx text-accent-success bg-accent-success/12";
  if (status >= 300 && status < 400) return "s3xx text-accent-info bg-accent-info/12";
  if (status >= 400 && status < 500) return "s4xx text-accent-warning bg-accent-warning/12";
  return "s5xx text-accent-danger bg-accent-danger/12";
}

const LARGE_BODY_THRESHOLD = 1 * 1024 * 1024;
const TRUNCATE_SIZE = 2 * 1024 * 1024;

function formatBodySize(bytes: number): string {
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function ResponsePanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ResponseTabId>("body");
  const [bodyView, setBodyView] = useState<BodyViewMode>("pretty");
  const [showTruncated, setShowTruncated] = useState(false);

  const activeTabId = useTabStore((s) => s.activeTabId);
  const responses = useRequestStore((s) => s.responses);
  const testResults = useRequestStore((s) => s.testResults);
  const loadingTabs = useRequestStore((s) => s.loadingTabs);
  const error = useRequestStore((s) => s.error);
  const requestDataMap = useRequestStore((s) => s.requestDataMap);

  const response = activeTabId ? responses[activeTabId] : undefined;
  const currentTestResults = activeTabId ? (testResults[activeTabId] ?? []) : [];
  const isLoading = activeTabId ? !!loadingTabs[activeTabId] : false;

  const responseTabs = RESPONSE_TABS(t);
  const tabRefs = useRef<Partial<Record<ResponseTabId, HTMLButtonElement | null>>>({});

  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el) {
      const parent = el.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        setIndicatorStyle({
          left: elRect.left - parentRect.left,
          width: elRect.width,
        });
      }
    }
  }, [activeTab]);

  useEffect(() => {
    const updateIndicator = () => {
      const el = tabRefs.current[activeTab];
      if (el) {
        const parent = el.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          setIndicatorStyle({
            left: elRect.left - parentRect.left,
            width: elRect.width,
          });
        }
      }
    };

    const observer = new ResizeObserver(updateIndicator);
    const parent = tabRefs.current[activeTab]?.parentElement;
    if (parent) observer.observe(parent);
    return () => observer.disconnect();
  }, [activeTab]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-bg-surface">
        <div className="response-loading flex flex-col items-center justify-center h-full gap-4">
          <div className="response-loading-spinner w-6 h-6 border-2 border-border-default border-t-brand rounded-full animate-spin" />
          <span className="response-loading-timer font-mono text-[11px] text-brand">{t("response.sending")}</span>
        </div>
      </div>
    );
  }

  if (!response && !error) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-bg-surface">
        <div className="response-empty flex flex-col items-center justify-center h-full gap-3 text-center">
          <Zap className="response-empty-icon w-[48px] h-[48px] text-fg-tertiary opacity-30" />
          <span className="response-empty-text font-sans text-[13px] text-fg-tertiary">
            {t("response.hitSend")}
          </span>
          <span className="response-empty-shortcut font-mono text-[11px] text-fg-tertiary py-[2px] px-2 bg-bg-active rounded-[4px]">
            ⌘ Enter
          </span>
        </div>
      </div>
    );
  }

  if (error && !response) {
    const isScriptError = error.startsWith("Script Error");
    if (isScriptError) {
      const match = error.match(/^Script Error \[([^\]]+)\]: (.+)$/s);
      const source = match?.[1] ?? "Unknown";
      const message = match?.[2] ?? error;
      return (
        <div className="h-full flex flex-col overflow-hidden bg-bg-surface">
          <ScriptErrorCard phase="pre-request" source={source} error={message} />
        </div>
      );
    }
    const isSslError = error.toLowerCase().includes("ssl") || error.toLowerCase().includes("tls") || error.toLowerCase().includes("certificate");
    return (
      <div className="h-full flex flex-col overflow-hidden bg-bg-surface">
        <div className="response-error flex flex-col items-center justify-center h-full gap-4 text-center px-8">
          <AlertTriangle className="w-10 h-10 text-accent-danger" />
          <div className="flex flex-col gap-1">
            <span className="font-sans text-sm font-semibold text-accent-danger">{t("response.requestFailed")}</span>
            <span className="response-error-message font-mono text-xs text-accent-danger bg-accent-danger/8 px-3 py-2 rounded-md max-w-[480px]">{error}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const { sendRequest } = useRequestStore.getState();
                const tabId = useTabStore.getState().activeTabId;
                const tab = useTabStore.getState().tabs.find((t) => t.id === tabId);
                if (tabId && tab) sendRequest(tabId, tab.method as "GET", tab.url);
              }}
              className="flex items-center gap-1.5 h-8 px-4 rounded-md bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors"
            >
              <RefreshCw size={12} />
              {t("common.retry")}
            </button>
          </div>
          {isSslError && (
            <label className="flex items-center gap-2 text-xs text-fg-tertiary mt-2 cursor-pointer">
              <input
                type="checkbox"
checked={!(requestDataMap[activeTabId ?? ""]?.settings.verifySsl)}
                          onChange={(e) => {
                            const s = useRequestStore.getState();
                            const tabId = s.currentTabId;
                            const settings = tabId ? s.requestDataMap[tabId]?.settings : undefined;
                            useRequestStore.getState().setRequestSettings({
                              ...(settings ?? { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, verifySsl: true }),
                              verifySsl: !e.target.checked,
                            });
                }}
                className="accent-brand"
              />
              {t("response.skipSSL")}
            </label>
          )}
        </div>
      </div>
    );
  }

    if (!response) return null;

    return (
        <div className="h-full flex flex-col overflow-hidden bg-bg-surface">
            <div className="response-bar flex items-center h-[32px] px-3 gap-2 bg-bg-surface border-t border-border-muted border-b border-border-muted shrink-0">
                <span className={`response-status-pill flex items-center gap-[4px] h-[20px] px-2 rounded-full font-mono text-[11px] font-semibold ${getStatusClass(response.status)}`}>
                    {response.status} {response.statusText}
                </span>
                <span className="response-meta font-sans text-[11px] text-fg-tertiary flex items-center gap-1">
                    <Clock size={12} />
                    {response.time} ms
                </span>
                <span className="response-meta font-sans text-[11px] text-fg-tertiary flex items-center gap-1">
                    <HardDrive size={12} />
                    {formatBodySize(response.bodySize)}
                </span>
                <div className="flex-1" />
                <div className="response-bar-tools flex gap-[2px]">
                    <button
                      onClick={() => {
                         useUIStore.getState().setAiPanelOpen(true);
                         const sessionId = activeTabId ?? "global";
                         const providerId = useProviderStore.getState().activeProviderId;
                         if (providerId) {
                           const tab = useTabStore.getState().tabs.find((t) => t.id === activeTabId);
                           const ctxMsgs: { role: "user" | "assistant" | "system"; content: string }[] = [];
                           if (tab) {
                             ctxMsgs.push(buildContextMessage({ request: { method: tab.method ?? "GET", url: tab.url ?? "" } }));
                           }
                           ctxMsgs.push({ role: "system", content: `[Response Context] Status: ${response.status} ${response.statusText}\nContent-Type: ${response.contentType}\nBody preview: ${response.body.slice(0, 500)}` });
                           useChatStore.getState().sendSlashCommand(sessionId, providerId, response.status >= 400 ? "/fix" : "/explain", ctxMsgs);
                         }
                       }}
                      className={`response-bar-btn h-6 px-2 rounded-[4px] flex items-center gap-1 text-[10px] font-medium cursor-pointer transition-all duration-50 ${response.status >= 400 ? "text-accent-danger hover:bg-accent-danger/10" : "text-brand hover:bg-brand/10"}`}
                    >
                        {response.status >= 400 ? <Wrench size={12} /> : <Brain size={12} />}
                {response.status >= 400 ? t("response.fix") : t("response.explain")}
                    </button>
                    <button className="response-bar-btn w-6 h-6 rounded-[4px] flex items-center justify-center text-fg-tertiary cursor-pointer hover:bg-bg-hover hover:text-fg-secondary transition-all duration-50">
                        <Columns2 size={14} />
                    </button>
                    <button className="response-bar-btn w-6 h-6 rounded-[4px] flex items-center justify-center text-fg-tertiary cursor-pointer hover:bg-bg-hover hover:text-fg-secondary transition-all duration-50">
                        <ArrowDownToLine size={14} />
                    </button>
                    <button className="response-bar-btn w-6 h-6 rounded-[4px] flex items-center justify-center text-fg-tertiary cursor-pointer hover:bg-bg-hover hover:text-fg-secondary transition-all duration-50">
                        <Maximize2 size={14} />
                    </button>
                </div>
            </div>

            <div className="response-tabs flex items-center h-[36px] bg-bg-surface border-b border-border-muted px-3 gap-0 relative shrink-0">
                {responseTabs.map((tab) => (
                    <button
                        key={tab.id}
                        ref={(el) => { tabRefs.current[tab.id] = el; }}
                        onClick={() => setActiveTab(tab.id)}
                        className={`request-tab h-[36px] px-[14px] flex items-center gap-[6px] font-sans text-[12px] font-medium cursor-pointer whitespace-nowrap relative transition-colors duration-50 ${
                            activeTab === tab.id ? "active text-fg-primary" : "text-fg-secondary hover:text-fg-primary"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
                <div
                    className="request-tab-indicator absolute bottom-0 h-[2px] bg-brand rounded-[1px] transition-left duration-[180ms] transition-width duration-[180ms]"
                    style={{
                        left: `${indicatorStyle.left}px`,
                        width: `${indicatorStyle.width}px`,
                        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                />
            </div>

            <div className="flex-1 overflow-hidden">
                {activeTab === "body" && (
                    <div className="flex flex-col h-full">
                        <div className="response-preview-toolbar flex items-center gap-2 h-[32px] px-3 border-b border-border-muted">
                            {(["pretty", "raw", "preview"] as BodyViewMode[]).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setBodyView(mode)}
                                    className={`response-preview-mode flex items-center gap-[4px] h-[24px] px-2 rounded-[4px] font-sans text-[11px] font-medium cursor-pointer transition-all duration-50 ${
                                        bodyView === mode
                                            ? "active text-brand bg-brand-muted"
                                            : "text-fg-secondary hover:bg-bg-hover"
                                    }`}
                                >
                                    {t(`response.${mode}`)}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-auto">
                            {response.bodySize > LARGE_BODY_THRESHOLD && !showTruncated && (
                                <div className="flex items-center justify-center h-full flex-col gap-3">
                                    <AlertTriangle className="w-8 h-8 text-accent-warning" />
                                    <p className="font-sans text-[13px] text-fg-secondary">
                                        {t("response.largeResponse")} ({formatBodySize(response.bodySize)})
                                    </p>
                                    <button
                                        onClick={() => setShowTruncated(true)}
                                        className="h-[28px] px-4 rounded-md font-sans text-[12px] font-medium text-brand bg-brand-muted hover:bg-brand/20 cursor-pointer transition-colors"
                                    >
                                        {t("response.showAnyway")}
                                    </button>
                                </div>
                            )}
                            {(response.bodySize <= LARGE_BODY_THRESHOLD || showTruncated) && (
                                <>
                                    {bodyView === "pretty" && (
                                        <JsonViewer data={response.bodySize > TRUNCATE_SIZE ? response.body.slice(0, TRUNCATE_SIZE) + `\n${t("response.truncatedSuffix")}` : response.body} />
                                    )}

                                    {bodyView === "raw" && (
                                        <div className="p-2 px-3 overflow-auto h-full">
                                            <pre className="font-mono text-[12px] text-fg-primary whitespace-pre-wrap">
                                                {response.bodySize > TRUNCATE_SIZE ? response.body.slice(0, TRUNCATE_SIZE) + `\n${t("response.truncatedSuffix")}` : response.body}
                                            </pre>
                                        </div>
                                    )}

                                    {bodyView === "preview" && (
                                        <div className="p-2 px-3 overflow-auto h-full">
                                            <iframe
                                                srcDoc={response.body}
                                                className="w-full h-full min-h-[200px] bg-white"
                                                sandbox=""
                                                title={t("response.responsePreview")}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "headers" && (
                    <ResponseHeadersTab headers={response.headers} />
                )}

                {activeTab === "cookies" && (
                    <ResponseCookiesTab headers={response.headers} />
                )}

                {activeTab === "console" && (
                    <ConsolePanel />
                )}

                {activeTab === "tests" && (
                    <TestsTab results={currentTestResults} />
                )}
            </div>
        </div>
    );
}

function ResponseHeadersTab({ headers }: { headers: ResponseHeader[] }) {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState("");
    const [copied, setCopied] = useState(false);

    const filtered = useMemo(() => {
        if (!searchTerm) return headers;
        const lower = searchTerm.toLowerCase();
        return headers.filter((h) => h.key.toLowerCase().includes(lower) || h.value.toLowerCase().includes(lower));
    }, [headers, searchTerm]);

    const handleCopyAll = useCallback(async () => {
        const text = headers.map((h) => `${h.key}: ${h.value}`).join("\n");
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
    }, [headers]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 h-[32px] px-3 border-b border-border-muted shrink-0">
                <Search size={12} className="text-fg-tertiary shrink-0" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t("response.filterHeaders")}
                    className="flex-1 h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus"
                />
                <button
                    onClick={handleCopyAll}
                    className="flex items-center gap-1 h-[24px] px-2 text-[11px] font-medium text-fg-secondary hover:text-fg-primary bg-bg-hover rounded cursor-pointer transition-colors"
                >
                    <Copy size={10} />
                    {copied ? t("common.copied") : t("response.copyAll")}
                </button>
            </div>
            <div className="flex-1 overflow-auto">
                {filtered.map((header, i) => (
                    <div
                        key={i}
                        className="response-header-row grid grid-cols-[240px_1fr] h-[28px] px-3 items-center border-b border-border-muted transition-colors duration-50 hover:bg-bg-hover"
                    >
                        <span className="response-header-key font-mono text-[12px] font-semibold text-fg-primary overflow-hidden text-ellipsis whitespace-nowrap">
                            {header.key}
                        </span>
                        <span className="response-header-value font-mono text-[12px] text-fg-secondary overflow-hidden text-ellipsis whitespace-nowrap">
                            {header.value}
                        </span>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="flex items-center justify-center h-[80px] text-fg-tertiary text-[12px]">
                        {t("response.noHeaders")}
                    </div>
                )}
            </div>
        </div>
    );
}

function parseSetCookieHeaders(headers: ResponseHeader[]): Cookie[] {
    const cookies: Cookie[] = [];
    for (const h of headers) {
        if (h.key.toLowerCase() !== "set-cookie") continue;
        const parts = h.value.split(";").map((p) => p.trim());
        const nameValue = parts[0];
        if (!nameValue) continue;
        const eqIndex = nameValue.indexOf("=");
        if (eqIndex === -1) continue;
        const name = nameValue.substring(0, eqIndex).trim();
        const value = nameValue.substring(eqIndex + 1).trim();
        const cookie: Cookie = { name, value };
        for (const part of parts.slice(1)) {
            const kv = part.split("=");
            const attrName = (kv[0] ?? "").trim().toLowerCase();
            const attrValue = kv.length > 1 ? kv.slice(1).join("=").trim() : "";
            if (attrName === "domain") cookie.domain = attrValue;
            else if (attrName === "path") cookie.path = attrValue;
            else if (attrName === "expires") cookie.expires = attrValue;
            else if (attrName === "secure") cookie.secure = true;
            else if (attrName === "httponly") cookie.httpOnly = true;
        }
        cookies.push(cookie);
    }
    return cookies;
}

function ResponseCookiesTab({ headers }: { headers: ResponseHeader[] }) {
    const { t } = useTranslation();
    const cookies = useMemo(() => parseSetCookieHeaders(headers), [headers]);

    if (cookies.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-fg-tertiary">
                <span className="text-[12px]">{t("response.noCookies")}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-auto">
            <div className="grid grid-cols-[1fr_2fr_120px_80px_60px_60px_100px] h-[28px] px-3 items-center border-b border-border-muted bg-bg-elevated">
                <span className="font-sans text-[11px] font-semibold text-fg-secondary">{t("common.name")}</span>
                <span className="font-sans text-[11px] font-semibold text-fg-secondary">{t("common.value")}</span>
                <span className="font-sans text-[11px] font-semibold text-fg-secondary">{t("response.domain")}</span>
                <span className="font-sans text-[11px] font-semibold text-fg-secondary">{t("response.path")}</span>
                <span className="font-sans text-[11px] font-semibold text-fg-secondary">{t("response.secure")}</span>
                <span className="font-sans text-[11px] font-semibold text-fg-secondary">{t("response.httpOnly")}</span>
                <span className="font-sans text-[11px] font-semibold text-fg-secondary">{t("response.expires")}</span>
            </div>
            {cookies.map((cookie, i) => (
                <div
                    key={i}
                    className="grid grid-cols-[1fr_2fr_120px_80px_60px_60px_100px] h-[28px] px-3 items-center border-b border-border-muted transition-colors duration-50 hover:bg-bg-hover"
                >
                    <span className="font-mono text-[12px] text-fg-primary overflow-hidden text-ellipsis whitespace-nowrap">{cookie.name}</span>
                    <span className="font-mono text-[12px] text-fg-secondary overflow-hidden text-ellipsis whitespace-nowrap">{cookie.value}</span>
                    <span className="font-mono text-[11px] text-fg-tertiary overflow-hidden text-ellipsis whitespace-nowrap">{cookie.domain ?? "—"}</span>
                    <span className="font-mono text-[11px] text-fg-tertiary overflow-hidden text-ellipsis whitespace-nowrap">{cookie.path ?? "—"}</span>
                    <span className="font-mono text-[11px] text-fg-tertiary">{cookie.secure ? "✓" : "—"}</span>
                    <span className="font-mono text-[11px] text-fg-tertiary">{cookie.httpOnly ? "✓" : "—"}</span>
                    <span className="font-mono text-[11px] text-fg-tertiary overflow-hidden text-ellipsis whitespace-nowrap">{cookie.expires ?? t("response.session")}</span>
                </div>
            ))}
        </div>
    );
}