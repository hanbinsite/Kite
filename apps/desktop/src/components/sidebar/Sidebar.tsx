import { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Settings,
  X,
  FileText,
} from "lucide-react";
import { useUIStore, useTabStore } from "@api-client/core";
import { useEnvironmentStore } from "../../stores/environment-store";
import { useCollectionStore, type CollectionTreeNode } from "../../stores/collection-store";
import { queryHistoryEntries } from "@api-client/core/http";
import type { HistoryEntry } from "@api-client/core/http";
import { ThemeToggle } from "./ThemeToggle";
import { ContextMenu } from "./ContextMenu";

interface ContextMenuState {
  x: number;
  y: number;
  target: { type: "collection" | "request" | "folder"; id: string; parentId?: string };
}

interface SidebarSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}

function SidebarSection({
  title,
  defaultOpen = false,
  children,
  action,
}: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border-muted">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1 px-3 h-7 hover:bg-bg-hover transition-colors text-xs font-semibold uppercase tracking-wider text-fg-secondary"
      >
        {isOpen ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <span className="flex-1 text-left">{title}</span>
        {action}
      </button>
      {isOpen && <div className="pb-2">{children}</div>}
    </div>
  );
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  PATCH: "text-method-patch",
  DELETE: "text-method-delete",
  HEAD: "text-method-head",
};

function getMethodColor(method: string) {
  return METHOD_COLORS[method.toUpperCase()] || "text-fg-secondary";
}

function findNodeInTree(items: CollectionTreeNode[], id: string): CollectionTreeNode | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.type === "folder") {
      const found = findNodeInTree(item.items, id);
      if (found) return found;
    }
  }
  return undefined;
}

interface CollectionTreeItemsProps {
  items: CollectionTreeNode[];
  collectionId: string;
  editingId: string | null;
  editingName: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  setEditingName: (name: string) => void;
  commitEdit: () => void;
  startEditing: (id: string, name: string) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  openTab: (tab: { name: string; method: string; url: string; requestId?: string }) => void;
  deleteRequest: (collectionId: string, requestId: string) => void;
  getMethodColor: (method: string) => string;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
}

function CollectionTreeItems({
  items,
  collectionId,
  editingId,
  editingName,
  editInputRef,
  setEditingName,
  commitEdit,
  startEditing,
  setContextMenu,
  openTab,
  deleteRequest,
  getMethodColor,
  expandedIds,
  toggleExpand,
}: CollectionTreeItemsProps) {
  return (
    <>
      {items.map((item) => {
        if (item.type === "folder") {
          const isFolderExpanded = expandedIds.has(item.id);
          return (
            <div key={item.id}>
              <div
                className="group flex items-center gap-1 px-3 py-0.5 text-[11px] hover:bg-bg-hover cursor-pointer"
                onClick={() => toggleExpand(item.id)}
                onDoubleClick={() => startEditing(item.id, item.name)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, target: { type: "collection", id: item.id } });
                }}
              >
                {isFolderExpanded ? (
                  <FolderOpen className="w-3 h-3 text-brand shrink-0" />
                ) : (
                  <Folder className="w-3 h-3 text-brand shrink-0" />
                )}
                {editingId === item.id ? (
                  <input
                    ref={editInputRef}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") {
                        startEditing("", "");
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-bg-input border border-border-focus rounded px-1 text-[11px] text-fg-primary outline-none"
                  />
                ) : (
                  <span className="flex-1 text-fg-secondary truncate">{item.name}</span>
                )}
              </div>
              {isFolderExpanded && item.items.length > 0 && (
                <div className="ml-4">
                  <CollectionTreeItems
                    items={item.items}
                    collectionId={collectionId}
                    editingId={editingId}
                    editingName={editingName}
                    editInputRef={editInputRef}
                    setEditingName={setEditingName}
                    commitEdit={commitEdit}
                    startEditing={startEditing}
                    setContextMenu={setContextMenu}
                    openTab={openTab}
                    deleteRequest={deleteRequest}
                    getMethodColor={getMethodColor}
                    expandedIds={expandedIds}
                    toggleExpand={toggleExpand}
                  />
                </div>
              )}
            </div>
          );
        }

        const isReqEditing = editingId === item.id;
        return (
          <div
            key={item.id}
            className="group flex items-center gap-2 px-3 py-0.5 text-[11px] hover:bg-bg-hover cursor-pointer font-mono"
            onClick={() =>
  openTab({
    name: item.name,
    method: item.method,
    url: item.url,
    requestId: item.id,
  })
}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, target: { type: "request", id: item.id, parentId: collectionId } });
            }}
          >
            {isReqEditing ? (
              <input
                ref={editInputRef}
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") {
                    startEditing("", "");
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 bg-bg-input border border-border-focus rounded px-1 text-[11px] text-fg-primary outline-none"
              />
            ) : (
              <>
                <span className={`font-semibold min-w-[32px] ${getMethodColor(item.method)}`}>
                  {item.method}
                </span>
                <FileText className="w-3 h-3 text-fg-tertiary shrink-0" />
                <span className="flex-1 text-fg-primary truncate">{item.name}</span>
              </>
            )}
            {!isReqEditing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteRequest(collectionId, item.id);
                }}
                className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-bg-hover rounded"
                title="Delete request"
              >
                <X className="w-3 h-3 text-fg-tertiary" />
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

export function Sidebar() {
  const openSettings = useUIStore((s) => s.openSettings);
  const activeEnvId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const environments = useEnvironmentStore((s) => s.environments);
  const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
  const loadEnvironments = useEnvironmentStore((s) => s.loadFromDisk);
  const openTab = useTabStore((s) => s.openTab);

  const collections = useCollectionStore((s) => s.collections);
  const addCollection = useCollectionStore((s) => s.addCollection);
  const deleteCollection = useCollectionStore((s) => s.deleteCollection);
  const renameCollection = useCollectionStore((s) => s.renameCollection);
const addRequestToCollection = useCollectionStore((s) => s.addRequestToCollection);
const addFolderToCollection = useCollectionStore((s) => s.addFolderToCollection);
const deleteRequest = useCollectionStore((s) => s.deleteRequest);
  const renameRequest = useCollectionStore((s) => s.renameRequest);
  const duplicateRequest = useCollectionStore((s) => s.duplicateRequest);
  const loadCollections = useCollectionStore((s) => s.loadFromDisk);

  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-context-menu]")) {
        setContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("mousedown", handleClose);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  useEffect(() => {
    loadCollections();
    loadEnvironments();
    queryHistoryEntries(50).then(setHistoryEntries).catch(() => {});
  }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddCollection = () => {
    const id = crypto.randomUUID();
    addCollection(id, "New Collection");
    setEditingId(id);
    setEditingName("New Collection");
  };

  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

const commitEdit = () => {
  if (editingId && editingName.trim()) {
    const trimmed = editingName.trim();
    const col = collections.find((c) => c.id === editingId);
    if (col) {
      renameCollection(editingId, trimmed);
    } else {
      for (const c of collections) {
        const found = findNodeInTree(c.items, editingId);
        if (found) {
          renameRequest(c.id, editingId, trimmed);
          break;
        }
      }
    }
  }
  setEditingId(null);
  setEditingName("");
};

  const handleAddRequest = (collectionId: string) => {
    const reqId = crypto.randomUUID();
    addRequestToCollection(collectionId, { id: reqId, method: "GET", name: "New Request", url: "" });
    setExpandedIds((prev) => new Set(prev).add(collectionId));
  };

  const handleContextMenuAction = (action: string, target: { type: "collection" | "request" | "folder"; id: string; parentId?: string }) => {
    setContextMenu(null);
    if (target.type === "collection") {
      const col = collections.find((c) => c.id === target.id);
      if (!col) return;
      switch (action) {
        case "rename":
          startEditing(target.id, col.name);
          break;
        case "add-request":
          handleAddRequest(target.id);
          break;
        case "add-folder": {
          const folderId = crypto.randomUUID();
          addFolderToCollection(target.id, folderId, "New Folder");
          setExpandedIds((prev) => new Set(prev).add(target.id));
          setEditingId(folderId);
          setEditingName("New Folder");
          break;
        }
        case "delete":
          deleteCollection(target.id);
          break;
      }
} else {
    switch (action) {
      case "rename": {
        for (const col of collections) {
          const found = findNodeInTree(col.items, target.id);
          if (found && found.type === "request") {
            startEditing(target.id, found.name);
            return;
          }
        }
        break;
      }
        case "duplicate": {
          const parentId = target.parentId;
          if (parentId) duplicateRequest(parentId, target.id);
          break;
        }
        case "delete": {
          const parentId = target.parentId;
          if (parentId) deleteRequest(parentId, target.id);
          break;
        }
      }
    }
  };

  const groupHistory = (entries: HistoryEntry[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const todayGroup: { label: string; items: HistoryEntry[] } = {
      label: "Today",
      items: [],
    };
    const yesterdayGroup: { label: string; items: HistoryEntry[] } = {
      label: "Yesterday",
      items: [],
    };
    const earlierGroup: { label: string; items: HistoryEntry[] } = {
      label: "Earlier",
      items: [],
    };
    for (const entry of entries) {
      const d = new Date(entry.created_at);
      if (d >= today) todayGroup.items.push(entry);
      else if (d >= yesterday) yesterdayGroup.items.push(entry);
      else earlierGroup.items.push(entry);
    }
    return [todayGroup, yesterdayGroup, earlierGroup].filter(
      (g) => g.items.length > 0
    );
  };

  return (
    <div className="h-full flex flex-col bg-bg-surface">
      <div className="flex items-center gap-2 px-3 h-11 border-b border-border-muted">
        <Search className="w-4 h-4 text-fg-tertiary" />
        <input
          type="text"
          placeholder="Search..."
          className="flex-1 bg-transparent text-sm text-fg-primary placeholder:text-fg-tertiary outline-none"
        />
        <button
          onClick={() => openTab({ name: "New Request", method: "GET", url: "" })}
          className="p-1 hover:bg-bg-hover rounded transition-colors"
        >
          <Plus className="w-4 h-4 text-fg-secondary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarSection
          title="Collections"
          defaultOpen
          action={
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddCollection();
              }}
              className="p-0.5 hover:bg-bg-hover rounded transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          }
        >
          {collections.map((col) => {
            const isExpanded = expandedIds.has(col.id);
            const isEditing = editingId === col.id;
            return (
              <div key={col.id}>
                <div
                  className="group flex items-center gap-1 px-3 py-1 text-sm hover:bg-bg-hover cursor-pointer"
                  onClick={() => toggleExpand(col.id)}
                  onDoubleClick={() => startEditing(col.id, col.name)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, target: { type: "collection", id: col.id } });
                  }}
                >
                  {isExpanded ? (
                    <FolderOpen className="w-4 h-4 text-brand shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 text-brand shrink-0" />
                  )}
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") {
                          setEditingId(null);
                          setEditingName("");
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-bg-input border border-border-focus rounded px-1 text-sm text-fg-primary outline-none"
                    />
                  ) : (
                    <span className="flex-1 text-fg-primary truncate">
                      {col.name}
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddRequest(col.id);
                      }}
                      className="p-0.5 hover:bg-bg-hover rounded"
                      title="Add request"
                    >
                      <Plus className="w-3 h-3 text-fg-tertiary" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCollection(col.id);
                      }}
                      className="p-0.5 hover:bg-bg-hover rounded"
                      title="Delete collection"
                    >
                      <X className="w-3 h-3 text-fg-tertiary" />
                    </button>
                  </div>
                </div>
{isExpanded && col.items.length > 0 && (
  <div className="ml-5">
    <CollectionTreeItems
      items={col.items}
      collectionId={col.id}
      editingId={editingId}
      editingName={editingName}
      editInputRef={editInputRef}
      setEditingName={setEditingName}
      commitEdit={commitEdit}
      startEditing={startEditing}
      setContextMenu={setContextMenu}
      openTab={openTab}
      deleteRequest={deleteRequest}
      getMethodColor={getMethodColor}
      expandedIds={expandedIds}
      toggleExpand={toggleExpand}
    />
  </div>
)}
{isExpanded && col.items.length === 0 && (
          <div className="ml-5 px-3 py-1 text-[10px] text-fg-tertiary">No requests</div>
        )}
      </div>
    );
  })}
</SidebarSection>

        <SidebarSection title="History">
          {historyEntries.length === 0 ? (
            <div className="px-3 py-2 text-xs text-fg-tertiary">No history yet</div>
          ) : (
            groupHistory(historyEntries).map((group) => (
              <div key={group.label}>
                <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg-tertiary">
                  {group.label}
                </div>
                {group.items.map((entry) => {
                  let urlPath: string;
                  try {
                    urlPath = new URL(entry.url).pathname;
                  } catch {
                    urlPath = entry.url;
                  }
                  return (
                    <button
                      key={entry.id}
                      onClick={() =>
                        openTab({
                          name: `${entry.method} ${urlPath}`,
                          method: entry.method,
                          url: entry.url,
                        })
                      }
                      className="w-full px-3 py-1 text-[11px] text-left hover:bg-bg-hover cursor-pointer flex items-center gap-2 font-mono"
                    >
                      <span
                        className={`font-semibold min-w-[32px] ${getMethodColor(entry.method)}`}
                      >
                        {entry.method}
                      </span>
                      <span className="text-fg-primary truncate flex-1">
                        {urlPath}
                      </span>
                      <span className="text-fg-tertiary text-[10px] font-sans shrink-0">
                        {entry.duration}ms
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </SidebarSection>

        <SidebarSection title="Environments">
          {environments.map((env) => (
            <button
              key={env.id}
              onClick={() => setActiveEnvironment(env.id)}
              className="w-full px-3 py-1 text-sm text-left hover:bg-bg-hover cursor-pointer flex items-center gap-2"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  env.id === activeEnvId ? "bg-brand" : "bg-fg-tertiary"
                }`}
              />
              <span
                className={
                  env.id === activeEnvId ? "text-fg-primary" : "text-fg-secondary"
                }
              >
                {env.name}
              </span>
            </button>
          ))}
        </SidebarSection>
      </div>

      <div className="h-10 border-t border-border-muted flex items-center justify-between px-3">
        <ThemeToggle />
        <button
          onClick={openSettings}
          className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4 text-fg-tertiary" />
        </button>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          target={contextMenu.target}
          onAction={handleContextMenuAction}
        />
      )}
    </div>
  );
}
