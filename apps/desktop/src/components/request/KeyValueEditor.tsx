import { useState, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Check } from "lucide-react";

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
  showDescription?: boolean;
}

export function KeyValueEditor({
  items,
  onChange,
  placeholder,
  showDescription = true,
}: KeyValueEditorProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? { key: t("request.key"), value: t("common.value") };
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const emptyRowIdRef = useRef(crypto.randomUUID());

  const rowsWithEmpty = useMemo(() => {
    const last = items[items.length - 1];
    if (last && (last.key || last.value)) {
      return [...items, { id: emptyRowIdRef.current, key: "", value: "", enabled: true, description: "" }];
    }
    if (items.length === 0) {
      return [{ id: emptyRowIdRef.current, key: "", value: "", enabled: true, description: "" }];
    }
    return items;
  }, [items]);

  const updateItem = useCallback(
    (id: string, updates: Partial<KeyValue>) => {
      const idx = rowsWithEmpty.findIndex((item) => item.id === id);
      if (idx === -1) return;
      let updated = [...rowsWithEmpty];
      updated[idx] = { ...updated[idx]!, ...updates };
      if (id === emptyRowIdRef.current) {
        const changedItem = updated[idx];
        if (changedItem?.key || changedItem?.value) {
          emptyRowIdRef.current = crypto.randomUUID();
        }
      }
      onChange(updated.filter((item, i) => item.key || item.value || i === updated.length - 1));
    },
    [rowsWithEmpty, onChange],
  );

  const deleteItem = useCallback(
    (id: string) => {
      if (id === emptyRowIdRef.current) {
        emptyRowIdRef.current = crypto.randomUUID();
      }
      onChange(rowsWithEmpty.filter((item) => item.id !== id));
    },
    [rowsWithEmpty, onChange],
  );

  const addItem = useCallback(() => {
    onChange([...items, { id: crypto.randomUUID(), key: "", value: "", enabled: true, description: "" }]);
  }, [items, onChange]);

  const displayItems = rowsWithEmpty;

  const gridCols = showDescription
    ? "grid-cols-[20px_200px_1fr_180px_28px]"
    : "grid-cols-[20px_200px_1fr_28px]";

  return (
    <div className="kv-editor flex flex-col h-full overflow-hidden">
      <div
        className={`kv-editor-header grid ${gridCols} h-[28px] px-3 items-center border-b border-border-muted text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em] shrink-0`}
      >
        <span />
        <span>{resolvedPlaceholder.key}</span>
        <span>{resolvedPlaceholder.value}</span>
        {showDescription && <span>{t("common.description")}</span>}
        <span />
      </div>

      <div className="kv-editor-body flex-1 overflow-y-auto px-3 min-h-0">
        {displayItems.map((item) => (
          <div
            key={item.id}
            onMouseEnter={() => setHoveredRowId(item.id)}
            onMouseLeave={() => setHoveredRowId(null)}
            className={`kv-row grid ${gridCols} h-[32px] items-center border-b border-border-muted transition-colors duration-50 ${
              !item.enabled ? "disabled opacity-40" : ""
            } ${hoveredRowId === item.id && item.enabled ? "bg-bg-hover" : ""}`}
          >
            <div
              onClick={() => updateItem(item.id, { enabled: !item.enabled })}
              className={`kv-row-checkbox w-[14px] h-[14px] rounded-[4px] border-[1.5px] cursor-pointer flex items-center justify-center transition-all duration-50 ${
                item.enabled
                  ? "checked bg-brand border-brand"
                  : "border-border-default bg-transparent"
              }`}
            >
              {item.enabled && <Check size={9} className="text-white font-bold" strokeWidth={3} />}
            </div>

            <div className={`kv-row-key h-full flex items-center px-2 ${!item.enabled ? "line-through" : ""}`}>
              <input
                type="text"
                value={item.key}
                onChange={(e) => updateItem(item.id, { key: e.target.value })}
                placeholder={resolvedPlaceholder.key}
                className="w-full border-none outline-none bg-transparent font-mono text-[12px] text-fg-primary leading-[16px] placeholder:text-fg-tertiary"
              />
            </div>

            <div className={`kv-row-value h-full flex items-center px-2 ${!item.enabled ? "line-through" : ""}`}>
              <input
                type="text"
                value={item.value}
                onChange={(e) => updateItem(item.id, { value: e.target.value })}
                placeholder={resolvedPlaceholder.value}
                className="w-full border-none outline-none bg-transparent font-mono text-[12px] text-fg-primary leading-[16px] placeholder:text-fg-tertiary"
              />
            </div>

            {showDescription && (
              <div className={`kv-row-desc h-full flex items-center px-2 ${!item.enabled ? "line-through" : ""}`}>
                <input
                  type="text"
                  value={item.description ?? ""}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  placeholder={t("common.description")}
                  className="w-full border-none outline-none bg-transparent font-sans text-[12px] text-fg-secondary leading-[16px] placeholder:text-fg-tertiary"
                />
              </div>
            )}

            <button
              onClick={() => deleteItem(item.id)}
              className={`kv-row-delete w-[24px] h-[24px] rounded-[4px] flex items-center justify-center cursor-pointer transition-all duration-50 ${
                hoveredRowId === item.id
                  ? "opacity-100 hover:bg-accent-danger/12 hover:text-accent-danger text-fg-tertiary"
                  : "opacity-0"
              }`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addItem}
        className="kv-editor-add flex items-center gap-[6px] h-[32px] px-3 font-sans text-[12px] text-fg-tertiary cursor-pointer transition-all duration-50 hover:text-brand hover:bg-brand-muted shrink-0"
      >
        <Plus size={14} />
        {t("request.addRow")}
      </button>
    </div>
  );
}