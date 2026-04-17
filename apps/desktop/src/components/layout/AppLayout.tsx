import { useUIStore } from "@api-client/core";

interface AppLayoutProps {
  sidebar: React.ReactNode;
  workbench: React.ReactNode;
}

export function AppLayout({ sidebar, workbench }: AppLayoutProps) {
  const sidebarVisible = useUIStore((s) => s.sidebarVisible);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-base">
      {sidebarVisible && (
        <div
          className="flex-shrink-0 border-r border-border-muted overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          {sidebar}
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">{workbench}</div>
    </div>
  );
}
