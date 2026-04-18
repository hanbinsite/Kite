import { useState, useRef, useCallback, useEffect } from "react";
import { KeyValueEditor, type KeyValue } from "../request/KeyValueEditor";
import { useRequestStore } from "../../stores";
import type { BodyConfig, AuthConfig, BodyMode, RawLanguage, Header, QueryParam } from "@api-client/types";

const REQUEST_TABS = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
  { id: "auth", label: "Auth" },
  { id: "scripts", label: "Scripts" },
  { id: "settings", label: "Settings" },
] as const;

type RequestTabId = (typeof REQUEST_TABS)[number]["id"];

const BODY_TYPES: { id: BodyMode; label: string }[] = [
  { id: "none", label: "none" },
  { id: "formdata", label: "form-data" },
  { id: "urlencoded", label: "x-www-form-urlencoded" },
  { id: "raw", label: "raw" },
  { id: "binary", label: "binary" },
  { id: "graphql", label: "GraphQL" },
];

const AUTH_TYPES = [
  { id: "none", label: "No Auth" },
  { id: "apikey", label: "API Key" },
  { id: "bearer", label: "Bearer Token" },
  { id: "basic", label: "Basic Auth" },
  { id: "jwt", label: "JWT" },
  { id: "oauth1", label: "OAuth 1.0" },
  { id: "oauth2", label: "OAuth 2.0" },
  { id: "awsv4", label: "AWS Signature v4" },
];

function kvToHeaders(kvs: KeyValue[]): Header[] {
  return kvs.map((kv) => ({
    key: kv.key,
    value: kv.value,
    disabled: !kv.enabled,
    description: kv.description,
  }));
}

function kvToParams(kvs: KeyValue[]): QueryParam[] {
  return kvs.map((kv) => ({
    key: kv.key,
    value: kv.value,
    disabled: !kv.enabled,
    description: kv.description,
  }));
}

function headersToKv(headers: Header[]): KeyValue[] {
  return headers.map((h) => ({
    id: crypto.randomUUID(),
    key: h.key,
    value: h.value,
    enabled: !h.disabled,
    description: h.description ?? "",
  }));
}

function paramsToKv(params: QueryParam[]): KeyValue[] {
  return params.map((p) => ({
    id: crypto.randomUUID(),
    key: p.key,
    value: p.value,
    enabled: !p.disabled,
    description: p.description ?? "",
  }));
}

function ensureEmptyRow(items: KeyValue[]): KeyValue[] {
  const last = items[items.length - 1];
  if (!last || last.key || last.value) {
    return [...items, { id: crypto.randomUUID(), key: "", value: "", enabled: true, description: "" }];
  }
  if (items.length === 0) {
    return [{ id: crypto.randomUUID(), key: "", value: "", enabled: true, description: "" }];
  }
  return items;
}

export function RequestPanel() {
  const [activeTab, setActiveTab] = useState<RequestTabId>("params");

  const storeHeaders = useRequestStore((s) => s.activeRequestData.headers);
  const storeParams = useRequestStore((s) => s.activeRequestData.params);
  const storeBody = useRequestStore((s) => s.activeRequestData.body);
  const storeSettings = useRequestStore((s) => s.activeRequestData.settings);
  const setRequestHeaders = useRequestStore((s) => s.setRequestHeaders);
  const setRequestParams = useRequestStore((s) => s.setRequestParams);
  const setRequestBody = useRequestStore((s) => s.setRequestBody);
  const setRequestSettings = useRequestStore((s) => s.setRequestSettings);

  const [params, setParams] = useState<KeyValue[]>(ensureEmptyRow(paramsToKv(storeParams)));
  const [headers, setHeaders] = useState<KeyValue[]>(ensureEmptyRow(headersToKv(storeHeaders)));
  const [bodyConfig, setBodyConfig] = useState<BodyConfig>(storeBody ?? { mode: "none" });
  const [authConfig, setAuthConfig] = useState<AuthConfig>({ type: "none", config: {} });
  const [rawLanguage] = useState<RawLanguage>("json");
  const [rawContent, setRawContent] = useState(
    storeBody?.raw?.content ?? ""
  );

  const handleParamsChange = (newItems: KeyValue[]) => {
    setParams(ensureEmptyRow(newItems));
    setRequestParams(kvToParams(newItems));
  };

  const handleHeadersChange = (newItems: KeyValue[]) => {
    setHeaders(ensureEmptyRow(newItems));
    setRequestHeaders(kvToHeaders(newItems));
  };

  const handleBodyConfigChange = (newConfig: BodyConfig) => {
    setBodyConfig(newConfig);
    setRequestBody(newConfig.mode === "none" ? null : newConfig);
  };

  const handleRawContentChange = (content: string) => {
    setRawContent(content);
    if (bodyConfig.mode === "raw") {
      const updated: BodyConfig = {
        mode: "raw",
        raw: { language: rawLanguage, content },
      };
      setRequestBody(updated);
    }
  };

  const tabRefs = useRef<Partial<Record<RequestTabId, HTMLButtonElement | null>>>({});
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

  const enabledParamsCount = params.filter((p) => p.enabled && p.key).length;
  const enabledHeadersCount = headers.filter((h) => h.enabled && h.key).length;

  const getBadge = (tabId: RequestTabId) => {
    if (tabId === "params" && enabledParamsCount > 0) return enabledParamsCount;
    if (tabId === "headers" && enabledHeadersCount > 0) return enabledHeadersCount;
    return null;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-surface">
      <div className="request-tabs flex items-center h-tab-bar bg-bg-surface border-b border-border-muted px-3 gap-0 relative">
        {REQUEST_TABS.map((tab) => {
          const badge = getBadge(tab.id);
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              onClick={() => setActiveTab(tab.id)}
              className={`request-tab h-tab-bar px-[14px] flex items-center gap-[6px] font-sans text-sm font-medium cursor-pointer whitespace-nowrap relative transition-colors duration-50 ${
                activeTab === tab.id ? "active text-fg-primary" : "text-fg-secondary hover:text-fg-primary"
              }`}
            >
              {tab.label}
              {badge !== null && (
                <span
                  className={`request-tab-badge font-sans text-2xs font-semibold min-w-[16px] h-[16px] px-[4px] flex items-center justify-center rounded-full ${
                    activeTab === tab.id
                      ? "text-brand bg-brand-muted"
                      : "text-fg-tertiary bg-bg-active"
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
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
        {activeTab === "params" && (
          <KeyValueEditor
            items={params}
            onChange={handleParamsChange}
            placeholder={{ key: "Parameter", value: "Value" }}
          />
        )}

        {activeTab === "headers" && (
          <KeyValueEditor
            items={headers}
            onChange={handleHeadersChange}
            placeholder={{ key: "Header", value: "Value" }}
          />
        )}

        {activeTab === "body" && (
          <div className="body-editor flex flex-col h-full">
            <div className="body-type-row flex items-center gap-[8px] h-[36px] px-3 border-b border-border-muted">
              {BODY_TYPES.map((bt) => (
                <div
                  key={bt.id}
                  onClick={() => {
                    const newConfig: BodyConfig = { mode: bt.id };
                    if (bt.id === "raw") {
                      newConfig.raw = { language: rawLanguage, content: rawContent };
                    }
                    handleBodyConfigChange(newConfig);
                  }}
                  className={`body-type-radio flex items-center gap-[6px] h-[24px] px-[10px] rounded-[4px] font-sans text-[12px] font-medium cursor-pointer transition-all duration-50 ${
                    bodyConfig.mode === bt.id
                      ? "active text-brand bg-brand-muted"
                      : "text-fg-secondary hover:bg-bg-hover hover:text-fg-primary"
                  }`}
                >
                  <div
                    className={`body-type-dot w-[10px] h-[10px] rounded-full border-[1.5px] transition-all duration-100 ${
                      bodyConfig.mode === bt.id
                        ? "border-brand bg-brand shadow-[inset_0_0_0_2px_var(--color-bg-surface)]"
                        : "border-border-default"
                    }`}
                  />
                  {bt.label}
                </div>
              ))}
              {bodyConfig.mode === "raw" && (
                <>
                  <div className="body-type-separator w-[1px] h-[16px] bg-border-muted" />
                  <div className="raw-type-selector flex items-center h-[24px] px-2 rounded-[4px] font-sans text-[11px] font-medium text-fg-secondary cursor-pointer gap-[4px] hover:bg-bg-hover">
                    {rawLanguage}
                  </div>
                </>
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              {bodyConfig.mode === "none" && (
                <div className="flex items-center justify-center h-full text-fg-tertiary text-[12px]">
                  This request does not have a body
                </div>
              )}

              {bodyConfig.mode === "raw" && (
                <div className="flex-1 overflow-auto p-3">
                  <textarea
                    value={rawContent}
                    onChange={(e) => handleRawContentChange(e.target.value)}
                    placeholder="Request body..."
                    className="w-full h-full min-h-[200px] p-2 bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary placeholder:text-fg-tertiary resize-none outline-none focus:border-border-focus"
                    spellCheck={false}
                  />
                </div>
              )}

              {(bodyConfig.mode === "urlencoded" || bodyConfig.mode === "formdata") && (
                <KeyValueEditor
                  items={[]}
                  onChange={() => {}}
                  placeholder={{ key: "Field", value: "Value" }}
                />
              )}

              {bodyConfig.mode === "binary" && (
                <div className="flex items-center justify-center h-full">
                  <div className="binary-upload-zone w-[280px] h-[160px] border-[1.5px] border-dashed border-border-default rounded-lg flex flex-col items-center justify-center gap-[8px] cursor-pointer transition-all duration-[180ms] hover:border-brand hover:bg-brand-muted">
                    <span className="text-fg-tertiary text-[12px]">Click to select a file</span>
                  </div>
                </div>
              )}

              {bodyConfig.mode === "graphql" && (
                <div className="graphql-editor grid grid-cols-2 h-full">
                  <div className="graphql-editor-query border-r border-border-muted p-2 overflow-auto">
                    <textarea
                      placeholder="Write your GraphQL query here..."
                      className="w-full h-full bg-transparent font-mono text-[12px] text-fg-primary placeholder:text-fg-tertiary resize-none outline-none"
                      spellCheck={false}
                    />
                  </div>
                  <div className="p-2 overflow-auto">
                    <textarea
                      placeholder="Query variables (JSON)..."
                      className="w-full h-full bg-transparent font-mono text-[12px] text-fg-primary placeholder:text-fg-tertiary resize-none outline-none"
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "auth" && (
          <div className="auth-editor flex flex-col h-full p-4 gap-3">
            <select
              value={authConfig.type}
              onChange={(e) => setAuthConfig({ type: e.target.value, config: {} } as AuthConfig)}
              className="auth-type-select w-[220px] h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-sans text-[13px] text-fg-primary cursor-pointer outline-none focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)]"
            >
              {AUTH_TYPES.map((at) => (
                <option key={at.id} value={at.id}>{at.label}</option>
              ))}
            </select>

            {authConfig.type === "none" && (
              <div className="auth-hint font-sans text-[11px] text-fg-tertiary leading-[16px] p-2 bg-bg-elevated rounded-md border-l-[2px] border-accent-info">
                This request will not use any authentication.
              </div>
            )}

            {authConfig.type === "bearer" && (
              <div className="auth-field flex flex-col gap-[6px]">
                <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">Token</label>
                <input
                  type="text"
                  placeholder="Bearer token"
                  className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)] placeholder:text-fg-tertiary placeholder:font-sans"
                />
              </div>
            )}

            {authConfig.type === "basic" && (
              <>
                <div className="auth-field flex flex-col gap-[6px]">
                  <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">Username</label>
                  <input
                    type="text"
                    placeholder="Username"
                    className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans"
                  />
                </div>
                <div className="auth-field flex flex-col gap-[6px]">
                  <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">Password</label>
                  <input
                    type="password"
                    placeholder="Password"
                    className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
                  />
                </div>
              </>
            )}

            {authConfig.type === "apikey" && (
              <>
                <div className="auth-field flex flex-col gap-[6px]">
                  <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">Key</label>
                  <input
                    type="text"
                    placeholder="Header name"
                    className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans"
                  />
                </div>
                <div className="auth-field flex flex-col gap-[6px]">
                  <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">Value</label>
                  <input
                    type="text"
                    placeholder="API key value"
                    className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
                  />
                </div>
                <div className="auth-field flex flex-col gap-[6px]">
                  <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">Add to</label>
                  <select className="auth-type-select w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-sans text-[13px] text-fg-primary cursor-pointer outline-none focus:border-border-focus">
                    <option value="header">Header</option>
                    <option value="query">Query Params</option>
                  </select>
                </div>
              </>
            )}

            {(authConfig.type === "jwt" || authConfig.type === "oauth1" || authConfig.type === "oauth2" || authConfig.type === "awsv4") && (
              <div className="auth-hint font-sans text-[11px] text-fg-tertiary leading-[16px] p-2 bg-bg-elevated rounded-md border-l-[2px] border-accent-info">
                {authConfig.type === "jwt" ? "JWT authentication configuration" :
                 authConfig.type === "oauth1" ? "OAuth 1.0a configuration" :
                 authConfig.type === "oauth2" ? "OAuth 2.0 configuration" :
                 "AWS Signature v4 configuration"}
                — fields will be implemented in Phase 3.
              </div>
            )}
          </div>
        )}

        {activeTab === "scripts" && (
          <div className="scripts-editor flex flex-col h-full">
            <div className="scripts-tabs flex h-[36px] border-b border-border-muted px-3 gap-0 relative">
              <button className="scripts-tab h-[36px] px-[14px] flex items-center font-sans text-[12px] font-medium text-fg-primary cursor-pointer active">
                Pre-request
              </button>
              <button className="scripts-tab h-[36px] px-[14px] flex items-center font-sans text-[12px] font-medium text-fg-secondary cursor-pointer hover:text-fg-primary">
                Post-response
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <textarea
                placeholder="// Write your pre-request script here..."
                className="w-full h-full min-h-[200px] bg-transparent font-mono text-[12px] text-fg-primary placeholder:text-fg-tertiary resize-none outline-none"
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="flex flex-col h-full p-4 gap-3">
            <div className="flex items-center gap-3">
              <label className="font-sans text-[11px] font-semibold text-fg-secondary w-[120px]">Timeout (ms)</label>
              <input
                type="number"
                value={storeSettings.timeoutMs}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val > 0) {
                    setRequestSettings({ ...storeSettings, timeoutMs: val });
                  }
                }}
                className="auth-field-input w-[120px] h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="font-sans text-[11px] font-semibold text-fg-secondary w-[120px]">Follow redirects</label>
              <input
                type="checkbox"
                checked={storeSettings.followRedirects}
                onChange={(e) => setRequestSettings({ ...storeSettings, followRedirects: e.target.checked })}
                className="w-4 h-4 accent-brand cursor-pointer rounded"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="font-sans text-[11px] font-semibold text-fg-secondary w-[120px]">Verify SSL</label>
              <input
                type="checkbox"
                checked={storeSettings.verifySsl}
                onChange={(e) => setRequestSettings({ ...storeSettings, verifySsl: e.target.checked })}
                className="w-4 h-4 accent-brand cursor-pointer rounded"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}