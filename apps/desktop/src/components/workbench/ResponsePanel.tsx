import { useState, useRef, useCallback, useEffect } from "react";
import { useTabStore } from "@api-client/core";
import { useRequestStore } from "../../stores";
import type { HttpResponse, ResponseHeader } from "@api-client/types";
import { Clock, HardDrive, ArrowDownToLine, Maximize2, Columns2, Zap, AlertTriangle, RefreshCw } from "lucide-react";

const RESPONSE_TABS = [
  { id: "body", label: "Body" },
  { id: "headers", label: "Headers" },
  { id: "cookies", label: "Cookies" },
  { id: "tests", label: "Tests" },
] as const;

type ResponseTabId = (typeof RESPONSE_TABS)[number]["id"];

type BodyViewMode = "pretty" | "raw" | "preview";

function getStatusClass(status: number): string {
  if (status >= 200 && status < 300) return "s2xx text-accent-success bg-accent-success/12";
  if (status >= 300 && status < 400) return "s3xx text-accent-info bg-accent-info/12";
  if (status >= 400 && status < 500) return "s4xx text-accent-warning bg-accent-warning/12";
  return "s5xx text-accent-danger bg-accent-danger/12";
}

function formatBodySize(bytes: number): string {
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function highlightJson(json: string): string {
  try {
    const parsed = JSON.parse(json);
    const formatted = JSON.stringify(parsed, null, 2);
    return syntaxHighlight(formatted);
  } catch {
    return `<span class="json-string">${escapeHtml(json)}</span>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function syntaxHighlight(json: string): string {
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "json-key";
        } else {
          cls = "json-string";
        }
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return `<span class="${cls}">${escapeHtml(match)}</span>`;
    },
  );
}

export function ResponsePanel() {
  const [activeTab, setActiveTab] = useState<ResponseTabId>("body");
  const [bodyView, setBodyView] = useState<BodyViewMode>("pretty");

  const activeTabId = useTabStore((s) => s.activeTabId);
  const response = useRequestStore((s) => (activeTabId ? s.responses[activeTabId] : undefined)) as HttpResponse | undefined;
  const isLoading = useRequestStore((s) => s.isLoading);
  const error = useRequestStore((s) => s.error);

  const tabRefs = useRef<Partial<Record<ResponseTabId, HTMLButtonElement | null>>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
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
    updateIndicator();
  }, [activeTab, updateIndicator]);

  useEffect(() => {
    const observer = new ResizeObserver(updateIndicator);
    const parent = tabRefs.current[activeTab]?.parentElement;
    if (parent) observer.observe(parent);
    return () => observer.disconnect();
  }, [activeTab, updateIndicator]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-bg-surface">
        <div className="response-loading flex flex-col items-center justify-center h-full gap-4">
          <div className="response-loading-spinner w-6 h-6 border-2 border-border-default border-t-brand rounded-full animate-spin" />
          <span className="response-loading-timer font-mono text-[11px] text-brand">Sending...</span>
        </div>
      </div>
    );
  }

  if (!response && !error) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-bg-surface">
        <div className="response-empty flex flex-col items-center justify-center h-full gap-3 text-center">
          <Zap className="response-empty-icon w-[48px] h-[48px] text-fg-tertiary opacity-30" />
          <span className="response-empty-text font-sans text-[13px] text-fg-tertiary">
            Hit Send to get a response
          </span>
          <span className="response-empty-shortcut font-mono text-[11px] text-fg-tertiary py-[2px] px-2 bg-bg-active rounded-[4px]">
            ⌘ Enter
          </span>
        </div>
      </div>
    );
  }

  if (error && !response) {
    const isSslError = error.toLowerCase().includes("ssl") || error.toLowerCase().includes("tls") || error.toLowerCase().includes("certificate");
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-bg-surface">
        <div className="response-error flex flex-col items-center justify-center h-full gap-4 text-center px-8">
          <AlertTriangle className="w-10 h-10 text-accent-danger" />
          <div className="flex flex-col gap-1">
            <span className="font-sans text-sm font-semibold text-accent-danger">Request Failed</span>
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
              Retry
            </button>
          </div>
          {isSslError && (
            <label className="flex items-center gap-2 text-xs text-fg-tertiary mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!useRequestStore.getState().activeRequestData.settings.verifySsl}
                onChange={(e) => {
                  useRequestStore.getState().setRequestSettings({
                    ...useRequestStore.getState().activeRequestData.settings,
                    verifySsl: !e.target.checked,
                  });
                }}
                className="accent-brand"
              />
              Skip SSL verification
            </label>
          )}
        </div>
      </div>
    );
  }

  if (!response) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-surface">
      <div className="response-bar flex items-center h-[32px] px-3 gap-2 bg-bg-surface border-t border-border-muted border-b border-border-muted">
        <span className={`response-status-pill flex items-center gap-[4px] h-[20px] px-2 rounded-full font-mono text-[11px] font-semibold ${getStatusClass(response.status)}`}>
          {response.status} {response.status_text}
        </span>
        <span className="response-meta font-sans text-[11px] text-fg-tertiary flex items-center gap-1">
          <Clock size={12} />
          {response.time} ms
        </span>
        <span className="response-meta font-sans text-[11px] text-fg-tertiary flex items-center gap-1">
          <HardDrive size={12} />
          {formatBodySize(response.body_size)}
        </span>
        <div className="flex-1" />
        <div className="response-bar-tools flex gap-[2px]">
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

      <div className="response-tabs flex items-center h-[36px] bg-bg-surface border-b border-border-muted px-3 gap-0 relative">
        {RESPONSE_TABS.map((tab) => (
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
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto">
              {bodyView === "pretty" && (
                <div className="json-viewer p-2 px-3 font-mono text-[12px] leading-[20px] overflow-auto h-full">
                  <pre dangerouslySetInnerHTML={{ __html: highlightJson(response.body) }} />
                </div>
              )}

              {bodyView === "raw" && (
                <div className="p-2 px-3 overflow-auto h-full">
                  <pre className="font-mono text-[12px] text-fg-primary whitespace-pre-wrap">
                    {response.body}
                  </pre>
                </div>
              )}

              {bodyView === "preview" && (
                <div className="p-2 px-3 overflow-auto h-full">
                  <iframe
                    srcDoc={response.body}
                    className="w-full h-full min-h-[200px] bg-white"
                    sandbox="allow-same-origin"
                    title="Response Preview"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "headers" && (
          <div className="flex flex-col h-full overflow-auto">
            {response.headers.map((header: ResponseHeader, i: number) => (
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
            {response.headers.length === 0 && (
              <div className="flex items-center justify-center h-full text-fg-tertiary text-[12px]">
                No headers in this response
              </div>
            )}
          </div>
        )}

        {activeTab === "cookies" && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-fg-tertiary">
            <span className="text-[12px]">No cookies</span>
          </div>
        )}

        {activeTab === "tests" && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-fg-tertiary">
            <span className="text-[12px]">No test results</span>
          </div>
        )}
      </div>
    </div>
  );
}