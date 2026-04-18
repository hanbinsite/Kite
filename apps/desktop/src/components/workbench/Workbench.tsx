import { UrlBar } from "../url-bar";
import { TabBar } from "../tab";
import { HomePage } from "./HomePage";
import { RequestPanel } from "./RequestPanel";
import { ResponsePanel } from "./ResponsePanel";
import { SplitPane } from "../layout/SplitPane";
import { useTabStore, useUIStore } from "@api-client/core";

export function Workbench() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const splitRatio = useUIStore((s) => s.splitRatio);
  const setSplitRatio = useUIStore((s) => s.setSplitRatio);

  if (!activeTabId) {
    return <HomePage />;
  }

  return (
    <div className="flex-1 flex flex-col">
      <TabBar />
      <UrlBar />
      <SplitPane
        top={<RequestPanel />}
        bottom={<ResponsePanel />}
        initialRatio={splitRatio}
        onRatioChange={setSplitRatio}
      />
    </div>
  );
}
