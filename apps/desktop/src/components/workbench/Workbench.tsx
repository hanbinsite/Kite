import { useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { UrlBar } from "../url-bar";
import { TabBar } from "../tab";
import { HomePage } from "./HomePage";
import { RequestPanel } from "./RequestPanel";
import { ResponsePanel } from "./ResponsePanel";
import { SplitPane } from "../layout/SplitPane";
import { useTabStore, useUIStore } from "@api-client/core";
import { ErrorBoundary } from "@api-client/ui";
import { useRequestStore } from "../../stores";
import { CollectionConfigTab, type SubTab } from "../collection/CollectionConfigTab";

const WebSocketPanel = lazy(() => import("../protocol").then((m) => ({ default: m.WebSocketPanel })));
const SsePanel = lazy(() => import("../protocol").then((m) => ({ default: m.SsePanel })));
const MqttPanel = lazy(() => import("../protocol").then((m) => ({ default: m.MqttPanel })));
const GrpcPanel = lazy(() => import("../protocol").then((m) => ({ default: m.GrpcPanel })));
const MockPanel = lazy(() => import("../protocol").then((m) => ({ default: m.MockPanel })));
const ProxyPanel = lazy(() => import("../protocol").then((m) => ({ default: m.ProxyPanel })));

function ProtocolPanelFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-5 h-5 border-2 border-border-default border-t-brand rounded-full animate-spin" />
    </div>
  );
}

export function Workbench() {
  const { t } = useTranslation();
  const activeTabId = useTabStore((s) => s.activeTabId);
  const activeTab = useTabStore((s) => s.tabs.find((tab) => tab.id === s.activeTabId));
  const splitRatio = useUIStore((s) => s.splitRatio);
  const setSplitRatio = useUIStore((s) => s.setSplitRatio);
  const switchTab = useRequestStore((s) => s.switchTab);

  useEffect(() => {
    if (activeTabId && activeTab?.protocol !== "collection-config") {
      switchTab(activeTabId);
    }
  }, [activeTabId, activeTab?.protocol, switchTab]);

  if (!activeTabId) {
    return <HomePage />;
  }

  const protocol = activeTab?.protocol ?? "http";

  if (protocol === "collection-config" && activeTab) {
    return (
      <div className="h-full flex flex-col">
        <TabBar />
        <CollectionConfigTab
          collectionId={activeTab.meta?.collectionId ?? ""}
          folderId={activeTab.meta?.folderId}
          initialSubTab={activeTab.meta?.initialSubTab as SubTab | undefined}
        />
      </div>
    );
  }

  if (protocol !== "http") {
    return (
      <div className="flex-1 flex flex-col">
        <TabBar />
        <ErrorBoundary fallback={({ error: err, resetError }) => (
          <div className="flex items-center justify-center h-full text-accent-danger text-[13px]">
            <span>{t("errors.protocolPanelCrashed", { message: err.message })}</span>
            <button onClick={resetError} className="ml-2 text-brand underline">{t("common.retry")}</button>
          </div>
        )}>
          <ProtocolWorkbench protocol={protocol} tabId={activeTabId} t={t} />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <TabBar />
      <UrlBar />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <SplitPane
            top={<RequestPanel />}
            bottom={<ResponsePanel />}
            initialRatio={splitRatio}
            onRatioChange={setSplitRatio}
          />
        </div>
      </div>
    </div>
  );
}

function ProtocolWorkbench({ protocol, tabId, t }: { protocol: string; tabId: string; t: (key: string, options?: Record<string, unknown>) => string }) {
  const panel = (() => {
    switch (protocol) {
      case "websocket": return <WebSocketPanel connectionId={tabId} />;
      case "sse": return <SsePanel connectionId={tabId} />;
      case "mqtt": return <MqttPanel connectionId={tabId} />;
      case "grpc": return <GrpcPanel connectionId={tabId} />;
      case "mock": return <MockPanel />;
      case "proxy": return <ProxyPanel />;
      default: return (
        <div className="flex items-center justify-center h-full text-fg-tertiary text-[13px]">
          {t("errors.unknownProtocol", { protocol })}
        </div>
      );
    }
  })();
  return <Suspense fallback={<ProtocolPanelFallback />}>{panel}</Suspense>;
}