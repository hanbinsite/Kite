import { useState, useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { Sidebar } from "./components/sidebar/Sidebar";
import { CollapsedSidebar } from "./components/sidebar/CollapsedSidebar";
import { Workbench } from "./components/workbench/Workbench";
import { CommandPalette, type CommandItem } from "./components/command-palette";
import { SettingsPage } from "./components/settings";
import { useUIStore, useTabStore } from "@api-client/core";
import { Plus, Settings, FolderOpen, History } from "lucide-react";
import { useTheme, useKeyboardShortcuts } from "./hooks";
import { useRequestStore } from "./stores";

export function App() {
  useTheme();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openTab = useTabStore((s) => s.openTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const removeTabData = useRequestStore((s) => s.removeTabData);
  const sendRequest = useRequestStore((s) => s.sendRequest);
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));

  useKeyboardShortcuts([
    { shortcut: "cmd+w", handler: () => { if (activeTabId) { closeTab(activeTabId); removeTabData(activeTabId); } } },
    { shortcut: "cmd+enter", handler: () => { if (activeTabId && activeTab?.url) { sendRequest(activeTabId, (activeTab.method ?? "GET") as "GET", activeTab.url); } } },
  ]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (e.key.toLowerCase() === "k" && isMeta) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      if (e.key.toLowerCase() === "b" && isMeta) {
        e.preventDefault();
        toggleSidebar();
      }
      if (e.key.toLowerCase() === "n" && isMeta) {
        e.preventDefault();
        openTab({ name: "New Request", method: "GET", url: "" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebar, openTab]);

  const commands: CommandItem[] = [
    {
      id: "new-request",
      label: "New Request",
      category: "action",
      icon: <Plus className="w-4 h-4" />,
      action: () => openTab({ name: "New Request", method: "GET", url: "" }),
      shortcut: "Cmd+N",
    },
    {
      id: "toggle-sidebar",
      label: "Toggle Sidebar",
      category: "action",
      icon: <Settings className="w-4 h-4" />,
      action: toggleSidebar,
      shortcut: "Cmd+B",
    },
    {
      id: "open-collection",
      label: "Open Collection",
      category: "action",
      icon: <FolderOpen className="w-4 h-4" />,
      action: () => {},
    },
    {
      id: "view-history",
      label: "View History",
      category: "recent",
      icon: <History className="w-4 h-4" />,
      action: () => {},
    },
  ];

  return (
    <>
      <AppLayout sidebar={<Sidebar />} collapsedSidebar={<CollapsedSidebar />} workbench={<Workbench />} />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        items={commands}
      />
      <SettingsPage />
    </>
  );
}
