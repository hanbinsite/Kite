import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { i18n } from "../../i18n";
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
  Bot,
} from "lucide-react";
import { useUIStore, useTabStore, type Tab } from "@api-client/core";
import { useRequestStore } from "../../stores/request-store";
import { useCollectionStore, type CollectionTreeNode } from "../../stores/collection-store";
import { queryHistoryEntries, searchHistoryEntries, getCollection, type IpcCollectionItem } from "@api-client/core/http";
import type { HistoryEntry } from "@api-client/core/http";
import type { Header, QueryParam, BodyConfig, AuthConfig, RequestSettings, RawLanguage } from "@api-client/types";
import { ThemeToggle } from "./ThemeToggle";
import { ContextMenu } from "./ContextMenu";

interface ContextMenuState {
  x: number;
  y: number;
  target: { type: "collection" | "request" | "folder"; id: string; parentId?: string; collectionId?: string };
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
      <div className="w-full flex items-center gap-1 px-3 h-7 text-[13px] font-semibold uppercase tracking-wider text-fg-secondary">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 flex-1 hover:bg-bg-hover transition-colors -mx-3 px-3 h-7"
        >
          {isOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span className="flex-1 text-left">{title}</span>
        </button>
        {action}
      </div>
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

function filterTreeByQuery(items: CollectionTreeNode[], query: string): CollectionTreeNode[] {
  if (!query) return items;
  const lower = query.toLowerCase();
  return items.reduce<CollectionTreeNode[]>((acc, item) => {
    if (item.type === "request") {
      if (item.name.toLowerCase().includes(lower) || item.url.toLowerCase().includes(lower) || item.method.toLowerCase().includes(lower)) {
        acc.push(item);
      }
    } else if (item.type === "folder") {
      const filtered = filterTreeByQuery(item.items, query);
      if (filtered.length > 0 || item.name.toLowerCase().includes(lower)) {
        acc.push({ ...item, items: filtered.length > 0 ? filtered : item.items });
      }
    }
    return acc;
  }, []);
}

function countRequestItems(items: CollectionTreeNode[]): number {
  let count = 0;
  for (const item of items) {
    if (item.type === "request") {
      count++;
    } else if (item.type === "folder") {
      count += countRequestItems(item.items);
    }
  }
  return count;
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
  openTab: (tab: { name: string; method: string; url: string; requestId?: string; protocol?: Tab["protocol"]; meta?: Tab["meta"] }) => void;
  deleteRequest: (collectionId: string, requestId: string) => void;
  getMethodColor: (method: string) => string;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onLoadRequestData: (requestId: string, collectionId: string) => void;
  escapeCancelled: React.MutableRefObject<boolean>;
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
  onLoadRequestData,
  escapeCancelled,
}: CollectionTreeItemsProps) {
  return (
    <>
      {items.map((item) => {
        if (item.type === "folder") {
          const isFolderExpanded = expandedIds.has(item.id);
          return (
            <div
            key={item.id}
            role="treeitem"
            aria-expanded={isFolderExpanded}
          >
              <div
                className="group flex items-center gap-1 px-3 py-0.5 text-[13px] hover:bg-bg-hover cursor-pointer"
                onClick={() => toggleExpand(item.id)}
                onDoubleClick={() => startEditing(item.id, item.name)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, target: { type: "folder", id: item.id, collectionId } });
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
                        escapeCancelled.current = true;
                        startEditing("", "");
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-bg-input border border-border-focus rounded px-1 text-[13px] text-fg-primary outline-none"
                  />
                ) : (
                  <span className="flex-1 text-fg-secondary truncate">{item.name}</span>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openTab({
                        name: `⚙ ${item.name}`,
                        method: "",
                        url: "",
                        protocol: "collection-config",
                        meta: { collectionId, folderId: item.id },
                      });
                    }}
                    className="p-0.5 hover:bg-bg-hover rounded"
                    title={i18n.t("sidebar.folderSettings")}
                  >
                    <Settings className="w-3 h-3 text-fg-tertiary" />
                  </button>
                </div>
              </div>
              {isFolderExpanded && item.items.length > 0 && (
                <div className="ml-4" role="group">
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
                  onLoadRequestData={onLoadRequestData}
                  escapeCancelled={escapeCancelled}
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
            role="treeitem"
            className="group flex items-center gap-2 px-3 py-0.5 text-[13px] hover:bg-bg-hover cursor-pointer font-mono"
      onClick={() => {
        openTab({
          name: item.name,
          method: item.method,
          url: item.url,
          requestId: item.id,
        });
        onLoadRequestData(item.id, collectionId);
      }}
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
                    escapeCancelled.current = true;
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
                title={i18n.t("sidebar.deleteRequest")}
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
  const { t } = useTranslation();
  const openSettings = useUIStore((s) => s.openSettings);
  const toggleAiPanel = useUIStore((s) => s.toggleAiPanel);
  const openTab = useTabStore((s) => s.openTab);
  const initTabData = useRequestStore((s) => s.initTabData);

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
  const historyRefreshCounter = useRequestStore((s) => s.historyRefreshCounter);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const escapeCancelled = useRef(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMenuOpen, setNewMenuOpen] = useState(false);

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
    loadCollections().catch((e) => {
      console.error("Failed to load collections:", e);
    });
  }, [historyRefreshCounter]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      queryHistoryEntries(50).then(setHistoryEntries).catch((e) => console.error('Failed to query history entries:', e));
      return;
    }
    const timer = setTimeout(() => {
      searchHistoryEntries(searchQuery, 100).then(setHistoryEntries).catch((e) => console.error('Failed to search history:', e));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, historyRefreshCounter]);

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

  const handleLoadRequestData = (requestId: string, collectionId: string) => {
    getCollection(collectionId).then((file) => {
      const findItem = (items: IpcCollectionItem[]): IpcCollectionItem | undefined => {
        for (const item of items) {
          if (item.type === "request" && item.id === requestId) return item;
          if (item.type === "folder" && item.items) {
            const found = findItem(item.items);
            if (found) return found;
          }
        }
        return undefined;
      };
      const item = findItem(file.items);
      if (!item) return;
      const headers: Header[] = (item.headers ?? []).map((h) => ({
        key: h.key, value: h.value, disabled: h.disabled, description: h.description,
      }));
      const params: QueryParam[] = (item.params ?? []).map((p) => ({
        key: p.key, value: p.value, disabled: p.disabled, description: p.description,
      }));
      let body: BodyConfig | null = null;
      if (item.body && item.body.mode !== "none") {
        if (item.body.mode === "raw") {
          body = { mode: "raw", raw: { language: (item.body.language as RawLanguage) ?? "json", content: item.body.content ?? "" } };
        } else if (item.body.mode === "formdata") {
          body = { mode: "formdata", formdata: (item.body.formdata ?? []).map((f) => ({ key: f.key, value: f.value, type: (f.param_type === "file" ? "file" : "text") as "text" | "file", disabled: f.disabled })) };
        } else if (item.body.mode === "urlencoded") {
          body = { mode: "urlencoded", urlencoded: (item.body.urlencoded ?? []).map((u) => ({ key: u.key, value: u.value, disabled: u.disabled })) };
        } else if (item.body.mode === "graphql") {
          body = { mode: "graphql", graphql: { query: item.body.graphql_query ?? "", variables: item.body.graphql_variables ?? "" } };
        } else if (item.body.mode === "binary") {
          body = { mode: "binary", binary: item.body.content ?? "" };
        }
      }
      let auth: AuthConfig = { type: "none", config: {} };
      if (item.auth && item.auth.type) {
        const authType = item.auth.type as AuthConfig["type"];
        const authConfig = (item.auth.config ?? {}) as Record<string, unknown>;
        auth = { type: authType, config: authConfig } as AuthConfig;
      }
      let settings: RequestSettings = { timeoutMs: item.settings?.timeout_ms ?? 30000, followRedirects: item.settings?.follow_redirects ?? true, maxRedirects: item.settings?.max_redirects ?? 10, verifySsl: item.settings?.verify_ssl ?? true };
      const scripts = item.scripts ? { preRequest: item.scripts.pre_request, postResponse: item.scripts.post_response } : undefined;
      const tabId = useTabStore.getState().activeTabId;
      if (tabId) {
        initTabData(tabId, { headers, params, body, auth, settings, scripts });
      }
    }).catch((e) => console.error('Failed to load request data:', e));
  };

  const handleAddCollection = () => {
    const id = crypto.randomUUID();
    addCollection(id, t("sidebar.newCollection"));
    setEditingId(id);
    setEditingName(t("sidebar.newCollection"));
  };

  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

const commitEdit = () => {
    if (escapeCancelled.current) {
      escapeCancelled.current = false;
      return;
    }
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
    addRequestToCollection(collectionId, { id: reqId, method: "GET", name: t("sidebar.newRequest"), url: "" });
    setExpandedIds((prev) => new Set(prev).add(collectionId));
  };

  const handleContextMenuAction = (action: string, target: { type: "collection" | "request" | "folder"; id: string; parentId?: string; collectionId?: string }) => {
    setContextMenu(null);
    if (action === "settings") {
      if (target.type === "collection") {
        openTab({
          name: `⚙ ${collections.find((c) => c.id === target.id)?.name ?? t("settings.title")}`,
          method: "",
          url: "",
          protocol: "collection-config",
          meta: { collectionId: target.id },
        });
      } else if (target.type === "folder") {
        const colId = target.collectionId ?? target.parentId;
        if (colId) {
          openTab({
            name: `⚙ ${t("sidebar.folderSettings")}`,
            method: "",
            url: "",
            protocol: "collection-config",
            meta: { collectionId: colId, folderId: target.id },
          });
        }
      }
      return;
    }
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
          addFolderToCollection(target.id, folderId, t("sidebar.newFolder"));
          setExpandedIds((prev) => new Set(prev).add(target.id));
          setEditingId(folderId);
          setEditingName(t("sidebar.newFolder"));
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
      label: t("sidebar.today"),
      items: [],
    };
    const yesterdayGroup: { label: string; items: HistoryEntry[] } = {
      label: t("sidebar.yesterday"),
      items: [],
    };
    const earlierGroup: { label: string; items: HistoryEntry[] } = {
      label: t("sidebar.earlier"),
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
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("common.search")}
          className="flex-1 bg-transparent text-sm text-fg-primary placeholder:text-fg-tertiary outline-none"
        />
        <div className="relative">
          <button
            onClick={() => setNewMenuOpen(!newMenuOpen)}
            className="p-1 hover:bg-bg-hover rounded transition-colors"
            title={t("sidebar.newRequest")}
          >
            <Plus className="w-4 h-4 text-fg-secondary" />
          </button>
          {newMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNewMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-[180px] bg-bg-elevated border border-border-muted rounded-md shadow-lg py-1">
                <button
                  onClick={() => { openTab({ name: t("sidebar.newRequest"), method: "GET", url: "" }); setNewMenuOpen(false); }}
                  className="w-full px-3 py-1.5 text-left text-[13px] text-fg-primary hover:bg-bg-hover flex items-center gap-2"
                >
                  <span className="text-method-get font-mono text-[10px] w-8">GET</span>
                  {t("sidebar.newRequest")}
                </button>
                <div className="my-1 border-t border-border-muted" />
                <button onClick={() => { openTab({ name: "WebSocket", method: "GET", url: "ws://localhost:8080", protocol: "websocket" }); setNewMenuOpen(false); }} className="w-full px-3 py-1.5 text-left text-[13px] text-fg-primary hover:bg-bg-hover flex items-center gap-2">
                  <span className="text-brand font-mono text-[10px] w-8">WS</span>
                  WebSocket
                </button>
                <button onClick={() => { openTab({ name: "SSE", method: "GET", url: "https://example.com/events", protocol: "sse" }); setNewMenuOpen(false); }} className="w-full px-3 py-1.5 text-left text-[13px] text-fg-primary hover:bg-bg-hover flex items-center gap-2">
                  <span className="text-brand font-mono text-[10px] w-8">SSE</span>
                  Server-Sent Events
                </button>
                <button onClick={() => { openTab({ name: "MQTT", method: "GET", url: "mqtt://localhost:1883", protocol: "mqtt" }); setNewMenuOpen(false); }} className="w-full px-3 py-1.5 text-left text-[13px] text-fg-primary hover:bg-bg-hover flex items-center gap-2">
                  <span className="text-brand font-mono text-[10px] w-8">MQTT</span>
                  MQTT
                </button>
                <button onClick={() => { openTab({ name: "gRPC", method: "POST", url: "http://localhost:50051", protocol: "grpc" }); setNewMenuOpen(false); }} className="w-full px-3 py-1.5 text-left text-[13px] text-fg-primary hover:bg-bg-hover flex items-center gap-2">
                  <span className="text-brand font-mono text-[10px] w-8">gRPC</span>
                  gRPC
                </button>
                <button onClick={() => { openTab({ name: "Mock Server", method: "GET", url: "", protocol: "mock" }); setNewMenuOpen(false); }} className="w-full px-3 py-1.5 text-left text-[13px] text-fg-primary hover:bg-bg-hover flex items-center gap-2">
                  <span className="text-brand font-mono text-[10px] w-8">MOCK</span>
                  Mock Server
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
      <SidebarSection
        title={t("sidebar.collections")}
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
          const filteredItems = filterTreeByQuery(col.items, searchQuery);
          const showCollection = !searchQuery || filteredItems.length > 0 || col.name.toLowerCase().includes(searchQuery.toLowerCase());
          if (!showCollection) return null;
            return (
              <div key={col.id} role="treeitem" aria-expanded={isExpanded}>
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
                          escapeCancelled.current = true;
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
                        openTab({
                          name: `⚙ ${col.name}`,
                          method: "",
                          url: "",
                          protocol: "collection-config",
                          meta: { collectionId: col.id },
                        });
                      }}
                      className="p-0.5 hover:bg-bg-hover rounded"
                      title={t("sidebar.collectionSettings")}
                    >
                      <Settings className="w-3 h-3 text-fg-tertiary" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddRequest(col.id);
                      }}
                      className="p-0.5 hover:bg-bg-hover rounded"
                      title={t("sidebar.addRequest")}
                    >
                      <Plus className="w-3 h-3 text-fg-tertiary" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCollection(col.id);
                      }}
                      className="p-0.5 hover:bg-bg-hover rounded"
                      title={t("sidebar.deleteCollection")}
                    >
                      <X className="w-3 h-3 text-fg-tertiary" />
                    </button>
                  </div>
                </div>
        {isExpanded && col.items.length > 0 && (
          <div className="ml-5" role="group">
            <CollectionTreeItems
              items={searchQuery ? filteredItems : col.items}
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
                  onLoadRequestData={handleLoadRequestData}
                  escapeCancelled={escapeCancelled}
                />
            {(() => {
              const totalCount = countRequestItems(col.items);
              if (totalCount > 200) {
                return (
                  <div className="px-3 py-2 text-[11px] text-fg-tertiary italic border-t border-border-muted mt-1">
                    {t("sidebar.largeCollectionHint", { count: totalCount })}
                  </div>
                );
              }
              return null;
            })()}
  </div>
)}
{isExpanded && col.items.length === 0 && (
          <div className="ml-5 px-3 py-1 text-[12px] text-fg-tertiary">{t("sidebar.noRequests")}</div>
        )}
      </div>
    );
  })}
</SidebarSection>

      <SidebarSection title={t("sidebar.history")}>
        {(() => {
          const filteredHistory = historyEntries;
        return filteredHistory.length === 0 ? (
          <div className="px-3 py-2 text-[13px] text-fg-tertiary">{t("sidebar.noHistory")}</div>
        ) : (
          groupHistory(filteredHistory).map((group) => (
              <div key={group.label}>
                <div className="px-3 pt-1 pb-0.5 text-[12px] font-semibold uppercase tracking-wider text-fg-tertiary">
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
                      className="w-full px-3 py-1 text-[13px] text-left hover:bg-bg-hover cursor-pointer flex items-center gap-2 font-mono"
                    >
                      <span
                        className={`font-semibold min-w-[32px] ${getMethodColor(entry.method)}`}
                      >
                        {entry.method}
                      </span>
                      <span className="text-fg-primary truncate flex-1">
                        {urlPath}
                      </span>
                      <span className="text-fg-tertiary text-[12px] font-sans shrink-0">
                        {entry.duration}ms
                      </span>
                    </button>
);
})}
</div>
))
);
})()}
</SidebarSection>
      </div>

      <div className="h-10 border-t border-border-muted flex items-center justify-between px-3">
        <ThemeToggle />
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleAiPanel()}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors"
            title={t("ai.assistant")}
          >
            <Bot className="w-4 h-4 text-fg-tertiary" />
          </button>
          <button
            onClick={() => openSettings()}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors"
            title={t("settings.title")}
          >
            <Settings className="w-4 h-4 text-fg-tertiary" />
          </button>
        </div>
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
