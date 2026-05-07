import { useState } from "react";
import { useCollectionStore } from "../../stores/collection-store";
import type { Variable, CollectionConfig, FolderConfig } from "@api-client/types";

interface ConfigVariablesTabProps {
  collectionId: string;
  folderId?: string;
  variables?: Variable[];
}

export function ConfigVariablesTab({ collectionId, folderId, variables }: ConfigVariablesTabProps) {
  const [items, setItems] = useState<Variable[]>(variables ?? []);
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

  const persist = (newVariables: Variable[]) => {
    const currentConfig = getCurrentConfig() ?? {};
    const updated = { ...currentConfig, variables: newVariables };
    if (folderId) {
      updateFolderConfig(collectionId, folderId, updated as FolderConfig);
    } else {
      updateCollectionConfig(collectionId, updated as CollectionConfig);
    }
    setItems(newVariables);
  };

  const handleAdd = () => {
    const newItem: Variable = { key: "", value: "", enabled: true };
    persist([...items, newItem]);
  };

  const handleRemove = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    persist(newItems);
  };

  const handleChange = (index: number, field: keyof Variable, value: string | boolean) => {
    const newItems = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    persist(newItems);
  };

  const handleBulkImport = (text: string) => {
    const lines = text.split("\n").filter((l) => l.trim());
    const imported: Variable[] = lines.map((line) => {
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) return { key: line.trim(), value: "", enabled: true };
      return { key: line.substring(0, eqIdx).trim(), value: line.substring(eqIdx + 1).trim(), enabled: true };
    });
    const merged = [...items];
    for (const v of imported) {
      const existingIdx = merged.findIndex((m) => m.key === v.key);
      if (existingIdx >= 0) {
        const existing = merged[existingIdx];
        if (existing) merged[existingIdx] = { ...existing, value: v.value };
      } else {
        merged.push(v);
      }
    }
    persist(merged);
  };

  return (
    <div className="max-w-[700px]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] text-fg-secondary">{items.length} variable{items.length !== 1 ? "s" : ""}</div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const text = prompt("Paste KEY=VALUE per line:");
              if (text) handleBulkImport(text);
            }}
            className="text-[12px] px-2.5 py-1 rounded bg-bg-elevated text-fg-secondary hover:text-fg-primary transition-colors"
          >
            Bulk Import
          </button>
          <button
            onClick={handleAdd}
            className="text-[12px] px-2.5 py-1 rounded bg-brand text-white hover:bg-brand/80 transition-colors"
          >
            + Add Variable
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={item.enabled}
              onChange={(e) => handleChange(index, "enabled", e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-brand"
            />
            <input
              type="text"
              value={item.key}
              onChange={(e) => handleChange(index, "key", e.target.value)}
              placeholder="Key"
              className="flex-1 bg-bg-elevated text-fg-primary text-[13px] px-2 py-1.5 rounded border border-transparent focus:border-brand focus:outline-none"
            />
            <input
              type="text"
              value={item.value}
              onChange={(e) => handleChange(index, "value", e.target.value)}
              placeholder="Value"
              className="flex-1 bg-bg-elevated text-fg-primary text-[13px] px-2 py-1.5 rounded border border-transparent focus:border-brand focus:outline-none"
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
            No variables configured. Click "+ Add Variable" to get started.
          </div>
        )}
      </div>
    </div>
  );
}

function findFolderConfig(items: Array<{ type: string; id: string; config?: unknown; items?: unknown[] }>, folderId: string): FolderConfig | undefined {
  for (const item of items) {
    if (item.type === "folder" && item.id === folderId) {
      return item.config as FolderConfig | undefined;
    }
    if (item.type === "folder" && item.items) {
      const result = findFolderConfig(item.items as Array<{ type: string; id: string; config?: unknown; items?: unknown[] }>, folderId);
      if (result) return result;
    }
  }
  return undefined;
}
