import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useConsoleStore } from "../../stores";
import { Trash2, AlertCircle, AlertTriangle, Info, Terminal, Search, X } from "lucide-react";

const LEVEL_STYLES = {
  log: { icon: Terminal, color: "text-fg-secondary", bgColor: "" },
  info: { icon: Info, color: "text-accent-info", bgColor: "bg-accent-info/5" },
  warn: { icon: AlertTriangle, color: "text-accent-warning", bgColor: "bg-accent-warning/5" },
  error: { icon: AlertCircle, color: "text-accent-danger", bgColor: "bg-accent-danger/5" },
} as const;

type LogLevel = keyof typeof LEVEL_STYLES;

type FilterMode = "all" | "request" | "response" | "script" | "error";

const FILTER_OPTIONS: FilterMode[] = ["all", "request", "response", "script", "error"];

const MAX_ENTRIES = 5000;
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 400;
const DEFAULT_HEIGHT = 200;

function sourceToFilter(source?: string): FilterMode {
  if (source === "system") {
    return "request";
  }
  if (source === "pre-request" || source === "post-response") {
    return "script";
  }
  return "all";
}

export function GlobalConsole() {
  const { t } = useTranslation();
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const allEntries = useConsoleStore((s) => s.entries);
  const clearEntries = useConsoleStore((s) => s.clearEntries);

  const entries = useMemo(() => {
    const all: typeof allEntries[string] = [];
    for (const tabEntries of Object.values(allEntries)) {
      all.push(...tabEntries);
    }
    all.sort((a, b) => a.timestamp - b.timestamp);
    return all.slice(-MAX_ENTRIES);
  }, [allEntries]);

  const filtered = useMemo(() => {
    let result = entries;
    if (filter === "error") {
      result = result.filter((e) => e.level === "error");
    } else if (filter === "request") {
      result = result.filter((e) => e.source === "system" || sourceToFilter(e.source) === "request");
    } else if (filter === "response") {
      result = result.filter((e) => e.source === "post-response");
    } else if (filter === "script") {
      result = result.filter((e) => e.source === "pre-request" || e.source === "post-response");
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (e) => e.message.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [entries, filter, searchTerm]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
  }, [height]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startYRef.current - e.clientY;
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + delta));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const clearAll = useCallback(() => {
    for (const tabId of Object.keys(allEntries)) {
      clearEntries(tabId);
    }
  }, [allEntries, clearEntries]);

  return (
    <div
      ref={containerRef}
      className="global-console flex flex-col border-t border-border-muted bg-bg-surface select-none"
      style={{ height }}
    >
      <div
        className="global-console-resize-handle h-[4px] cursor-ns-resize flex items-center justify-center hover:bg-brand/20 transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="w-[32px] h-[3px] rounded-full bg-border-default" />
      </div>

      <div className="global-console-toolbar flex items-center gap-2 h-[28px] px-3 border-b border-border-muted shrink-0">
        <div className="flex items-center gap-0">
          {FILTER_OPTIONS.map((id) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`h-[22px] px-2 rounded-[3px] font-sans text-[10px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                filter === id
                  ? "text-brand bg-brand-muted"
                  : "text-fg-tertiary hover:text-fg-secondary hover:bg-bg-hover"
              }`}
            >
              {t(`console.filter.${id}`)}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="relative flex items-center">
          <Search size={11} className="absolute left-2 text-fg-tertiary pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("console.filterPlaceholder")}
            className="h-[20px] w-[120px] pl-[22px] pr-2 bg-bg-input border border-border-muted rounded-[3px] font-sans text-[10px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-1 text-fg-tertiary hover:text-fg-secondary cursor-pointer"
            >
              <X size={10} />
            </button>
          )}
        </div>

        <span className="font-sans text-[10px] text-fg-tertiary tabular-nums">
          {filtered.length}/{entries.length}
        </span>

        <button
          onClick={clearAll}
          className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-secondary cursor-pointer transition-colors"
          title={t("console.clearAllConsole")}
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-[12px]">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-fg-tertiary text-[12px] font-sans">
            {t("console.noOutput")}
          </div>
        ) : (
          filtered.map((entry) => {
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
          })
        )}
      </div>
    </div>
  );
}
