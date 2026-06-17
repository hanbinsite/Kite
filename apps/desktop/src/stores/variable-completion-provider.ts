import { useEnvironmentStore } from "./environment-store";
import { useCollectionStore } from "./collection-store";
import { useTabStore } from "@api-client/core";
import { getCollectionVariables, getFolderVariables } from "@api-client/core";

function getActiveVariables(): Record<string, string> {
  const result: Record<string, string> = {};

  const envStore = useEnvironmentStore.getState();
  const colStore = useCollectionStore.getState();
  const tabStore = useTabStore.getState();

  const activeEnv = envStore.environments.find((e) => e.id === envStore.activeEnvironmentId);
  if (activeEnv) {
    for (const v of activeEnv.variables) {
      if (v.enabled && v.key) result[v.key] = v.value ?? "";
    }
  }

  for (const v of envStore.globals) {
    if (v.enabled && v.key) result[v.key] = v.value ?? "";
  }

  const activeTab = tabStore.tabs.find((t) => t.id === tabStore.activeTabId);
  if (activeTab?.requestId) {
    const hierarchy = colStore.resolveRequestHierarchy(activeTab.requestId);
    if (hierarchy?.collectionConfig?.variables) {
      for (const v of hierarchy.collectionConfig.variables) {
        if (v.enabled && v.key) result[v.key] = v.value ?? "";
      }
    }
    const collectionVars = hierarchy ? getCollectionVariables(hierarchy) : {};
    const folderVars = hierarchy ? getFolderVariables(hierarchy) : {};
    for (const [k, v] of Object.entries({ ...collectionVars, ...folderVars })) {
      if (k) result[k] = v;
    }
  }

  return result;
}

export function registerVariableCompletionProvider() {
  (window as unknown as Record<string, unknown>)["__envStore"] = { getActiveVariables };
}
