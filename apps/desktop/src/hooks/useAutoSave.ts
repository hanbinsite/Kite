import { useEffect, useRef } from "react";
import { useRequestStore } from "../stores";
import { useCollectionStore } from "../stores/collection-store";
import type { RequestData } from "../stores/request-store";
import type { AuthConfig, BodyConfig } from "@api-client/types";
import type { CollectionTreeNode } from "../stores/collection-store";

const AUTOSAVE_DELAY = 500;

function findRequestInTree(
  items: CollectionTreeNode[],
  requestId: string,
): CollectionTreeNode | null {
  for (const item of items) {
    if (item.type === "request" && item.id === requestId) return item;
    if (item.type === "folder") {
      const found = findRequestInTree(item.items, requestId);
      if (found) return found;
    }
  }
  return null;
}

function bodyToCollectionBody(body: BodyConfig | null): BodyConfig | undefined {
  if (!body || body.mode === "none") return undefined;
  return body;
}

function authToCollectionAuth(auth: AuthConfig): AuthConfig | undefined {
  if (auth.type === "none") return undefined;
  return auth;
}

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  const currentTabId = useRequestStore((s) => s.currentTabId);
  const requestDataMap = useRequestStore((s) => s.requestDataMap);

  useEffect(() => {
    if (!currentTabId) return;

    const data = requestDataMap[currentTabId];
    if (!data) return;

    const snapshot = JSON.stringify(data);
    if (snapshot === lastSavedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      lastSavedRef.current = snapshot;
      autoSaveToCollection(currentTabId, data);
    }, AUTOSAVE_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentTabId, requestDataMap]);
}

function autoSaveToCollection(tabId: string, data: RequestData) {
  const store = useCollectionStore.getState();
  for (const col of store.collections) {
    const existing = findRequestInTree(col.items, tabId);
    if (existing && existing.type === "request") {
      existing.method = data.headers.length > 0 ? "GET" : existing.method;
      existing.auth = authToCollectionAuth(data.auth);
      existing.body = bodyToCollectionBody(data.body);
      store.persistCollection(col.id);
      return;
    }
  }
}
