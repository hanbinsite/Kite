import { useRef, useCallback, useEffect, useState } from "react";
import { useUIStore } from "@api-client/core";
import { GlobalConsole } from "../console/GlobalConsole";
import { AiChatPanel } from "../ai/AiChatPanel";

interface AppLayoutProps {
  sidebar: React.ReactNode;
  collapsedSidebar: React.ReactNode;
  workbench: React.ReactNode;
}

export function AppLayout({ sidebar, collapsedSidebar, workbench }: AppLayoutProps) {
  const sidebarVisible = useUIStore((s) => s.sidebarVisible);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen);
  const aiPanelWidth = useUIStore((s) => s.aiPanelWidth);
  const setAiPanelWidth = useUIStore((s) => s.setAiPanelWidth);
  const consoleOpen = useUIStore((s) => s.consoleOpen);

  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = aiPanelWidth;
  }, [aiPanelWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartX.current - e.clientX;
      const newWidth = Math.min(600, Math.max(260, resizeStartWidth.current + delta));
      setAiPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setAiPanelWidth]);

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
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-hidden">{workbench}</div>
          {aiPanelOpen && (
            <>
              <div
                className={`w-1 cursor-col-resize shrink-0 transition-colors ${isResizing ? "bg-brand" : "hover:bg-brand/50"}`}
                onMouseDown={handleResizeStart}
              />
              <div style={{ width: aiPanelWidth, minWidth: 260 }} className="flex-shrink-0 overflow-hidden">
                <AiChatPanel />
              </div>
            </>
          )}
        </div>
        {consoleOpen && <GlobalConsole />}
      </div>
    </div>
  );
}