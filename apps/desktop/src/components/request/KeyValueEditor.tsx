import { useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

interface KeyValueEditorProps {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
  placeholder?: { key: string; value: string };
}

export function KeyValueEditor({
  items,
  onChange,
  placeholder = { key: "Key", value: "Value" },
}: KeyValueEditorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const updateItem = useCallback(
    (id: string, updates: Partial<KeyValue>) => {
      onChange(items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    },
    [items, onChange],
  );

  const addItem = useCallback(() => {
    onChange([...items, { id: crypto.randomUUID(), key: "", value: "", enabled: true }]);
  }, [items, onChange]);

  const deleteItem = useCallback(
    (id: string) => {
      onChange(items.filter((item) => item.id !== id));
    },
    [items, onChange],
  );

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[20px_1fr_1fr_auto] gap-2 px-3 py-2 text-xs font-medium text-fg-tertiary uppercase tracking-wider">
        <span></span>
        <span>{placeholder.key}</span>
        <span>{placeholder.value}</span>
        <span></span>
      </div>

      {items.length === 0 && (
        <div className="px-3 py-6 text-center text-sm text-fg-tertiary">No items added yet</div>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          onMouseEnter={() => setHoveredId(item.id)}
          onMouseLeave={() => setHoveredId(null)}
          className={`grid grid-cols-[20px_1fr_1fr_auto] gap-2 items-center px-3 py-1.5 rounded transition-colors ${
            !item.enabled ? "opacity-40" : "hover:bg-bg-hover"
          }`}
        >
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={(e) => updateItem(item.id, { enabled: e.target.checked })}
            className="w-4 h-4 rounded border-border-default bg-bg-input accent-brand cursor-pointer"
          />
          <input
            type="text"
            value={item.key}
            onChange={(e) => updateItem(item.id, { key: e.target.value })}
            placeholder={placeholder.key}
            className="h-7 px-2 bg-transparent border border-transparent rounded text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-border-focus transition-colors"
          />
          <input
            type="text"
            value={item.value}
            onChange={(e) => updateItem(item.id, { value: e.target.value })}
            placeholder={placeholder.value}
            className="h-7 px-2 bg-transparent border border-transparent rounded text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-border-focus transition-colors"
          />
          <button
            onClick={() => deleteItem(item.id)}
            className={`p-1 rounded transition-all ${
              hoveredId === item.id ? "bg-accent-danger/20 text-accent-danger" : "text-transparent"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <button
        onClick={addItem}
        className="w-full py-2 text-sm text-fg-secondary hover:text-brand transition-colors flex items-center justify-center gap-1"
      >
        <Plus className="w-4 h-4" />
        Add Row
      </button>
    </div>
  );
}
