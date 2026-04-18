import { X, Plus } from "lucide-react";
import { useTabStore } from "@api-client/core";
import { EnvSelector } from "../url-bar/EnvSelector";

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const openTab = useTabStore((s) => s.openTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const setActiveTab = useTabStore((s) => s.setActiveTab);

  const handleNewTab = () => {
    openTab({ name: "New Request", method: "GET", url: "" });
  };

  return (
    <div className="h-tab-bar flex items-center px-2 border-b border-border-muted bg-bg-base">
      <div className="flex items-center gap-0.5 flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center gap-1.5 h-9 px-3 rounded-t-md text-sm font-medium transition-colors flex-shrink-0 ${
                isActive
                  ? "bg-bg-surface text-fg-primary border-b-2 border-brand"
                  : "text-fg-secondary hover:text-fg-primary hover:bg-bg-hover"
              }`}
            >
              <span className="max-w-40 truncate">{tab.name || "Untitled"}</span>
              {isActive && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:bg-bg-hover opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={handleNewTab}
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary transition-colors flex-shrink-0"
          title="New Tab (Cmd+T)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-shrink-0 ml-2">
        <EnvSelector />
      </div>
    </div>
  );
}