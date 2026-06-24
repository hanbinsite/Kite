import { useEffect, useRef, useCallback } from "react";
import { useRequestStore } from "../stores";
import { useCollectionStore } from "../stores/collection-store";
import { useTabStore } from "@api-client/core";
import { toast } from "@api-client/ui";
import { i18n } from "../i18n";
import type { RequestData } from "../stores/request-store";
import type { AuthConfig, BodyConfig, Header, QueryParam, ScriptConfig } from "@api-client/types";
import type { CollectionTreeNode } from "../stores/collection-store";

const AUTOSAVE_DELAY = 1000;

function bodyToCollectionBody(body: BodyConfig | null): BodyConfig | undefined {
  if (!body || body.mode === "none") return undefined;
  return body;
}

function authToCollectionAuth(auth: AuthConfig): AuthConfig | undefined {
  if (auth.type === "none") return undefined;
  return auth;
}

function headersToCollection(headers: Header[]): Header[] | undefined {
  if (headers.length === 0) return undefined;
  return headers;
}

function paramsToCollection(params: QueryParam[]): QueryParam[] | undefined {
  if (params.length === 0) return undefined;
  return params;
}

function scriptsToCollection(scripts: ScriptConfig | null): ScriptConfig | undefined {
  if (!scripts) return undefined;
  if (!scripts.preRequest && !scripts.postResponse) return undefined;
  return scripts;
}

function findCollectionIdByRequestId(items: { type: string; id: string; items?: unknown[] }[], requestId: string): boolean {
  for (const item of items) {
    if (item.type === "request" && item.id === requestId) return true;
    if (item.type === "folder" && Array.isArray(item.items)) {
      if (findCollectionIdByRequestId(item.items as { type: string; id: string; items?: unknown[] }[], requestId)) return true;
    }
  }
  return false;
}

function updateRequestInDraft(
  items: CollectionTreeNode[],
  requestId: string,
  updates: { method?: string; url?: string; headers?: Header[]; params?: QueryParam[]; body?: BodyConfig; auth?: AuthConfig; scripts?: ScriptConfig },
): boolean {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (item.type === "request" && item.id === requestId) {
      const updated = { ...item };
      if (updates.method !== undefined) updated.method = updates.method;
      if (updates.url !== undefined) updated.url = updates.url;
      if (updates.headers !== undefined) updated.headers = updates.headers;
      if (updates.params !== undefined) updated.params = updates.params;
      if (updates.body !== undefined) updated.body = updates.body;
      if (updates.auth !== undefined) updated.auth = updates.auth;
      if (updates.scripts !== undefined) updated.scripts = updates.scripts;
      items[i] = updated as CollectionTreeNode;
      return true;
    }
    if (item.type === "folder") {
      if (updateRequestInDraft(item.items, requestId, updates)) return true;
    }
  }
  return false;
}

function saveRequestToCollection(tabId: string, data: RequestData): boolean {
  const colStore = useCollectionStore.getState();
  const tabStore = useTabStore.getState();
  const tab = tabStore.tabs.find((t) => t.id === tabId);
  const requestId = tab?.requestId;
  if (!requestId) return false;

  const colId = colStore.collections.find((col) =>
    findCollectionIdByRequestId(col.items, requestId)
  )?.id;
  if (!colId) return false;

  const updates = {
    method: tab?.method,
    url: tab?.url,
    headers: headersToCollection(data.headers),
    params: paramsToCollection(data.params),
    body: bodyToCollectionBody(data.body),
    auth: authToCollectionAuth(data.auth),
    scripts: scriptsToCollection(data.scripts ?? null),
  };

  useCollectionStore.setState((state) => {
    const col = state.collections.find((c) => c.id === colId);
    if (col) {
      updateRequestInDraft(col.items, requestId, updates);
    }
  });

  useCollectionStore.getState().persistCollection(colId);
  return true;
}

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  const currentTabId = useRequestStore((s) => s.currentTabId);
  const currentTabData = useRequestStore((s) => s.currentTabId ? s.requestDataMap[s.currentTabId] : null);
  const tabs = useTabStore((s) => s.tabs);
  const activeTab = tabs.find((t) => t.id === currentTabId);
  const tabUrl = activeTab?.url ?? "";
  const tabMethod = activeTab?.method ?? "";

  useEffect(() => {
    if (!currentTabId) return;

    const data = currentTabData;
    if (!data) return;

    const snapshot = JSON.stringify({ ...data, _url: tabUrl, _method: tabMethod });
    if (snapshot === lastSavedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      lastSavedRef.current = snapshot;
      saveRequestToCollection(currentTabId, data);
    }, AUTOSAVE_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentTabId, currentTabData, tabUrl, tabMethod]);
}

export function saveCurrentRequest(tabIdOverride?: string): boolean {
  const tabStore = useTabStore.getState();
  const requestStore = useRequestStore.getState();
  const targetTabId = tabIdOverride ?? tabStore.activeTabId;
  const t = i18n.t.bind(i18n);
  if (!targetTabId) {
    try { toast({ variant: "error", title: t("errors.saveFailed"), description: t("errors.noActiveTab"), duration: 3000 }); } catch(e) { console.error("toast error", e); }
    return false;
  }

  const tab = tabStore.tabs.find((t) => t.id === targetTabId);
  if (!tab?.requestId) {
    try { toast({ variant: "warning", title: t("errors.cannotSave"), description: t("errors.notInCollection"), duration: 3000 }); } catch(e) { console.error("toast error", e); }
    return false;
  }

  const data = requestStore.requestDataMap[targetTabId];
  if (!data) {
    try { toast({ variant: "error", title: t("errors.saveFailed"), description: t("errors.noRequestData"), duration: 3000 }); } catch(e) { console.error("toast error", e); }
    return false;
  }

  const saved = saveRequestToCollection(targetTabId, data);
  try {
    if (saved) {
      toast({ variant: "success", title: t("common.save"), description: tab.name || t("common.request"), duration: 2000 });
    } else {
      toast({ variant: "error", title: t("errors.saveFailed"), description: t("errors.requestNotFound"), duration: 3000 });
    }
  } catch(e) { console.error("toast error", e); }
  return saved;
}

export function useSaveShortcut() {
  const handleSave = useCallback((e: KeyboardEvent) => {
    const isMeta = e.metaKey || e.ctrlKey;
    if (e.key.toLowerCase() === "s" && isMeta) {
      e.preventDefault();
      const saved = saveCurrentRequest();
      if (saved) {
        const tabStore = useTabStore.getState();
        const requestStore = useRequestStore.getState();
        if (tabStore.activeTabId) {
          requestStore.clearDirty(tabStore.activeTabId);
        }
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleSave);
    return () => window.removeEventListener("keydown", handleSave);
  }, [handleSave]);
}
