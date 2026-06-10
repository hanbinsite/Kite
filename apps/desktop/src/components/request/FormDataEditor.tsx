import { useRef, useCallback, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Check, FileText, Type } from "lucide-react";
import type { FormDataParam } from "@api-client/types";

export interface FormDataItem {
  id: string;
  key: string;
  value: string;
  type: "text" | "file";
  fileName?: string;
  contentType?: string;
  disabled: boolean;
  description?: string;
}

interface FormDataEditorProps {
  items: FormDataParam[];
  onChange: (items: FormDataParam[]) => void;
}

interface FormDataItemWithId extends FormDataItem {
  id: string;
}

function paramToItem(id: string, p: FormDataParam): FormDataItemWithId {
  return {
    id,
    key: p.key,
    value: p.value,
    type: p.type,
    contentType: p.contentType,
    disabled: p.disabled,
    description: p.description,
  };
}

function itemToParam(item: FormDataItem): FormDataParam {
  return {
    key: item.key,
    value: item.value,
    type: item.type,
    contentType: item.contentType,
    disabled: item.disabled,
    description: item.description,
  };
}

export function FormDataEditor({ items, onChange }: FormDataEditorProps) {
  const { t } = useTranslation();
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const emptyRowIdRef = useRef(crypto.randomUUID());
  const idMapRef = useRef<Record<number, string>>({});

  const formItems: FormDataItemWithId[] = useMemo(() =>
    items.map((p, i) => {
      const id = idMapRef.current[i] ?? (idMapRef.current[i] = crypto.randomUUID());
      return paramToItem(id, p);
    }),
    [items]
  );

  const rowsWithEmpty = useMemo(() => {
    const last = formItems[formItems.length - 1];
    if (last && (last.key || last.value)) {
      return [...formItems, { id: emptyRowIdRef.current, key: "", value: "", type: "text" as const, disabled: false }];
    }
    if (formItems.length === 0) {
      return [{ id: emptyRowIdRef.current, key: "", value: "", type: "text" as const, disabled: false }];
    }
    return formItems;
  }, [formItems]);

  const updateItem = useCallback(
    (id: string, updates: Partial<FormDataItem>) => {
      const updated = rowsWithEmpty.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      );
      onChange(
        updated
          .filter((item) => item.key || item.value || item.id === emptyRowIdRef.current)
          .map(itemToParam),
      );
    },
    [rowsWithEmpty, onChange],
  );

  const deleteItem = useCallback(
    (id: string) => {
      onChange(rowsWithEmpty.filter((item) => item.id !== id).map(itemToParam));
    },
    [rowsWithEmpty, onChange],
  );

  const handleFileSelect = useCallback(
    (id: string) => {
      setActiveFileId(id);
      fileInputRef.current?.click();
    },
    [],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && activeFileId) {
        updateItem(activeFileId, {
          value: file.name,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          type: "file",
        });
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActiveFileId(null);
    },
    [activeFileId, updateItem],
  );

  return (
    <div className="formdata-editor flex flex-col h-full overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onFileChange}
      />
      <div className="formdata-header grid grid-cols-[20px_160px_80px_1fr_28px] h-[28px] px-3 items-center border-b border-border-muted text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em]">
        <span />
        <span>{t("request.key")}</span>
        <span>{t("common.type")}</span>
        <span>{t("common.value")}</span>
        <span />
      </div>

      <div className="formdata-body flex-1 overflow-y-auto px-3">
        {rowsWithEmpty.map((item) => (
          <div
            key={item.id}
            onMouseEnter={() => setHoveredRowId(item.id)}
            onMouseLeave={() => setHoveredRowId(null)}
            className={`formdata-row grid grid-cols-[20px_160px_80px_1fr_28px] h-[32px] items-center border-b border-border-muted transition-colors duration-50 ${
              !item.disabled ? "" : "opacity-40"
            } ${hoveredRowId === item.id && !item.disabled ? "bg-bg-hover" : ""}`}
          >
            <div
              onClick={() => updateItem(item.id, { disabled: !item.disabled })}
              className={`w-[14px] h-[14px] rounded-[4px] border-[1.5px] cursor-pointer flex items-center justify-center transition-all duration-50 ${
                !item.disabled
                  ? "bg-brand border-brand"
                  : "border-border-default bg-transparent"
              }`}
            >
              {!item.disabled && <Check size={9} className="text-white" strokeWidth={3} />}
            </div>

            <div className="h-full flex items-center px-1">
              <input
                type="text"
                value={item.key}
                onChange={(e) => updateItem(item.id, { key: e.target.value })}
                placeholder={t("request.key")}
                className="w-full border-none outline-none bg-transparent font-mono text-[12px] text-fg-primary leading-[16px] placeholder:text-fg-tertiary"
              />
            </div>

            <div className="h-full flex items-center px-1">
              <button
                onClick={() =>
                  updateItem(item.id, {
                    type: item.type === "text" ? "file" : "text",
                    value: item.type === "text" ? "" : item.value,
                  })
                }
                className={`flex items-center gap-[4px] h-[22px] px-[6px] rounded-[4px] font-sans text-[11px] font-medium cursor-pointer transition-all duration-50 ${
                  item.type === "file"
                    ? "text-accent-info bg-accent-info/10"
                    : "text-fg-secondary bg-bg-hover"
                }`}
              >
                {item.type === "file" ? (
                  <FileText size={11} />
                ) : (
                  <Type size={11} />
                )}
                {item.type === "file" ? t("request.file") : t("request.text")}
              </button>
            </div>

            <div className="h-full flex items-center px-1">
              {item.type === "file" ? (
                <div
                  onClick={() => handleFileSelect(item.id)}
                  className="w-full h-[24px] flex items-center gap-[6px] px-[8px] rounded-[4px] bg-bg-input border border-border-muted cursor-pointer hover:border-border-focus transition-colors"
                >
                  {item.fileName ? (
                    <>
                      <FileText size={12} className="text-accent-info shrink-0" />
                      <span className="font-mono text-[11px] text-fg-primary truncate">{item.fileName}</span>
                    </>
                  ) : (
                    <span className="font-sans text-[11px] text-fg-tertiary">{t("request.selectFile")}</span>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => updateItem(item.id, { value: e.target.value })}
                  placeholder={t("common.value")}
                  className="w-full border-none outline-none bg-transparent font-mono text-[12px] text-fg-primary leading-[16px] placeholder:text-fg-tertiary"
                />
              )}
            </div>

            <button
              onClick={() => deleteItem(item.id)}
              className={`w-[24px] h-[24px] rounded-[4px] flex items-center justify-center cursor-pointer transition-all duration-50 ${
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
        onClick={() =>
          onChange([
            ...rowsWithEmpty.map(itemToParam),
            { key: "", value: "", type: "text", disabled: false },
          ])
        }
        className="flex items-center gap-[6px] h-[32px] px-3 font-sans text-[12px] text-fg-tertiary cursor-pointer transition-all duration-50 hover:text-brand hover:bg-brand-muted"
      >
        <Plus size={14} />
        {t("request.addField")}
      </button>
    </div>
  );
}