import { useState, useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { Sidebar } from "./components/sidebar/Sidebar";
import { Workbench } from "./components/workbench/Workbench";
import { CommandPalette, type CommandItem } from "./components/command-palette";
import { useUIStore, useTabStore } from "@api-client/core";
import { Plus, Settings, FolderOpen, History } from "lucide-react";

export function App() {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openTab = useTabStore((s) => s.openTab);

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
      <AppLayout sidebar={<Sidebar />} workbench={<Workbench />} />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        items={commands}
      />
    </>
  );
}
