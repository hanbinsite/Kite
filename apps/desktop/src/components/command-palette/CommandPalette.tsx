import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Command, FolderOpen, Variable } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CommandItem {
  id: string;
  label: string;
  category: "recent" | "action" | "ai" | "collection" | "variable";
  icon?: React.ReactNode;
  action: () => void;
  shortcut?: string;
  detail?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandItem[];
}

const CATEGORY_ORDER = ["recent", "collection", "variable", "action", "ai"] as const;

export function CommandPalette({ isOpen, onClose, items }: CommandPaletteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() =>
    items.filter((item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      (item.detail ?? "").toLowerCase().includes(query.toLowerCase()),
    ),
    [items, query],
  );

  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const cat of CATEGORY_ORDER) {
      groups[cat] = filteredItems.filter((i) => i.category === cat);
    }
    return groups;
  }, [filteredItems]);

  const flatItems = useMemo(() =>
    CATEGORY_ORDER.flatMap((cat) => groupedItems[cat]),
    [groupedItems],
  );

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const selectedEl = listRef.current?.children[selectedIndex] as HTMLElement;
    selectedEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          flatItems[selectedIndex]!.action();
          onClose();
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  };

  if (!isOpen) return null;

  let currentIndex = 0;

  const defaultIcon = (category: string) => {
    if (category === "collection") return <FolderOpen className="w-4 h-4" />;
    if (category === "variable") return <Variable className="w-4 h-4" />;
    return <Command className="w-4 h-4" />;
  };

  const renderGroup = (groupItems: CommandItem[], title: string) => {
    if (groupItems.length === 0) return null;
    const groupElements = groupItems.map((item) => {
      const itemIndex = currentIndex++;
      const isSelected = itemIndex === selectedIndex;
      return (
        <button
          key={item.id}
          onClick={() => {
            item.action();
            onClose();
          }}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
            isSelected ? "bg-brand-muted text-fg-primary" : "text-fg-secondary hover:bg-bg-hover"
          }`}
        >
          <span className="w-5 h-5 flex items-center justify-center text-fg-tertiary">
            {item.icon || defaultIcon(item.category)}
          </span>
          <span className="flex-1 text-left truncate">{item.label}</span>
          {item.detail && (
            <span className="text-[11px] text-fg-tertiary truncate max-w-[200px]">{item.detail}</span>
          )}
          {item.shortcut && (
            <span className="text-xs text-fg-tertiary font-mono">{item.shortcut}</span>
          )}
        </button>
      );
    });
    return (
      <div key={title}>
        <div className="px-4 py-1.5 text-xs font-medium text-fg-tertiary uppercase tracking-wider">
          {title}
        </div>
        {groupElements}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-command-palette">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className="absolute top-[20vh] left-1/2 -translate-x-1/2 w-[560px] max-w-[95vw] max-h-[480px] bg-bg-elevated border border-border-default rounded-xl shadow-xl overflow-hidden animate-cmd-slide-in">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border-muted">
          <Search className="w-5 h-5 text-fg-tertiary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("commandPalette.placeholder")}
            className="flex-1 bg-transparent text-sm text-fg-primary placeholder:text-fg-tertiary outline-none"
          />
          <span className="text-xs text-fg-tertiary px-1.5 py-0.5 bg-bg-hover rounded">ESC</span>
        </div>

        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-2">
          {flatItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-fg-tertiary">
              No results found for "{query}"
            </div>
          ) : (
            <>
              {CATEGORY_ORDER.map((cat) =>
                renderGroup(groupedItems[cat] ?? [], t(`commandPalette.categories.${cat}`)),
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export type { CommandItem };