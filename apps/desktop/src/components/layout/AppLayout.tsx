import { useUIStore } from "@api-client/core";
import { GlobalConsole } from "../console/GlobalConsole";

interface AppLayoutProps {
  sidebar: React.ReactNode;
  collapsedSidebar: React.ReactNode;
  workbench: React.ReactNode;
}

export function AppLayout({ sidebar, collapsedSidebar, workbench }: AppLayoutProps) {
  const sidebarVisible = useUIStore((s) => s.sidebarVisible);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const consoleOpen = useUIStore((s) => s.consoleOpen);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-base">
      {sidebarVisible && !sidebarCollapsed && (
        <div
          className="flex-shrink-0 border-r border-border-muted overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          {sidebar}
        </div>
      )}
      {sidebarVisible && sidebarCollapsed && (
        <div className="flex-shrink-0 w-[52px] border-r border-border-muted overflow-hidden">
          {collapsedSidebar}
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">{workbench}</div>
        {consoleOpen && <GlobalConsole />}
      </div>
    </div>
  );
}
