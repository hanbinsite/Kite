import { useState } from "react";
import { Menu, ChevronLeft, ChevronRight } from "lucide-react";
import { useUIStore, useTabStore } from "@api-client/core";
import { useRequestStore, useEnvironmentStore } from "../../stores";
import { MethodSelector } from "./MethodSelector";
import { SendButton, type SendButtonState } from "./SendButton";
import { invoke } from "@tauri-apps/api/core";
import type { HttpRequestConfig, HttpResponse, HttpMethod } from "@api-client/types";

export function UrlBar() {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("");
  const [sendState, setSendState] = useState<SendButtonState>("idle");
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const setResponse = useRequestStore((s) => s.setResponse);
  const setLoading = useRequestStore((s) => s.setLoading);
  const isLoading = useRequestStore((s) => s.isLoading);
  const getVariable = useEnvironmentStore((s) => s.getVariable);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleSend = async () => {
    if (!url.trim()) return;

    if (isLoading) {
      setSendState("idle");
      setLoading(false);
      return;
    }

    let processedUrl = url;
    const variablePattern = /\{\{(\w+)\}\}/g;
    processedUrl = processedUrl.replace(variablePattern, (_, key) => {
      const value = getVariable(key);
      return value !== undefined ? value : `{{${key}}}`;
    });

    setSendState("loading");
    setLoading(true);

    try {
      const config: HttpRequestConfig = {
        id: activeTabId || crypto.randomUUID(),
        name: activeTab?.name || "New Request",
        method,
        url: processedUrl,
        headers: [],
        params: [],
        settings: {
          timeoutMs: 30000,
          followRedirects: true,
          verifySsl: true,
        },
      };

      const response = await invoke<HttpResponse>("send_http_request", { config });
      setResponse(activeTabId!, response);
      setSendState("success");
      setTimeout(() => setSendState("idle"), 1000);
    } catch (error) {
      console.error("Request failed:", error);
      setSendState("error");
      setTimeout(() => setSendState("idle"), 1000);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  return (
    <div className="h-11 flex items-center gap-2 px-2 border-b border-border-muted bg-bg-surface">
      <button
        onClick={toggleSidebar}
        className="p-1.5 hover:bg-bg-hover rounded transition-colors"
        title="Toggle Sidebar (Cmd+B)"
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

      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter request URL"
        className="flex-1 h-8 px-3 bg-bg-input border border-border-default rounded-md text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-brand transition-colors"
      />

      <SendButton state={sendState} disabled={!url.trim()} onClick={handleSend} />
    </div>
  );
}
