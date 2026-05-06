import { Pencil, Plus, FolderPlus, Copy, Trash2, Settings } from "lucide-react";

interface ContextMenuTarget {
  type: "collection" | "request" | "folder";
  id: string;
  parentId?: string;
}

interface ContextMenuProps {
  x: number;
  y: number;
  target: ContextMenuTarget;
  onAction: (action: string, target: ContextMenuTarget) => void;
}

const COLLECTION_ITEMS = [
  { action: "settings", label: "Settings", icon: Settings },
  { action: "rename", label: "Rename", icon: Pencil },
  { action: "add-request", label: "Add Request", icon: Plus },
  { action: "add-folder", label: "Add Folder", icon: FolderPlus },
  { action: "duplicate", label: "Duplicate", icon: Copy },
  { action: "delete", label: "Delete", icon: Trash2 },
];

const REQUEST_ITEMS = [
  { action: "rename", label: "Rename", icon: Pencil },
  { action: "duplicate", label: "Duplicate", icon: Copy },
  { action: "delete", label: "Delete", icon: Trash2 },
];

const FOLDER_ITEMS = [
  { action: "settings", label: "Settings", icon: Settings },
  { action: "rename", label: "Rename", icon: Pencil },
  { action: "add-request", label: "Add Request", icon: Plus },
  { action: "add-folder", label: "Add Folder", icon: FolderPlus },
  { action: "delete", label: "Delete", icon: Trash2 },
];

export function ContextMenu({ x, y, target, onAction }: ContextMenuProps) {
  const items =
    target.type === "collection"
      ? COLLECTION_ITEMS
      : target.type === "folder"
        ? FOLDER_ITEMS
        : REQUEST_ITEMS;

  const adjustedX = Math.min(x, window.innerWidth - 180);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 32 - 16);

  return (
    <div
      data-context-menu
      className="fixed bg-bg-elevated border border-border-default rounded-lg shadow-lg py-1 z-[9999] min-w-[160px] animate-fade-in"
      style={{ left: adjustedX, top: adjustedY }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.action}
          onClick={() => onAction(item.action, target)}
          className={`w-full flex items-center gap-2 h-7 px-3 text-sm cursor-pointer transition-colors ${
            item.action === "delete"
              ? "text-accent-danger hover:bg-accent-danger/12"
              : "text-fg-primary hover:bg-bg-hover"
          }`}
        >
          <item.icon className="w-3.5 h-3.5" />
          {item.label}
        </button>
      ))}
    </div>
  );
}