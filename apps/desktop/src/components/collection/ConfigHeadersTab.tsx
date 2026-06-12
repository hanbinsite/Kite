import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCollectionStore } from "../../stores/collection-store";
import type { Header, CollectionConfig, FolderConfig } from "@api-client/types";
import { findFolderConfig } from "./findFolderConfig";

interface ConfigHeadersTabProps {
  collectionId: string;
  folderId?: string;
  headers?: Header[];
}

export function ConfigHeadersTab({ collectionId, folderId, headers }: ConfigHeadersTabProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Header[]>(headers ?? []);
  const updateCollectionConfig = useCollectionStore((s) => s.updateCollectionConfig);
  const updateFolderConfig = useCollectionStore((s) => s.updateFolderConfig);
  const collections = useCollectionStore((s) => s.collections);

  const getCurrentConfig = (): CollectionConfig | FolderConfig | undefined => {
    const col = collections.find((c) => c.id === collectionId);
    if (!col) return undefined;
    if (folderId) {
      return findFolderConfig(col.items, folderId);
    }
    return col.config;
  };

  const persist = (newHeaders: Header[]) => {
    const currentConfig = getCurrentConfig() ?? {};
    const updated = { ...currentConfig, headers: newHeaders };
    if (folderId) {
      updateFolderConfig(collectionId, folderId, updated as FolderConfig);
    } else {
      updateCollectionConfig(collectionId, updated as CollectionConfig);
    }
    setItems(newHeaders);
  };

  const handleAdd = () => {
    const newHeader: Header = { key: "", value: "", disabled: false };
    persist([...items, newHeader]);
  };

  const handleRemove = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    persist(newItems);
  };

  const handleChange = (index: number, field: keyof Header, value: string | boolean) => {
    const newItems = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    persist(newItems);
  };

  return (
    <div className="max-w-[700px]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] text-fg-secondary">{t("collectionConfig.headerCount", { count: items.length })}</div>
        <button
          onClick={handleAdd}
          className="text-[12px] px-2.5 py-1 rounded bg-brand text-white hover:bg-brand/80 transition-colors"
        >
          {t("collectionConfig.addHeader")}
        </button>
      </div>

      <div className="space-y-1">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={!item.disabled}
              onChange={(e) => handleChange(index, "disabled", !e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-brand"
            />
            <input
              type="text"
              value={item.key}
              onChange={(e) => handleChange(index, "key", e.target.value)}
              placeholder={t("common.keyPlaceholder")}
              className="flex-1 bg-bg-elevated text-fg-primary text-[13px] px-2 py-1.5 rounded border border-transparent focus:border-brand focus:outline-none"
            />
            <input
              type="text"
              value={item.value}
              onChange={(e) => handleChange(index, "value", e.target.value)}
              placeholder={t("common.valuePlaceholder")}
              className="flex-1 bg-bg-elevated text-fg-primary text-[13px] px-2 py-1.5 rounded border border-transparent focus:border-brand focus:outline-none"
            />
            <input
              type="text"
              value={item.description ?? ""}
              onChange={(e) => handleChange(index, "description", e.target.value)}
              placeholder={t("common.description")}
              className="w-[140px] bg-bg-elevated text-fg-secondary text-[13px] px-2 py-1.5 rounded border border-transparent focus:border-brand focus:outline-none"
            />
            <button
              onClick={() => handleRemove(index)}
              className="text-fg-secondary hover:text-accent-danger opacity-0 group-hover:opacity-100 transition-opacity text-[12px] px-1"
            >
              ✕
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-[12px] text-fg-secondary text-center py-8">
            {t("collectionConfig.noHeaders", { context: folderId ? "folder" : "collection" })}
          </div>
        )}
      </div>
    </div>
  );
}
