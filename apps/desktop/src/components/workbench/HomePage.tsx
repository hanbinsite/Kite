import { useState, useEffect } from "react";
import { Zap, Clock, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTabStore, useUIStore } from "@api-client/core";
import { queryHistoryEntries, type HistoryEntry } from "@api-client/core/http";

const METHOD_BG: Record<string, string> = {
  get: "bg-method-get",
  post: "bg-method-post",
  put: "bg-method-put",
  patch: "bg-method-patch",
  delete: "bg-method-delete",
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function HomePage() {
  const { t } = useTranslation();
  const openTab = useTabStore((s) => s.openTab);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    queryHistoryEntries(10).then(setHistory).catch(() => setHistory([]));
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-bg-base overflow-y-auto p-8">
      <div className="max-w-2xl w-full">
        <div className="flex flex-col items-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-brand/20 flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-brand" />
          </div>
          <h1 className="text-2xl font-semibold text-fg-primary mb-2">{t("home.welcomeBack")}</h1>
          <p className="text-fg-secondary">
            {t("home.startPrompt")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => openTab({ name: "New Request", method: "GET", url: "" })}
            className="flex items-center gap-3 p-4 bg-bg-surface border border-border-default rounded-lg hover:border-brand transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-brand/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-brand" />
            </div>
            <div>
              <div className="font-medium text-fg-primary">{t("home.newRequest")}</div>
              <div className="text-xs text-fg-secondary">Cmd + N</div>
            </div>
          </button>

          <button
            onClick={toggleSidebar}
            className="flex items-center gap-3 p-4 bg-bg-surface border border-border-default rounded-lg hover:border-brand transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-accent-info/20 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-accent-info" />
            </div>
            <div>
              <div className="font-medium text-fg-primary">{t("home.openCollection")}</div>
              <div className="text-xs text-fg-secondary">{t("home.browseCollections")}</div>
            </div>
          </button>
        </div>

        <div className="border-t border-border-muted pt-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-fg-tertiary" />
            <h2 className="text-sm font-medium text-fg-secondary">{t("home.recentRequests")}</h2>
          </div>
        <div className="space-y-2">
        {history.length === 0 && (
          <div className="text-xs text-fg-tertiary py-4 text-center">{t("home.noRecentRequests")}</div>
        )}
        {history.map((item) => (
          <button
            key={item.id}
            onClick={() =>
              openTab({
                name: item.url,
                method: item.method,
                url: item.url,
              })
            }
            className="w-full flex items-center gap-3 p-3 bg-bg-surface border border-border-default rounded-lg hover:border-brand transition-colors"
          >
            <span
              className={`px-1.5 py-0.5 rounded text-2xs font-bold text-white ${METHOD_BG[item.method.toLowerCase()] || "bg-fg-tertiary"}`}
            >
              {item.method}
            </span>
            <span className="flex-1 text-sm text-fg-primary text-left truncate">
              {item.url}
            </span>
            <span className="text-xs text-fg-tertiary">{formatTimeAgo(item.created_at)}</span>
          </button>
        ))}
          </div>
        </div>
      </div>
    </div>
  );
}
