import { useConsoleStore } from "../../stores";
import { useTabStore } from "@api-client/core";
import { Trash2, AlertCircle, AlertTriangle, Info, Terminal } from "lucide-react";

const LEVEL_STYLES = {
  log: { icon: Terminal, color: "text-fg-secondary", bgColor: "" },
  info: { icon: Info, color: "text-accent-info", bgColor: "bg-accent-info/5" },
  warn: { icon: AlertTriangle, color: "text-accent-warning", bgColor: "bg-accent-warning/5" },
  error: { icon: AlertCircle, color: "text-accent-danger", bgColor: "bg-accent-danger/5" },
} as const;

type LogLevel = keyof typeof LEVEL_STYLES;

export function ConsolePanel() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const entries = useConsoleStore((s) => activeTabId ? (s.entries[activeTabId] ?? []) : []);
  const clearEntries = useConsoleStore((s) => s.clearEntries);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-fg-tertiary text-[12px] font-sans">
        No console output
      </div>
    );
  }

  return (
    <div className="console-panel flex flex-col h-full overflow-hidden font-mono text-[12px]">
      <div className="console-header flex items-center justify-between h-[28px] px-3 border-b border-border-muted">
        <span className="font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em]">
          Console ({entries.length})
        </span>
        <button
          onClick={() => activeTabId && clearEntries(activeTabId)}
          className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-secondary cursor-pointer transition-colors"
          title="Clear console"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="console-body flex-1 overflow-y-auto">
        {entries.map((entry) => {
          const style = LEVEL_STYLES[entry.level as LogLevel] ?? LEVEL_STYLES.log;
          const Icon = style.icon;
          return (
            <div
              key={entry.id}
              className={`console-entry flex items-start gap-2 px-3 py-1 border-b border-border-muted ${style.bgColor}`}
            >
              <Icon size={13} className={`shrink-0 mt-0.5 ${style.color}`} />
              <span className={`flex-1 break-all leading-snug ${style.color}`}>
                {entry.message}
              </span>
              <span className="shrink-0 text-fg-tertiary text-[10px] tabular-nums">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
