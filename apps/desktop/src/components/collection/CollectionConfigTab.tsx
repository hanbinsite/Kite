import { useState } from "react";
import { useCollectionStore } from "../../stores/collection-store";
import { ConfigOverviewTab } from "./ConfigOverviewTab";
import { ConfigVariablesTab } from "./ConfigVariablesTab";
import { ConfigHeadersTab } from "./ConfigHeadersTab";
import { ConfigAuthTab } from "./ConfigAuthTab";
import { ConfigScriptsTab } from "./ConfigScriptsTab";

type SubTab = "overview" | "variables" | "headers" | "auth" | "scripts";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "variables", label: "Variables" },
  { key: "headers", label: "Headers" },
  { key: "auth", label: "Auth" },
  { key: "scripts", label: "Scripts" },
];

interface CollectionConfigTabProps {
  collectionId: string;
  folderId?: string;
}

export function CollectionConfigTab({ collectionId, folderId }: CollectionConfigTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("overview");
  const collections = useCollectionStore((s) => s.collections);

  const collection = collections.find((c) => c.id === collectionId);
  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-fg-secondary text-[13px]">
        Collection not found
      </div>
    );
  }

  let targetName: string;
  let targetConfig;
  if (folderId) {
    const folder = findFolderInTree(collection.items, folderId);
    if (!folder) {
      return (
        <div className="flex items-center justify-center h-full text-fg-secondary text-[13px]">
          Folder not found
        </div>
      );
    }
    targetName = folder.name;
    targetConfig = folder.config;
  } else {
    targetName = collection.name;
    targetConfig = collection.config;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-surface">
      <div className="flex items-center gap-1 px-3 pt-2 pb-0 border-b border-bg-elevated">
        <span className="text-[13px] font-medium text-fg-primary mr-2">⚙ {targetName}</span>
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`px-3 py-1.5 text-[12px] rounded-t transition-colors ${
              activeSubTab === tab.key
                ? "bg-bg-elevated text-fg-primary border-b-2 border-brand"
                : "text-fg-secondary hover:text-fg-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {activeSubTab === "overview" && (
          <ConfigOverviewTab
            collectionId={collectionId}
            folderId={folderId}
            name={targetName}
            description={folderId ? findFolderInTree(collection.items, folderId)?.description : collection.description}
            config={targetConfig}
          />
        )}
        {activeSubTab === "variables" && (
          <ConfigVariablesTab
            collectionId={collectionId}
            folderId={folderId}
            variables={targetConfig?.variables}
          />
        )}
        {activeSubTab === "headers" && (
          <ConfigHeadersTab
            collectionId={collectionId}
            folderId={folderId}
            headers={targetConfig?.headers}
          />
        )}
        {activeSubTab === "auth" && (
          <ConfigAuthTab
            collectionId={collectionId}
            folderId={folderId}
            auth={targetConfig?.auth}
          />
        )}
        {activeSubTab === "scripts" && (
          <ConfigScriptsTab
            collectionId={collectionId}
            folderId={folderId}
            scripts={targetConfig?.scripts}
            isFolder={!!folderId}
          />
        )}
      </div>
    </div>
  );
}

function findFolderInTree(
  items: Array<{ type: string; id: string; name: string; description?: string; config?: unknown; items?: unknown[] }>,
  folderId: string,
): { name: string; description?: string; config?: unknown } | null {
  for (const item of items) {
    if (item.type === "folder" && item.id === folderId) {
      return item;
    }
    if (item.type === "folder" && item.items) {
      const result = findFolderInTree(item.items as Array<{ type: string; id: string; name: string; description?: string; config?: unknown; items?: unknown[] }>, folderId);
      if (result) return result;
    }
  }
  return null;
}
