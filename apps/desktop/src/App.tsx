import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "./components/layout/AppLayout";
import { Sidebar } from "./components/sidebar/Sidebar";
import { CollapsedSidebar } from "./components/sidebar/CollapsedSidebar";
import { Workbench } from "./components/workbench/Workbench";
import { CommandPalette, type CommandItem } from "./components/command-palette";
import { SettingsPage } from "./components/settings";
import { CodeSnippetDrawer, CollectionRunnerDialog, ImportDialog, ExportDialog, VariableInspector } from "./components/drawers";
import { ConfirmDialog } from "./components/shared/ConfirmDialog";
import { toast } from "@api-client/ui";
import { useUIStore, useTabStore } from "@api-client/core";
import { Plus, Settings, FolderOpen, Code2, Terminal, Play, Upload, Download, Variable, Bot, Activity, Plug, ShieldAlert } from "lucide-react";
import { useTheme, useKeyboardShortcuts, useAutoSave, useSaveShortcut } from "./hooks";
import { saveCurrentRequest } from "./hooks/useAutoSave";
import { useRequestStore, initWsEventListener, initSseEventListener, initMqttEventListener, initGrpcEventListener, initMockEventListener, useCollectionStore } from "./stores";
import { useConsoleStore } from "./stores/console-store";
import { registerVariableCompletionProvider } from "./stores/variable-completion-provider";
import { ApiMonitorDialog } from "./components/drawers/ApiMonitorDialog";
import { useWsStore } from "./stores/websocket-store";
import { useSseStore } from "./stores/sse-store";
import { useMqttStore } from "./stores/mqtt-store";
import { useProviderStore } from "@api-client/core/ai";
import { useEnvironmentStore } from "./stores/environment-store";
import { usePluginStore } from "./stores/plugin-store";
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
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isVariableInspectorOpen, setIsVariableInspectorOpen] = useState(false);
  const [shortcutConfirmClose, setShortcutConfirmClose] = useState<string | null>(null);

  const language = useUIStore((s) => s.language);

  useEffect(() => {
    initWsEventListener();
    initSseEventListener();
    initMqttEventListener();
    initGrpcEventListener();
    initMockEventListener();
    useProviderStore.getState().loadProviders();
    useEnvironmentStore.getState().loadFromDisk();
    usePluginStore.getState().loadPlugins();
    registerVariableCompletionProvider();
    useTabStore.getState().restoreTabs();
  }, []);

  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [language]);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleConsole = useUIStore((s) => s.toggleConsole);
  const toggleAiPanel = useUIStore((s) => s.toggleAiPanel);
  const focusUrlBar = useUIStore((s) => s.focusUrlBar);
  const setBottomPanelTab = useUIStore((s) => s.setBottomPanelTab);
  const openTab = useTabStore((s) => s.openTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const removeTabData = useRequestStore((s) => s.removeTabData);
  const sendRequest = useRequestStore((s) => s.sendRequest);
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));

  const allTabs = useTabStore((s) => s.tabs);
  useEffect(() => {
    useTabStore.getState().saveTabs();
  }, [allTabs, activeTabId]);

  useKeyboardShortcuts([
    { shortcut: "cmd+w", handler: () => {
      if (!activeTabId) return;
      const tab = useTabStore.getState().tabs.find(t => t.id === activeTabId);
      const isDirty = useRequestStore.getState().dirtyTabs[activeTabId];
      if (tab?.isModified || isDirty) {
        setShortcutConfirmClose(activeTabId);
        return;
      }
      useWsStore.getState().disconnect(activeTabId);
      useSseStore.getState().disconnect(activeTabId);
      useMqttStore.getState().disconnect(activeTabId);
      useWsStore.getState().removeConnection(activeTabId);
      useSseStore.getState().removeConnection(activeTabId);
      useMqttStore.getState().removeConnection(activeTabId);
      closeTab(activeTabId);
      removeTabData(activeTabId);
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
      if (e.key.toLowerCase() === "r" && isMeta && !e.shiftKey) {
        e.preventDefault();
        if (activeTabId && activeTab?.url) {
          sendRequest(activeTabId, (activeTab.method ?? "GET") as "GET", activeTab.url);
        }
      }
      if (e.key === "/" && isMeta && !e.shiftKey) {
        e.preventDefault();
        focusUrlBar();
      }
      if (e.key.toLowerCase() === "n" && isMeta && e.shiftKey) {
        e.preventDefault();
        const colId = `col-${Date.now()}`;
        useCollectionStore.getState().addCollection(colId, "New Collection");
      }
      if (isMeta && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        const tabs = useTabStore.getState().tabs;
        if (tabs[idx]) {
          useTabStore.getState().setActiveTab(tabs[idx]!.id);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebar, openTab, toggleConsole, toggleAiPanel, focusUrlBar, activeTabId, activeTab, sendRequest, t]);

  const collections = useCollectionStore((s) => s.collections);
  const plugins = usePluginStore((s) => s.plugins);

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

  const pluginCommandItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [];
    const tabId = activeTabId ?? "";
    for (const plugin of plugins) {
      if (!plugin.enabled || plugin.hasError) continue;
      for (const cmd of plugin.manifest.commands) {
        items.push({
          id: `plugin-${plugin.manifest.id}-${cmd.id}`,
          label: cmd.title,
          category: "plugin",
          icon: <Plug className="w-4 h-4" />,
          detail: cmd.description ?? plugin.manifest.name,
          action: () => {
            usePluginStore
              .getState()
              .executeCommand(plugin.manifest.id, cmd.id, {
                event: "command:invoke",
                data: { tabId, pluginId: plugin.manifest.id, commandId: cmd.id },
              })
              .then((result) => {
                const consoleStore = useConsoleStore.getState();
                if (result.success) {
                  consoleStore.addEntry(tabId, {
                    level: "info",
                    message: `[plugin] ${plugin.manifest.id} command "${cmd.id}" executed`,
                    source: "system",
                  });
                  for (const log of result.logs) {
                    consoleStore.addEntry(tabId, {
                      level: "info",
                      message: `[plugin][${plugin.manifest.id}] ${log}`,
                      source: "system",
                    });
                  }
                  if (result.uiInject) {
                    toast({
                      variant: "info",
                      title: plugin.manifest.name,
                      description: result.uiInject,
                    });
                  }
                  toast({
                    variant: "success",
                    title: plugin.manifest.name,
                    description: `Command "${cmd.title}" executed`,
                  });
                } else {
                  consoleStore.addEntry(tabId, {
                    level: "error",
                    message: `[plugin] ${plugin.manifest.id} command "${cmd.id}" failed: ${result.error ?? "unknown error"}`,
                    source: "system",
                  });
                  toast({
                    variant: "error",
                    title: plugin.manifest.name,
                    description: `Command "${cmd.title}" failed: ${result.error ?? "unknown error"}`,
                  });
                }
              })
              .catch((err) => {
                toast({
                  variant: "error",
                  title: plugin.manifest.name,
                  description: `Command "${cmd.title}" error: ${err}`,
                });
              });
          },
        });
      }
    }
    return items;
  }, [plugins, activeTabId]);

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
      id: "new-websocket",
      label: "New WebSocket",
      category: "action",
      icon: <Plus className="w-4 h-4" />,
      action: () => openTab({ name: "WebSocket", method: "GET", url: "ws://localhost:8080", protocol: "websocket" }),
    },
    {
      id: "new-sse",
      label: "New SSE",
      category: "action",
      icon: <Plus className="w-4 h-4" />,
      action: () => openTab({ name: "SSE", method: "GET", url: "https://example.com/events", protocol: "sse" }),
    },
    {
      id: "new-mqtt",
      label: "New MQTT",
      category: "action",
      icon: <Plus className="w-4 h-4" />,
      action: () => openTab({ name: "MQTT", method: "GET", url: "mqtt://localhost:1883", protocol: "mqtt" }),
    },
    {
      id: "new-grpc",
      label: "New gRPC",
      category: "action",
      icon: <Plus className="w-4 h-4" />,
      action: () => openTab({ name: "gRPC", method: "POST", url: "http://localhost:50051", protocol: "grpc" }),
    },
    {
      id: "new-mock",
      label: "New Mock Server",
      category: "action",
      icon: <Plus className="w-4 h-4" />,
      action: () => openTab({ name: "Mock Server", method: "GET", url: "", protocol: "mock" }),
    },
    {
      id: "new-proxy",
      label: "MITM Proxy",
      category: "action",
      icon: <ShieldAlert className="w-4 h-4" />,
      action: () => openTab({ name: "MITM Proxy", method: "GET", url: "", protocol: "proxy" }),
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
      id: "api-monitor",
      label: "API Monitor",
      category: "action",
      icon: <Activity className="w-4 h-4" />,
      action: () => setIsMonitorOpen(true),
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
    {
      id: "resend-request",
      label: t("commandPalette.actions.resendRequest"),
      category: "action",
      icon: <Play className="w-4 h-4" />,
      action: () => { if (activeTabId && activeTab?.url) { sendRequest(activeTabId, (activeTab.method ?? "GET") as "GET", activeTab.url); } },
      shortcut: formatShortcut("Cmd+R"),
    },
    {
      id: "focus-url-bar",
      label: t("commandPalette.actions.focusUrlBar"),
      category: "action",
      icon: <Settings className="w-4 h-4" />,
      action: () => focusUrlBar(),
      shortcut: formatShortcut("Cmd+/"),
    },
    {
      id: "new-collection",
      label: t("commandPalette.actions.newCollection"),
      category: "action",
      icon: <FolderOpen className="w-4 h-4" />,
      action: () => useCollectionStore.getState().addCollection(`col-${Date.now()}`, "New Collection"),
      shortcut: formatShortcut("Cmd+Shift+N"),
    },
    ...collectionItems,
    ...pluginCommandItems,
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
      <ApiMonitorDialog open={isMonitorOpen} onOpenChange={setIsMonitorOpen} />
      <ImportDialog isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      <ExportDialog isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
      <VariableInspector isOpen={isVariableInspectorOpen} onClose={() => setIsVariableInspectorOpen(false)} />
      <ConfirmDialog
        open={shortcutConfirmClose !== null}
        onOpenChange={(open) => { if (!open) setShortcutConfirmClose(null); }}
        title={t("tabs.unsavedChanges")}
        description={t("tabs.unsavedMessage")}
        confirmLabel={t("tabs.dontSave")}
        cancelLabel={t("common.cancel")}
        secondaryLabel={t("common.save")}
        variant="warning"
        onConfirm={() => {
          if (!shortcutConfirmClose) return;
          const tabId = shortcutConfirmClose;
          useWsStore.getState().disconnect(tabId);
          useSseStore.getState().disconnect(tabId);
          useMqttStore.getState().disconnect(tabId);
          useWsStore.getState().removeConnection(tabId);
          useSseStore.getState().removeConnection(tabId);
          useMqttStore.getState().removeConnection(tabId);
          closeTab(tabId);
          removeTabData(tabId);
          setShortcutConfirmClose(null);
        }}
        onCancel={() => setShortcutConfirmClose(null)}
        onSecondary={() => {
          if (!shortcutConfirmClose) return;
          const tabId = shortcutConfirmClose;
          saveCurrentRequest(tabId);
          useWsStore.getState().disconnect(tabId);
          useSseStore.getState().disconnect(tabId);
          useMqttStore.getState().disconnect(tabId);
          useWsStore.getState().removeConnection(tabId);
          useSseStore.getState().removeConnection(tabId);
          useMqttStore.getState().removeConnection(tabId);
          closeTab(tabId);
          removeTabData(tabId);
          setShortcutConfirmClose(null);
        }}
      />
    </>
  );
}
