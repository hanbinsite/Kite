import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Loader2 } from "lucide-react";
import { useTabStore } from "@api-client/core";
import { useRequestStore, useWsStore, useSseStore, useMqttStore, useGrpcStore } from "../../stores";
import { modKeyLabel } from "../../utils/platform";
import { EnvSelector } from "../url-bar/EnvSelector";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { saveCurrentRequest } from "../../hooks/useAutoSave";

export function TabBar() {
  const { t } = useTranslation();
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const openTab = useTabStore((s) => s.openTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const removeTabData = useRequestStore((s) => s.removeTabData);
  const dirtyTabs = useRequestStore((s) => s.dirtyTabs);
  const loadingTabs = useRequestStore((s) => s.loadingTabs);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [confirmClose, setConfirmClose] = useState<{ tabId: string; source: "close" | "closeOthers" | "closeAll" } | null>(null);
  const [confirmActiveConnection, setConfirmActiveConnection] = useState<{ tabId: string; source: "close" | "closeOthers" | "closeAll" } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  const hasActiveConnection = (tabId: string) => {
    const wsStore = useWsStore.getState();
    const sseStore = useSseStore.getState();
    const mqttStore = useMqttStore.getState();
    const grpcStore = useGrpcStore.getState();
    const wsActive = wsStore.connections[tabId]?.status === "connected" || wsStore.connections[tabId]?.status === "connecting";
    const sseActive = sseStore.connections[tabId]?.status === "connected" || sseStore.connections[tabId]?.status === "connecting";
    const mqttActive = mqttStore.connections[tabId]?.status === "connected" || mqttStore.connections[tabId]?.status === "connecting";
    const grpcActive = grpcStore.requests[tabId]?.loading;
    return wsActive || sseActive || mqttActive || grpcActive;
  };

  const forceCloseTab = (tabId: string) => {
    useWsStore.getState().disconnect(tabId);
    useSseStore.getState().disconnect(tabId);
    useMqttStore.getState().disconnect(tabId);
    closeTab(tabId);
    removeTabData(tabId);
  };

  const handleCloseTab = (tabId: string) => {
    if (dirtyTabs[tabId]) {
      setConfirmClose({ tabId, source: "close" });
    } else if (hasActiveConnection(tabId)) {
      setConfirmActiveConnection({ tabId, source: "close" });
    } else {
      forceCloseTab(tabId);
    }
  };

  const handleConfirmConnectionClose = () => {
    if (!confirmActiveConnection) return;
    const { tabId, source } = confirmActiveConnection;
    if (source === "close") {
      forceCloseTab(tabId);
    } else if (source === "closeOthers") {
      for (const tab of tabs) {
        if (tab.id !== tabId) forceCloseTab(tab.id);
      }
    } else {
      for (const tab of tabs) forceCloseTab(tab.id);
    }
    setConfirmActiveConnection(null);
  };

  const handleConfirmClose = () => {
    if (!confirmClose) return;
    const { tabId, source } = confirmClose;
    if (source === "close") {
      forceCloseTab(tabId);
    } else if (source === "closeOthers") {
      for (const tab of tabs) {
        if (tab.id !== tabId) forceCloseTab(tab.id);
      }
    } else {
      for (const tab of tabs) forceCloseTab(tab.id);
    }
    setConfirmClose(null);
  };

  const handleSaveAndClose = () => {
    if (!confirmClose) return;
    const { tabId, source } = confirmClose;
    if (source === "close") {
      saveCurrentRequest(tabId);
      forceCloseTab(tabId);
    } else if (source === "closeOthers") {
      for (const tab of tabs) {
        if (tab.id !== tabId) {
          if (dirtyTabs[tab.id]) saveCurrentRequest(tab.id);
          forceCloseTab(tab.id);
        }
      }
    } else {
      for (const tab of tabs) {
        if (dirtyTabs[tab.id]) saveCurrentRequest(tab.id);
        forceCloseTab(tab.id);
      }
    }
    setConfirmClose(null);
  };

  const handleNewTab = () => {
    openTab({ name: t("tabs.newRequest"), method: "GET", url: "" });
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const closeOtherTabs = (keepTabId: string) => {
    const hasDirty = tabs.some((t) => t.id !== keepTabId && dirtyTabs[t.id]);
    const hasActiveConnections = tabs.some((t) => t.id !== keepTabId && hasActiveConnection(t.id));
    if (hasDirty) {
      setConfirmClose({ tabId: keepTabId, source: "closeOthers" });
    } else if (hasActiveConnections) {
      setConfirmActiveConnection({ tabId: keepTabId, source: "closeOthers" });
    } else {
      for (const tab of tabs) {
        if (tab.id !== keepTabId) forceCloseTab(tab.id);
      }
    }
  };

  const closeAllTabs = () => {
    const hasDirty = tabs.some((t) => dirtyTabs[t.id]);
    const hasActiveConnections = tabs.some((t) => hasActiveConnection(t.id));
    if (hasDirty) {
      setConfirmClose({ tabId: tabs[0]?.id ?? "", source: "closeAll" });
    } else if (hasActiveConnections) {
      setConfirmActiveConnection({ tabId: tabs[0]?.id ?? "", source: "closeAll" });
    } else {
      for (const tab of tabs) forceCloseTab(tab.id);
    }
  };

  return (
    <div className="h-tab-bar flex items-center px-2 border-b border-border-muted bg-bg-base">
      <div className="flex items-center gap-0.5 flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }} role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              role="tab"
              aria-selected={isActive}
              className={`group flex items-center gap-1.5 h-9 px-3 rounded-t-md text-sm font-medium transition-colors flex-shrink-0 ${
                isActive
                  ? "bg-bg-surface text-fg-primary border-b-2 border-brand"
                  : "text-fg-secondary hover:text-fg-primary hover:bg-bg-hover"
              }`}
            >
              <span className="max-w-40 truncate">{tab.name || t("tabs.untitled")}</span>
              {loadingTabs[tab.id] && (
                <Loader2 className="w-3 h-3 text-brand animate-spin shrink-0" />
              )}
              {dirtyTabs[tab.id] && !isActive && (
                <span className="w-[6px] h-[6px] rounded-full bg-accent-warning shrink-0" />
              )}
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
          title={`${t("tabs.newTab")} (${modKeyLabel}+T)`}
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
          <button onClick={() => { handleCloseTab(contextMenu.tabId); setContextMenu(null); }} className="w-full flex items-center h-7 px-3 text-sm text-fg-primary cursor-pointer hover:bg-bg-hover">{t("tabs.closeTab")}</button>
          <button onClick={() => { closeOtherTabs(contextMenu.tabId); setContextMenu(null); }} className="w-full flex items-center h-7 px-3 text-sm text-fg-primary cursor-pointer hover:bg-bg-hover">{t("tabs.closeOthers")}</button>
          <button onClick={() => { closeAllTabs(); setContextMenu(null); }} className="w-full flex items-center h-7 px-3 text-sm text-accent-danger cursor-pointer hover:bg-accent-danger/12">{t("tabs.closeAll")}</button>
        </div>
      )}
      <ConfirmDialog
        open={confirmClose !== null}
        onOpenChange={(open) => { if (!open) setConfirmClose(null); }}
        title={t("tabs.unsavedChanges")}
        description={t("tabs.unsavedMessage")}
        confirmLabel={t("tabs.dontSave")}
        cancelLabel={t("common.cancel")}
        secondaryLabel={t("common.save")}
        variant="warning"
        onConfirm={handleConfirmClose}
        onCancel={() => setConfirmClose(null)}
        onSecondary={handleSaveAndClose}
      />
      <ConfirmDialog
        open={confirmActiveConnection !== null}
        onOpenChange={(open) => { if (!open) setConfirmActiveConnection(null); }}
        title={t("tabs.activeConnections")}
        description={t("tabs.activeConnectionsMessage")}
        confirmLabel={t("tabs.forceClose")}
        cancelLabel={t("common.cancel")}
        variant="warning"
        onConfirm={handleConfirmConnectionClose}
        onCancel={() => setConfirmActiveConnection(null)}
      />
    </div>
  );
}
