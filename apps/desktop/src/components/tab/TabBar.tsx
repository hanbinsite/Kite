import { X, Plus } from "lucide-react";
import { useTabStore } from "@api-client/core";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-method-get",
  POST: "bg-method-post",
  PUT: "bg-method-put",
  PATCH: "bg-method-patch",
  DELETE: "bg-method-delete",
  HEAD: "bg-method-head",
  OPTIONS: "bg-method-options",
};

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
    <div className="h-9 flex items-center gap-0.5 px-2 border-b border-border-muted bg-bg-base overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex items-center gap-1.5 h-7 px-2 rounded-t-md text-xs transition-colors ${
              isActive
                ? "bg-bg-surface text-fg-primary border-b-2 border-brand"
                : "text-fg-secondary hover:text-fg-primary hover:bg-bg-hover"
            }`}
          >
            <span
              className={`w-5 h-4 rounded text-[10px] font-bold flex items-center justify-center text-white ${METHOD_COLORS[tab.method] || "bg-fg-tertiary"}`}
            >
              {tab.method.substring(0, 3)}
            </span>
            <span className="max-w-24 truncate">{tab.name || "Untitled"}</span>
            {isActive && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="p-0.5 rounded hover:bg-bg-hover opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </span>
            )}
          </button>
        );
      })}
      <button
        onClick={handleNewTab}
        className="flex items-center justify-center w-6 h-6 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary transition-colors"
        title="New Tab (Cmd+T)"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
