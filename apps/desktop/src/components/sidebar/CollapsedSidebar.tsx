import { Settings, Search, FolderOpen, Plus, History, Bot } from "lucide-react";
import { useUIStore, useTabStore } from "@api-client/core";
import { useTranslation } from "react-i18next";

export function CollapsedSidebar() {
  const { t } = useTranslation();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openSettings = useUIStore((s) => s.openSettings);
  const toggleAiPanel = useUIStore((s) => s.toggleAiPanel);
  const openTab = useTabStore((s) => s.openTab);

  return (
    <div className="h-full flex flex-col items-center py-3 gap-1 bg-bg-surface">
      <button
        onClick={toggleSidebar}
        className="p-2 hover:bg-bg-hover rounded transition-colors"
        title={t("sidebar.expandSidebar")}
      >
        <Search className="w-4 h-4 text-fg-secondary" />
      </button>
      <button
        onClick={() => openTab({ name: "New Request", method: "GET", url: "" })}
        className="p-2 hover:bg-bg-hover rounded transition-colors"
        title={t("sidebar.newRequest")}
      >
        <Plus className="w-4 h-4 text-fg-secondary" />
      </button>
      <button
        onClick={toggleSidebar}
        className="p-2 hover:bg-bg-hover rounded transition-colors"
        title={t("sidebar.expandSidebar")}
      >
        <FolderOpen className="w-4 h-4 text-fg-secondary" />
      </button>
      <button
        onClick={toggleSidebar}
        className="p-2 hover:bg-bg-hover rounded transition-colors"
        title={t("sidebar.expandSidebar")}
      >
        <History className="w-4 h-4 text-fg-secondary" />
      </button>
      <div className="flex-1" />
      <button
        onClick={() => toggleAiPanel()}
        className="p-2 hover:bg-bg-hover rounded transition-colors"
        title="AI Assistant"
      >
        <Bot className="w-4 h-4 text-fg-tertiary" />
      </button>
      <button
        onClick={() => openSettings()}
        className="p-2 hover:bg-bg-hover rounded transition-colors"
        title={t("settings.title")}
      >
        <Settings className="w-4 h-4 text-fg-tertiary" />
      </button>
    </div>
  );
}
