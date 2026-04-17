import { useTabStore } from "@api-client/core";
import { useRequestStore } from "../../stores";
import { Clock, HardDrive } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  "2xx": "bg-status-2xx text-white",
  "3xx": "bg-status-3xx text-white",
  "4xx": "bg-status-4xx text-white",
  "5xx": "bg-status-5xx text-white",
};

export function ResponsePanel() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const response = useRequestStore((s) => (activeTabId ? s.responses[activeTabId] : undefined));
  const isLoading = useRequestStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-fg-secondary">Sending request...</span>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-surface">
        <div className="flex flex-col items-center gap-3 text-fg-tertiary">
          <svg
            className="w-12 h-12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span className="text-sm">Hit Send to get a response</span>
          <span className="text-xs">Cmd + Enter</span>
        </div>
      </div>
    );
  }

  const statusCategory = Math.floor(response.status / 100) + "xx";

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-surface">
      <div className="h-8 flex items-center gap-4 px-4 border-b border-border-muted bg-bg-elevated">
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold ${STATUS_COLORS[statusCategory] || "bg-fg-tertiary text-white"}`}
        >
          {response.status} {response.statusText}
        </span>
        <span className="flex items-center gap-1 text-xs text-fg-secondary">
          <Clock className="w-3 h-3" />
          {response.time} ms
        </span>
        <span className="flex items-center gap-1 text-xs text-fg-secondary">
          <HardDrive className="w-3 h-3" />
          {new Blob([response.body]).size} B
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <pre className="text-sm font-mono text-fg-primary whitespace-pre-wrap">
          {formatJson(response.body)}
        </pre>
      </div>
    </div>
  );
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
