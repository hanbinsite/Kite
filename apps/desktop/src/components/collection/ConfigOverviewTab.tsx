import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCollectionStore } from "../../stores/collection-store";
import type { CollectionConfig, FolderConfig } from "@api-client/types";

interface ConfigOverviewTabProps {
  collectionId: string;
  folderId?: string;
  name: string;
  description?: string;
  config?: CollectionConfig | FolderConfig;
}

export function ConfigOverviewTab({ collectionId, folderId, name, description, config }: ConfigOverviewTabProps) {
  const { t } = useTranslation();
  const [localName, setLocalName] = useState(name);
  const [localDesc, setLocalDesc] = useState(description ?? "");
  const updateCollectionConfig = useCollectionStore((s) => s.updateCollectionConfig);
  const updateFolderConfig = useCollectionStore((s) => s.updateFolderConfig);
  const renameCollection = useCollectionStore((s) => s.renameCollection);

  const handleSaveName = () => {
    if (localName.trim() && localName !== name) {
      if (!folderId) {
        renameCollection(collectionId, localName.trim());
      }
    }
  };

  const handleSaveDescription = () => {
    const newConfig: CollectionConfig | FolderConfig = {
      ...config,
      headers: config?.headers,
      auth: config?.auth,
      variables: config?.variables,
      scripts: config?.scripts,
    };
    if (folderId) {
      updateFolderConfig(collectionId, folderId, newConfig as FolderConfig);
    } else {
      updateCollectionConfig(collectionId, newConfig as CollectionConfig);
    }
  };

  const variableCount = config?.variables?.length ?? 0;
  const headerCount = config?.headers?.length ?? 0;
  const hasPreScript = !!config?.scripts?.preRequest?.trim();
  const hasPostScript = !!config?.scripts?.postResponse?.trim();

  return (
    <div className="max-w-[600px] space-y-4">
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">{t("common.name")}</label>
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleSaveName}
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">{t("common.description")}</label>
        <textarea
          value={localDesc}
          onChange={(e) => setLocalDesc(e.target.value)}
          onBlur={handleSaveDescription}
          rows={3}
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="bg-bg-elevated rounded p-3">
          <div className="text-[11px] text-fg-secondary">{t("common.variables")}</div>
          <div className="text-[18px] font-semibold text-fg-primary mt-1">{variableCount}</div>
        </div>
        <div className="bg-bg-elevated rounded p-3">
          <div className="text-[11px] text-fg-secondary">{t("request.headers")}</div>
          <div className="text-[18px] font-semibold text-fg-primary mt-1">{headerCount}</div>
        </div>
        <div className="bg-bg-elevated rounded p-3">
          <div className="text-[11px] text-fg-secondary">{t("scripts.preRequest")}</div>
          <div className="text-[13px] mt-1 text-fg-primary">{hasPreScript ? t("collectionConfig.configured") : t("collectionConfig.none")}</div>
        </div>
        <div className="bg-bg-elevated rounded p-3">
          <div className="text-[11px] text-fg-secondary">{t("scripts.postResponse")}</div>
          <div className="text-[13px] mt-1 text-fg-primary">{hasPostScript ? t("collectionConfig.configured") : t("collectionConfig.none")}</div>
        </div>
      </div>
    </div>
  );
}