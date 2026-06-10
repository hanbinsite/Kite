import { useRef, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Menu, ChevronLeft, ChevronRight, Save, Check } from "lucide-react";
import { useUIStore, useTabStore } from "@api-client/core";
import { useEnvironmentStore } from "../../stores/environment-store";
import { useCollectionStore } from "../../stores/collection-store";
import { useRequestStore } from "../../stores";
import { saveCurrentRequest } from "../../hooks/useAutoSave";
import { MethodSelector } from "./MethodSelector";
import { SendButton, type SendButtonState } from "./SendButton";
import { VariableAutocomplete, VariableHighlightOverlay } from "./VariableHighlight";
import type { HttpMethod } from "@api-client/types";
import { VariableResolver, variablesToRecord } from "@api-client/core";

function resolveUrlForValidation(rawUrl: string): string {
  try {
    const envStore = useEnvironmentStore.getState();
    const colStore = useCollectionStore.getState();
    const tabStore = useTabStore.getState();

    const activeTab = tabStore.tabs.find((t) => t.id === tabStore.activeTabId);
    const requestId = activeTab?.requestId;
    const hierarchy = requestId ? colStore.resolveRequestHierarchy(requestId) : null;

    const collectionVars: Record<string, string> = {};
    if (hierarchy?.collectionConfig?.variables) {
      for (const v of hierarchy.collectionConfig.variables) {
        if (v.enabled && v.key) collectionVars[v.key] = v.value;
      }
    }
    const folderVars: Record<string, string> = {};
    if (hierarchy) {
      for (const folder of hierarchy.folderPath) {
        if (folder.config?.variables) {
          for (const v of folder.config.variables) {
            if (v.enabled && v.key) folderVars[v.key] = v.value;
          }
        }
      }
    }

    const scopes = {
      global: variablesToRecord(envStore.globals),
      environment: envStore.activeEnvironmentId
        ? variablesToRecord(envStore.environments.find((e) => e.id === envStore.activeEnvironmentId)?.variables ?? [])
        : undefined,
      collection: Object.keys(collectionVars).length > 0 ? collectionVars : undefined,
      folder: Object.keys(folderVars).length > 0 ? folderVars : undefined,
    };

    return new VariableResolver(scopes).resolve(rawUrl);
  } catch {
    return rawUrl;
  }
}

export function UrlBar() {
  const { t } = useTranslation();
  const [sendState, setSendState] = useState<SendButtonState>("idle");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateTab = useTabStore((s) => s.updateTab);
  const isLoading = useRequestStore((s) => activeTabId ? !!s.loadingTabs[activeTabId] : false);
  const sendRequest = useRequestStore((s) => s.sendRequest);
  const cancelRequest = useRequestStore((s) => s.cancelRequest);
  const markDirty = useRequestStore((s) => s.markDirty);

  const method = (activeTab?.method ?? "GET") as HttpMethod;
  const url = activeTab?.url ?? "";

  const setMethod = useCallback(
    (m: HttpMethod) => {
      if (activeTabId) {
        updateTab(activeTabId, { method: m });
        markDirty(activeTabId);
      }
    },
    [activeTabId, updateTab, markDirty],
  );

const setUrl = useCallback(
    (u: string) => {
      if (activeTabId) {
        updateTab(activeTabId, { url: u });
        markDirty(activeTabId);
      }
    },
    [activeTabId, updateTab, markDirty],
  );

  useEffect(() => {
    setUrlError(null);
    setSendState("idle");
  }, [activeTabId]);

  const handleSend = async () => {
    if (!url.trim() || !activeTabId) return;

    if (isLoading) {
      setSendState("idle");
      await cancelRequest(activeTabId);
      return;
    }

    const resolvedUrl = resolveUrlForValidation(url);
    if (!/^https?:\/\//i.test(resolvedUrl)) {
      setUrlError(t("request.invalidUrl"));
      return;
    }
    setUrlError(null);

    setSendState("loading");

    try {
      await sendRequest(activeTabId, method, url);
      setSendState("success");
    } catch {
      setSendState("error");
    } finally {
      setTimeout(() => setSendState("idle"), 1200);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setUrl(val);
      setCursorPosition(e.target.selectionStart ?? val.length);
      const before = val.slice(0, e.target.selectionStart ?? val.length);
      const openIdx = before.lastIndexOf("{{");
      const closeIdx = before.lastIndexOf("}}");
      setShowAutocomplete(openIdx !== -1 && openIdx > closeIdx);
    },
    [setUrl],
  );

  const handleSelect = useCallback(
    (variableName: string) => {
      const before = url.slice(0, cursorPosition);
      const after = url.slice(cursorPosition);
      const openIdx = before.lastIndexOf("{{");
      if (openIdx === -1) return;
      const newUrl = url.slice(0, openIdx) + `{{${variableName}}}` + after;
      setUrl(newUrl);
      setShowAutocomplete(false);
      const newCursor = openIdx + variableName.length + 4;
      requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(newCursor, newCursor);
        inputRef.current?.focus();
      });
    },
    [url, cursorPosition, setUrl],
  );

  const handleInputSelect = useCallback((e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    setCursorPosition(target.selectionStart ?? 0);
  }, []);

const handleSave = useCallback(() => {
    const saved = saveCurrentRequest();
    if (saved) {
      setSaveState("saved");
      const tabId = activeTabId;
      if (tabId) useRequestStore.getState().clearDirty(tabId);
      setTimeout(() => setSaveState("idle"), 1500);
    } else {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  }, [activeTabId]);

  return (
    <div className="border-b border-border-muted bg-bg-surface overflow-visible" style={{ position: "relative", zIndex: 100 }}>
      <div className="h-url-bar flex items-center gap-2 px-2 relative">
        <button
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          title={`${t("sidebar.toggleSidebar")} (Cmd+B)`}
        >
          <Menu className="w-4 h-4 text-fg-secondary" />
        </button>

        <button
          className="p-1.5 hover:bg-bg-hover rounded transition-colors disabled:opacity-50"
          disabled
        >
          <ChevronLeft className="w-4 h-4 text-fg-secondary" />
        </button>
        <button
          className="p-1.5 hover:bg-bg-hover rounded transition-colors disabled:opacity-50"
          disabled
        >
          <ChevronRight className="w-4 h-4 text-fg-secondary" />
        </button>

        <MethodSelector method={method} onChange={setMethod} />

        <div className="flex-1 relative">
          {url.includes("{{") && (
            <div
              className="absolute inset-0 flex items-center h-8 px-3 font-mono text-sm pointer-events-none overflow-hidden whitespace-nowrap"
              aria-hidden="true"
            >
              <VariableHighlightOverlay text={url} />
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => {
              handleUrlChange(e);
              setUrlError(null);
            }}
            onKeyDown={handleKeyDown}
            onSelect={handleInputSelect}
            onBlur={() => setShowAutocomplete(false)}
            placeholder={t("request.enterUrl")}
            className={`w-full h-8 px-3 bg-bg-input border rounded-md text-sm font-mono caret-fg-primary placeholder:text-fg-tertiary focus:outline-none transition-colors ${url.includes("{{") ? "text-transparent" : "text-fg-primary"} ${urlError ? "border-accent-danger focus:border-accent-danger focus:ring-1 focus:ring-accent-danger" : "border-border-default focus:border-border-focus focus:ring-1 focus:ring-brand"}`}
          />
          {urlError && <div className="absolute -bottom-5 left-0 text-2xs text-accent-danger font-mono whitespace-nowrap">{urlError}</div>}
          {showAutocomplete && (
            <VariableAutocomplete
              url={url}
              cursorPosition={cursorPosition}
              onSelect={handleSelect}
              onClose={() => setShowAutocomplete(false)}
            />
          )}
        </div>

        <button
          onClick={handleSave}
          title={`${t("common.save")} (Ctrl+S)`}
          className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            saveState === "saved" ? "text-accent-success" : saveState === "error" ? "text-accent-danger" : "text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover"
          }`}
          disabled={!activeTab?.requestId || saveState === "saved"}
        >
          {saveState === "saved" ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
        </button>

        <SendButton state={sendState} disabled={!url.trim()} onClick={handleSend} />
      </div>
    </div>
  );
}
