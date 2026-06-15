import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "./components/layout/AppLayout";
import { Sidebar } from "./components/sidebar/Sidebar";
import { CollapsedSidebar } from "./components/sidebar/CollapsedSidebar";
import { Workbench } from "./components/workbench/Workbench";
import { CommandPalette, type CommandItem } from "./components/command-palette";
import { SettingsPage } from "./components/settings";
import { CodeSnippetDrawer, CollectionRunnerDialog, ImportDialog, ExportDialog, VariableInspector } from "./components/drawers";
import { useUIStore, useTabStore } from "@api-client/core";
import { Plus, Settings, FolderOpen, Code2, Terminal, Play, Upload, Download, Variable, Bot } from "lucide-react";
import { useTheme, useKeyboardShortcuts, useAutoSave, useSaveShortcut } from "./hooks";
import { useRequestStore, initWsEventListener, initSseEventListener, initMqttEventListener, initGrpcEventListener, initMockEventListener, useCollectionStore } from "./stores";
import { useWsStore } from "./stores/websocket-store";
import { useSseStore } from "./stores/sse-store";
import { useMqttStore } from "./stores/mqtt-store";
import { useProviderStore } from "@api-client/core/ai";
import { i18n } from "./i18n";
import { formatShortcut } from "./utils/platform";

export function App() {
  const { t } = useTranslation();
  useTheme();
  useAutoSave();
  useSaveShortcut();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCodeDrawerOpen, setIsCodeDrawerOpen] = useState(false);
  const [isRunnerOpen, setIsRunnerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isVariableInspectorOpen, setIsVariableInspectorOpen] = useState(false);

  const language = useUIStore((s) => s.language);

  useEffect(() => {
    initWsEventListener();
    initSseEventListener();
    initMqttEventListener();
    initGrpcEventListener();
    initMockEventListener();
    useProviderStore.getState().loadProviders();
  }, []);

  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [language]);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleConsole = useUIStore((s) => s.toggleConsole);
  const toggleAiPanel = useUIStore((s) => s.toggleAiPanel);
  const setBottomPanelTab = useUIStore((s) => s.setBottomPanelTab);
  const openTab = useTabStore((s) => s.openTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const removeTabData = useRequestStore((s) => s.removeTabData);
  const sendRequest = useRequestStore((s) => s.sendRequest);
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));

  useKeyboardShortcuts([
    { shortcut: "cmd+w", handler: () => {
      if (activeTabId) {
        const tab = useTabStore.getState().tabs.find(t => t.id === activeTabId);
        const isDirty = useRequestStore.getState().dirtyTabs[activeTabId];
        if (tab?.isModified || isDirty) return;
        useWsStore.getState().disconnect(activeTabId);
        useSseStore.getState().disconnect(activeTabId);
        useMqttStore.getState().disconnect(activeTabId);
        closeTab(activeTabId);
        removeTabData(activeTabId);
      }
    } },
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
        openTab({ name: t("tabs.newRequest"), method: "GET", url: "" });
      }
      if (e.key.toLowerCase() === "c" && isMeta && e.shiftKey) {
        e.preventDefault();
        setIsCodeDrawerOpen(true);
      }
      if (e.key.toLowerCase() === "j" && isMeta) {
        e.preventDefault();
        toggleConsole();
      }
      if (e.key.toLowerCase() === "l" && isMeta && e.shiftKey) {
        e.preventDefault();
        toggleAiPanel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebar, openTab, toggleConsole, toggleAiPanel, t]);

  const collections = useCollectionStore((s) => s.collections);

  const collectionItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [];
    for (const col of collections) {
      for (const node of col.items) {
        if (node.type === "request") {
          items.push({
            id: `col-req-${col.id}-${node.id}`,
            label: node.name,
            category: "collection",
            icon: <FolderOpen className="w-4 h-4" />,
            detail: `${col.name} — ${node.method} ${node.url}`,
            action: () => openTab({ name: node.name, method: node.method as "GET", url: node.url }),
          });
        }
      }
    }
    return items;
  }, [collections, openTab]);

  const commands: CommandItem[] = [
    {
      id: "new-request",
      label: t("commandPalette.actions.newRequest"),
      category: "action",
      icon: <Plus className="w-4 h-4" />,
      action: () => openTab({ name: t("tabs.newRequest"), method: "GET", url: "" }),
      shortcut: formatShortcut("Cmd+N"),
    },
    {
      id: "toggle-sidebar",
      label: t("commandPalette.actions.toggleSidebar"),
      category: "action",
      icon: <Settings className="w-4 h-4" />,
      action: toggleSidebar,
      shortcut: formatShortcut("Cmd+B"),
    },
    {
      id: "generate-code",
      label: t("commandPalette.actions.generateCode"),
      category: "action",
      icon: <Code2 className="w-4 h-4" />,
      action: () => setIsCodeDrawerOpen(true),
      shortcut: formatShortcut("Cmd+Shift+C"),
    },
    {
      id: "toggle-console",
      label: t("commandPalette.actions.toggleConsole"),
      category: "action",
      icon: <Terminal className="w-4 h-4" />,
      action: toggleConsole,
      shortcut: formatShortcut("Cmd+J"),
    },
    {
      id: "collection-runner",
      label: t("commandPalette.actions.collectionRunner"),
      category: "action",
      icon: <Play className="w-4 h-4" />,
      action: () => setIsRunnerOpen(true),
    },
    {
      id: "import",
      label: t("commandPalette.actions.importCollection"),
      category: "action",
      icon: <Upload className="w-4 h-4" />,
      action: () => setIsImportOpen(true),
    },
    {
      id: "export",
      label: t("commandPalette.actions.exportCollection"),
      category: "action",
      icon: <Download className="w-4 h-4" />,
      action: () => setIsExportOpen(true),
    },
    {
      id: "variable-inspector",
      label: t("commandPalette.actions.variableInspector"),
      category: "action",
      icon: <Variable className="w-4 h-4" />,
      action: () => setIsVariableInspectorOpen(true),
    },
    {
      id: "ai-chat",
      label: t("commandPalette.actions.aiAssistant"),
      category: "ai",
      icon: <Bot className="w-4 h-4" />,
      action: () => { setBottomPanelTab("ai"); toggleAiPanel(); },
      shortcut: formatShortcut("Cmd+Shift+L"),
    },
    ...collectionItems,
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
      <CodeSnippetDrawer isOpen={isCodeDrawerOpen} onClose={() => setIsCodeDrawerOpen(false)} />
      <CollectionRunnerDialog isOpen={isRunnerOpen} onClose={() => setIsRunnerOpen(false)} />
      <ImportDialog isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      <ExportDialog isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
      <VariableInspector isOpen={isVariableInspectorOpen} onClose={() => setIsVariableInspectorOpen(false)} />
    </>
  );
}
