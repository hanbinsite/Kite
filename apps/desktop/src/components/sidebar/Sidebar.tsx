import { useState } from "react";
import { Search, Plus, ChevronDown, ChevronRight, Folder, Clock, Settings } from "lucide-react";
import { useUIStore, useTabStore } from "@api-client/core";
import { useEnvironmentStore } from "../../stores/environment-store";

interface SidebarSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function SidebarSection({ title, defaultOpen = false, children }: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border-muted">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1 px-3 h-7 hover:bg-bg-hover transition-colors text-xs font-semibold uppercase tracking-wider text-fg-secondary"
      >
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span>{title}</span>
      </button>
      {isOpen && <div className="pb-2">{children}</div>}
    </div>
  );
}

export function Sidebar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const activeEnvId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const environments = useEnvironmentStore((s) => s.environments);
  const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
  const openTab = useTabStore((s) => s.openTab);

  return (
    <div className="h-full flex flex-col bg-bg-surface" style={{ width: sidebarWidth }}>
      <div className="flex items-center gap-2 px-3 h-11 border-b border-border-muted">
        <Search className="w-4 h-4 text-fg-tertiary" />
        <input
          type="text"
          placeholder="Search..."
          className="flex-1 bg-transparent text-sm text-fg-primary placeholder:text-fg-tertiary outline-none"
        />
        <button
          onClick={() => openTab({ name: "New Request", method: "GET", url: "" })}
          className="p-1 hover:bg-bg-hover rounded transition-colors"
        >
          <Plus className="w-4 h-4 text-fg-secondary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarSection title="Collections" defaultOpen>
          <div className="px-3 py-1 text-sm text-fg-secondary hover:text-fg-primary cursor-pointer flex items-center gap-2">
            <Folder className="w-4 h-4 text-brand" />
            <span>My Collection</span>
          </div>
        </SidebarSection>

        <SidebarSection title="History">
          <div className="px-3 py-1 text-sm text-fg-secondary hover:text-fg-primary cursor-pointer flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>GET /api/users</span>
          </div>
        </SidebarSection>

        <SidebarSection title="Environments">
          {environments.map((env) => (
            <button
              key={env.id}
              onClick={() => setActiveEnvironment(env.id)}
              className="w-full px-3 py-1 text-sm text-left hover:bg-bg-hover cursor-pointer flex items-center gap-2"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  env.id === activeEnvId ? "bg-brand" : "bg-fg-tertiary"
                }`}
              />
              <span className={env.id === activeEnvId ? "text-fg-primary" : "text-fg-secondary"}>
                {env.name}
              </span>
            </button>
          ))}
        </SidebarSection>
      </div>

      <div className="h-10 border-t border-border-muted flex items-center justify-end px-3">
        <button
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          title="Toggle Sidebar"
        >
          <Settings className="w-4 h-4 text-fg-tertiary" />
        </button>
      </div>
    </div>
  );
}
