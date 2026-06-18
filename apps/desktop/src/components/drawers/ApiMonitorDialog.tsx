import { useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Play, Square, Plus, Trash2, Activity } from "lucide-react";
import { useMonitorStore } from "../../stores/monitor-store";
import { useTabStore } from "@api-client/core";
import { useRequestStore } from "../../stores";
import { useTranslation } from "react-i18next";

interface ApiMonitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiMonitorDialog({ open, onOpenChange }: ApiMonitorDialogProps) {
  const { t } = useTranslation();
  const monitors = useMonitorStore((s) => s.monitors);
  const results = useMonitorStore((s) => s.results);
  const addMonitor = useMonitorStore((s) => s.addMonitor);
  const removeMonitor = useMonitorStore((s) => s.removeMonitor);
  const toggleMonitor = useMonitorStore((s) => s.toggleMonitor);

  const handleAddFromActiveTab = useCallback(() => {
    const tabStore = useTabStore.getState();
    const reqStore = useRequestStore.getState();
    const tabId = tabStore.activeTabId;
    if (!tabId) return;
    const tab = tabStore.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const data = reqStore.requestDataMap[tabId];
    if (!data) return;

    addMonitor({
      name: tab.name ?? "Monitor",
      method: tab.method ?? "GET",
      url: tab.url ?? "",
      headers: data.headers ?? [],
      params: data.params ?? [],
      body: data.body ?? null,
      auth: data.auth ?? null,
      settings: data.settings ?? null,
      intervalMs: 60000,
    });
  }, [addMonitor]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] max-h-[80vh] bg-bg-surface border border-border-muted rounded-lg shadow-xl z-50 flex flex-col">
          <div className="flex items-center justify-between h-[40px] px-4 border-b border-border-muted shrink-0">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand" />
              <Dialog.Title className="text-sm font-semibold text-fg-primary">{t("monitor.title")}</Dialog.Title>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddFromActiveTab}
                className="flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium text-brand hover:bg-brand/10 cursor-pointer transition-colors"
              >
                <Plus className="w-3 h-3" />
                {t("monitor.addCurrent")}
              </button>
              <Dialog.Close asChild>
                <button className="p-1 hover:bg-bg-hover rounded cursor-pointer">
                  <X className="w-4 h-4 text-fg-tertiary" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-3">
            {monitors.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-fg-tertiary text-sm gap-2">
                <Activity className="w-8 h-8 opacity-30" />
                <p>{t("monitor.empty")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {monitors.map((m) => {
                  const mResults = results[m.id] ?? [];
                  const lastResult = mResults[mResults.length - 1];
                  const successCount = mResults.filter((r) => r.success).length;
                  return (
                    <div key={m.id} className="bg-bg-elevated border border-border-muted rounded-md p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                          m.method === "GET" ? "text-method-get" : m.method === "POST" ? "text-method-post" : "text-fg-secondary"
                        }`}>{m.method}</span>
                        <span className="text-[13px] text-fg-primary truncate flex-1 font-mono">{m.url}</span>
                        <span className="text-[10px] text-fg-tertiary shrink-0">{m.name}</span>
                        <button
                          onClick={() => toggleMonitor(m.id)}
                          className={`flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium cursor-pointer transition-colors ${
                            m.enabled ? "bg-accent-danger/10 text-accent-danger hover:bg-accent-danger/20" : "bg-accent-success/10 text-accent-success hover:bg-accent-success/20"
                          }`}
                        >
                          {m.enabled ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          {m.enabled ? t("monitor.stop") : t("monitor.start")}
                        </button>
                        <button
                          onClick={() => removeMonitor(m.id)}
                          className="p-1 hover:bg-accent-danger/10 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 text-fg-tertiary hover:text-accent-danger" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-fg-tertiary">
                        <span>{t("monitor.interval")} {(m.intervalMs / 1000).toFixed(0)}s</span>
                        <span>{t("monitor.checks")} {mResults.length}</span>
                        <span className="text-accent-success">{t("monitor.pass")} {successCount}</span>
                        <span className="text-accent-danger">{t("monitor.fail")} {mResults.length - successCount}</span>
                        {lastResult && (
                          <span className={lastResult.success ? "text-accent-success" : "text-accent-danger"}>
                            {t("monitor.last")} {lastResult.status || t("monitor.err")} ({lastResult.duration}ms)
                          </span>
                        )}
                      </div>
                      {mResults.length > 0 && (
                        <div className="mt-2 flex items-end gap-[2px] h-[20px]">
                          {mResults.slice(-30).map((r, i) => (
                            <div
                              key={i}
                              className={`flex-1 min-w-[2px] max-w-[8px] rounded-sm ${
                                r.success ? "bg-accent-success/60" : "bg-accent-danger/60"
                              }`}
                              style={{ height: `${Math.min(100, (r.duration / 2000) * 100)}%` }}
                              title={`${r.status} - ${r.duration}ms`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
