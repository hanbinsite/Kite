import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { useTabStore } from "@api-client/core";
import { useRequestStore } from "../../stores";
import { EnvSelector } from "../url-bar/EnvSelector";

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const openTab = useTabStore((s) => s.openTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const removeTabData = useRequestStore((s) => s.removeTabData);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  const handleCloseTab = (tabId: string) => {
    closeTab(tabId);
    removeTabData(tabId);
  };

  const handleNewTab = () => {
    openTab({ name: "New Request", method: "GET", url: "" });
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const closeOtherTabs = (keepTabId: string) => {
    for (const tab of tabs) {
      if (tab.id !== keepTabId) {
        closeTab(tab.id);
        removeTabData(tab.id);
      }
    }
  };

  const closeAllTabs = () => {
    for (const tab of tabs) {
      closeTab(tab.id);
      removeTabData(tab.id);
    }
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
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              className={`group flex items-center gap-1.5 h-9 px-3 rounded-t-md text-sm font-medium transition-colors flex-shrink-0 ${
                isActive
                  ? "bg-bg-surface text-fg-primary border-b-2 border-brand"
                  : "text-fg-secondary hover:text-fg-primary hover:bg-bg-hover"
              }`}
            >
              <span className="max-w-40 truncate">{tab.url ? `${tab.method} ${tab.url}` : tab.name || "Untitled"}</span>
              {isActive && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
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
      {contextMenu && (
        <div
          className="fixed bg-bg-elevated border border-border-default rounded-lg shadow-lg py-1 z-[9999] min-w-[160px] animate-fade-in"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 120) }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { handleCloseTab(contextMenu.tabId); setContextMenu(null); }} className="w-full flex items-center h-7 px-3 text-sm text-fg-primary cursor-pointer hover:bg-bg-hover">Close Tab</button>
          <button onClick={() => { closeOtherTabs(contextMenu.tabId); setContextMenu(null); }} className="w-full flex items-center h-7 px-3 text-sm text-fg-primary cursor-pointer hover:bg-bg-hover">Close Others</button>
          <button onClick={() => { closeAllTabs(); setContextMenu(null); }} className="w-full flex items-center h-7 px-3 text-sm text-accent-danger cursor-pointer hover:bg-accent-danger/12">Close All</button>
        </div>
      )}
    </div>
  );
}