import { useRequestStore } from "../../stores/request-store";
import { useTabStore } from "@api-client/core";
import { Clock, HardDrive, ArrowDownToLine, Maximize2 } from "lucide-react";

function getStatusClass(status: number): string {
  if (status >= 200 && status < 300) {
    return "text-accent-success bg-accent-success/12";
  }
  if (status >= 300 && status < 400) {
    return "text-accent-info bg-accent-info/12";
  }
  if (status >= 400 && status < 500) {
    return "text-accent-warning bg-accent-warning/12";
  }
  return "text-accent-danger bg-accent-danger/12";
}

export function ResponseStatus() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const isLoading = useRequestStore((s) => s.isLoading);
  const response = useRequestStore(
    (s) => (activeTabId ? s.responses[activeTabId] : undefined)
  );
  const error = useRequestStore((s) => s.error);

  if (!response && !isLoading && !error) return null;

  return (
    <div className="h-response-bar flex items-center gap-2 px-3 bg-bg-surface border-y border-border-muted">
      {isLoading && (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-border-default border-t-brand rounded-full animate-spin" />
          <span className="text-xs text-fg-tertiary font-mono">Sending...</span>
        </div>
      )}
      {response && !isLoading && (
        <>
          <span
            className={`response-status-pill h-5 px-2 rounded-full text-xs font-mono font-semibold inline-flex items-center ${getStatusClass(response.status)}`}
          >
            {response.status} {response.status_text}
          </span>
          <span className="response-meta text-xs text-fg-tertiary flex items-center gap-1">
            <Clock size={12} />
            {response.time} ms
          </span>
          <span className="response-meta text-xs text-fg-tertiary flex items-center gap-1">
            <HardDrive size={12} />
            {response.body_size > 1024
              ? `${(response.body_size / 1024).toFixed(1)} KB`
              : `${response.body_size} B`}
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <button
              className="response-bar-btn w-6 h-6 rounded flex items-center justify-center text-fg-tertiary hover:text-fg-secondary hover:bg-bg-hover"
              title="Download"
            >
              <ArrowDownToLine size={14} />
            </button>
            <button
              className="response-bar-btn w-6 h-6 rounded flex items-center justify-center text-fg-tertiary hover:text-fg-secondary hover:bg-bg-hover"
              title="Fullscreen"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </>
      )}
      {error && !isLoading && (
        <span className="text-xs text-accent-danger font-mono">{error}</span>
      )}
    </div>
  );
}