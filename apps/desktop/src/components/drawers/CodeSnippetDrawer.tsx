import { useState, useEffect, useCallback } from "react";
import { X, Copy, Check } from "lucide-react";
import { generateCode, CODE_LANGUAGES, type CodeLanguage, type CodeGenRequest } from "@api-client/core/codegen";
import { useRequestStore } from "../../stores";
import { useTabStore } from "@api-client/core";
import { InlineEditor } from "../editor/InlineEditor";

interface CodeSnippetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRIMARY_LANGUAGES = CODE_LANGUAGES.slice(0, 6);
const MORE_LANGUAGES = CODE_LANGUAGES.slice(6);

function buildCodeGenRequest(tabId: string): CodeGenRequest | null {
  const state = useRequestStore.getState();
  const tabState = useTabStore.getState();
  const tab = tabState.tabs.find((t) => t.id === tabId);
  if (!tab) return null;

  const data = state.requestDataMap[tabId] ?? {
    headers: [],
    params: [],
    body: null,
    auth: { type: "none", config: {} },
    settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, verifySsl: true },
  };

  return {
    id: tabId,
    method: (tab.method ?? "GET") as string,
    url: tab.url ?? "",
    headers: data.headers.filter((h) => !h.disabled && h.key).map((h) => ({ key: h.key, value: h.value, disabled: false })),
    params: data.params.filter((p) => !p.disabled && p.key).map((p) => ({ key: p.key, value: p.value, disabled: false })),
    body: data.body?.mode === "raw" && data.body.raw
      ? { mode: "raw", content: data.body.raw.content, content_type: `application/${data.body.raw.language}` }
      : data.body?.mode === "urlencoded"
        ? { mode: "urlencoded", content_type: "application/x-www-form-urlencoded" }
        : null,
    auth: data.auth.type !== "none" ? { type: data.auth.type, config: { ...data.auth.config } as Record<string, unknown> } : null,
    settings: { timeout_ms: data.settings.timeoutMs, follow_redirects: data.settings.followRedirects, max_redirects: data.settings.maxRedirects, verify_ssl: data.settings.verifySsl },
  };
}

import type { RawLanguage } from "@api-client/types";

const LANGUAGE_TO_HIGHLIGHT: Record<string, RawLanguage> = {
  javascript: "javascript",
  json: "json",
  xml: "xml",
  html: "html",
  yaml: "yaml",
};

export function CodeSnippetDrawer({ isOpen, onClose }: CodeSnippetDrawerProps) {
  const [language, setLanguage] = useState<CodeLanguage>("curl");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const activeTabId = useTabStore((s) => s.activeTabId);

  const fetchCode = useCallback(async () => {
    if (!activeTabId) return;
    const config = buildCodeGenRequest(activeTabId);
    if (!config) return;
    setLoading(true);
    try {
      const result = await generateCode(config, language);
      setCode(result.code);
    } catch (e) {
      setCode(`// Error generating code: ${e}`);
    }
    setLoading(false);
  }, [activeTabId, language]);

  useEffect(() => {
    if (isOpen) fetchCode();
  }, [isOpen, fetchCode]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  }, [code]);

  if (!isOpen) return null;

  const langLabel = CODE_LANGUAGES.find((l) => l.value === language)?.label ?? "cURL";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="code-snippet-drawer fixed right-0 top-0 bottom-0 w-[460px] z-50 bg-bg-surface border-l border-border-muted flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between h-[44px] px-4 border-b border-border-muted shrink-0">
          <span className="font-sans text-[13px] font-semibold text-fg-primary">
            Generate Code
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="language-tabs flex items-center gap-0 h-[36px] px-3 border-b border-border-muted overflow-x-auto shrink-0">
          {PRIMARY_LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              onClick={() => setLanguage(lang.value)}
              className={`shrink-0 h-[36px] px-3 font-sans text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                language === lang.value
                  ? "text-brand active"
                  : "text-fg-secondary hover:text-fg-primary"
              }`}
            >
              {lang.label}
            </button>
          ))}
          <div className="relative">
            <button
              onClick={() => setShowMore(!showMore)}
              className="shrink-0 h-[36px] px-3 font-sans text-[12px] font-medium text-fg-tertiary hover:text-fg-secondary cursor-pointer flex items-center gap-1"
            >
              More
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showMore && (
              <div className="absolute right-0 top-full mt-1 bg-bg-elevated border border-border-muted rounded-md shadow-xl z-50 py-1 min-w-[160px]">
                {MORE_LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => {
                      setLanguage(lang.value);
                      setShowMore(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 font-sans text-[12px] cursor-pointer hover:bg-bg-hover transition-colors ${
                      language === lang.value ? "text-brand font-medium" : "text-fg-secondary"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full text-fg-tertiary text-[12px] font-sans">
              Generating {langLabel} code...
            </div>
          ) : (
            <InlineEditor
              value={code}
              language={LANGUAGE_TO_HIGHLIGHT[language] ?? "text"}
              onChange={() => {}}
              readOnly
              placeholder="// No code generated"
            />
          )}
        </div>

        <div className="flex items-center justify-between h-[44px] px-4 border-t border-border-muted shrink-0">
          <span className="font-sans text-[11px] text-fg-tertiary">{langLabel}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 h-[28px] px-3 rounded-md font-sans text-[12px] font-medium bg-brand text-white hover:bg-brand-hover cursor-pointer transition-colors"
          >
            {copied ? (
              <>
                <Check size={14} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
