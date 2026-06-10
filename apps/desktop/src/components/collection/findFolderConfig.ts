import type { FolderConfig } from "@api-client/types";

type TreeNode = { type: string; id: string; config?: unknown; items?: TreeNode[] };

export function findFolderConfig(
  items: TreeNode[],
  folderId: string,
): FolderConfig | undefined {
  for (const item of items) {
    if (item.type === "folder" && item.id === folderId) return item.config as FolderConfig | undefined;
    if (item.type === "folder" && item.items) {
      const result = findFolderConfig(item.items, folderId);
      if (result) return result;
    }
  }
  return undefined;
}