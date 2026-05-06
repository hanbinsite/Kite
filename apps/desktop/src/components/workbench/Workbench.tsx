import { useEffect } from "react";
import { UrlBar } from "../url-bar";
import { TabBar } from "../tab";
import { HomePage } from "./HomePage";
import { RequestPanel } from "./RequestPanel";
import { ResponsePanel } from "./ResponsePanel";
import { SplitPane } from "../layout/SplitPane";
import { useTabStore, useUIStore } from "@api-client/core";
import { useRequestStore } from "../../stores";
import { WebSocketPanel, SsePanel, MqttPanel, GrpcPanel, MockPanel } from "../protocol";
import { CollectionConfigTab } from "../collection/CollectionConfigTab";

export function Workbench() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const splitRatio = useUIStore((s) => s.splitRatio);
  const setSplitRatio = useUIStore((s) => s.setSplitRatio);
  const switchTab = useRequestStore((s) => s.switchTab);

  useEffect(() => {
    if (activeTabId && activeTab?.protocol !== "collection-config") {
      switchTab(activeTabId);
    }
  }, [activeTabId]);

  if (!activeTabId) {
    return <HomePage />;
  }

  const protocol = activeTab?.protocol ?? "http";

  if (protocol === "collection-config") {
    return (
      <div className="h-full flex flex-col">
        <TabBar />
        <CollectionConfigTab
          collectionId={activeTab.meta?.collectionId ?? ""}
          folderId={activeTab.meta?.folderId}
        />
      </div>
    );
  }

  if (protocol !== "http") {
    return (
      <div className="flex-1 flex flex-col">
        <TabBar />
        <ProtocolWorkbench protocol={protocol} tabId={activeTabId} />
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

function ProtocolWorkbench({ protocol, tabId }: { protocol: string; tabId: string }) {
  switch (protocol) {
    case "websocket":
      return <WebSocketPanel connectionId={tabId} />;
    case "sse":
      return <SsePanel connectionId={tabId} />;
    case "mqtt":
      return <MqttPanel connectionId={tabId} />;
    case "grpc":
      return <GrpcPanel connectionId={tabId} />;
    case "mock":
      return <MockPanel />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-fg-tertiary text-[13px]">
          Unknown protocol: {protocol}
        </div>
      );
  }
}