import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCollectionStore, type CollectionTreeNode } from "../../stores/collection-store";
import { ConfigOverviewTab } from "./ConfigOverviewTab";
import { ConfigVariablesTab } from "./ConfigVariablesTab";
import { ConfigHeadersTab } from "./ConfigHeadersTab";
import { ConfigAuthTab } from "./ConfigAuthTab";
import { ConfigScriptsTab } from "./ConfigScriptsTab";

export type SubTab = "overview" | "variables" | "headers" | "auth" | "scripts";

interface CollectionConfigTabProps {
  collectionId: string;
  folderId?: string;
  initialSubTab?: SubTab;
}

export function CollectionConfigTab({ collectionId, folderId, initialSubTab }: CollectionConfigTabProps) {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(initialSubTab ?? "overview");
  const collections = useCollectionStore((s) => s.collections);

  const SUB_TABS: { key: SubTab; label: string }[] = [
    { key: "overview", label: t("collectionConfig.overview") },
    { key: "variables", label: t("collectionConfig.variables") },
    { key: "headers", label: t("collectionConfig.headers") },
    { key: "auth", label: t("collectionConfig.auth") },
    { key: "scripts", label: t("collectionConfig.scripts") },
  ];

  const collection = collections.find((c) => c.id === collectionId);
  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-fg-secondary text-[13px]">
        {t("collectionConfig.notFound")}
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
          {t("collectionConfig.folderNotFound")}
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
  items: CollectionTreeNode[],
  folderId: string,
): (CollectionTreeNode & { type: "folder" }) | null {
  for (const item of items) {
    if (item.type === "folder" && item.id === folderId) {
      return item;
    }
    if (item.type === "folder") {
      const result = findFolderInTree(item.items, folderId);
      if (result) return result;
    }
  }
  return null;
}
