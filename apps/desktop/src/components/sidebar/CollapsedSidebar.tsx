import { Settings, Search, FolderOpen, Plus, History } from "lucide-react";
import { useUIStore, useTabStore } from "@api-client/core";

export function CollapsedSidebar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openSettings = useUIStore((s) => s.openSettings);
  const openTab = useTabStore((s) => s.openTab);

  return (
    <div className="h-full flex flex-col items-center py-3 gap-1 bg-bg-surface">
      <button
        onClick={toggleSidebar}
        className="p-2 hover:bg-bg-hover rounded transition-colors"
        title="Expand Sidebar (Cmd+B)"
      >
        <Search className="w-4 h-4 text-fg-secondary" />
      </button>
      <button
        onClick={() => openTab({ name: "New Request", method: "GET", url: "" })}
        className="p-2 hover:bg-bg-hover rounded transition-colors"
        title="New Request"
      >
        <Plus className="w-4 h-4 text-fg-secondary" />
      </button>
      <button
        onClick={toggleSidebar}
        className="p-2 hover:bg-bg-hover rounded transition-colors"
        title="Collections"
      >
        <FolderOpen className="w-4 h-4 text-fg-secondary" />
      </button>
      <button
        onClick={toggleSidebar}
        className="p-2 hover:bg-bg-hover rounded transition-colors"
        title="History"
      >
        <History className="w-4 h-4 text-fg-secondary" />
      </button>
      <div className="flex-1" />
      <button
        onClick={() => openSettings()}
        className="p-2 hover:bg-bg-hover rounded transition-colors"
        title="Settings"
      >
        <Settings className="w-4 h-4 text-fg-tertiary" />
      </button>
    </div>
  );
}
