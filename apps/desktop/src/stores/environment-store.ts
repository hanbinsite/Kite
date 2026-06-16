import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Environment, Variable } from "@api-client/types";
import {
  listEnvironments,
  getEnvironment,
  saveEnvironment,
  deleteEnvironment as deleteEnvironmentIpc,
  type IpcEnvironmentFile,
} from "@api-client/core/http";
import { useCollectionStore } from "./collection-store";
import { useTabStore } from "@api-client/core";

export interface EnvironmentState {
  environments: Environment[];
  activeEnvironmentId: string | null;
  globals: Variable[];
  isLoaded: boolean;
}

export interface EnvironmentActions {
  setActiveEnvironment: (id: string | null) => void;
  addEnvironment: (env: Environment) => void;
  updateEnvironment: (id: string, updates: Partial<Environment>) => void;
  deleteEnvironment: (id: string) => void;
  setGlobalVariable: (key: string, value: string) => void;
  getVariable: (key: string) => string | undefined;
  loadFromDisk: () => Promise<void>;
  persistEnvironment: (id: string) => void;
  persistAll: () => void;
}

export type EnvironmentStore = EnvironmentState & EnvironmentActions;

function toIpcEnv(env: Environment): IpcEnvironmentFile {
  return {
    id: env.id,
    name: env.name,
    variables: env.variables.map((v) => ({ key: v.key, value: v.value, enabled: v.enabled })),
    env_type: env.envType,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

const DEFAULT_ENVS: Environment[] = [
  {
    id: "env-dev",
    name: "Development",
    variables: [],
    isActive: false,
    envType: "dev",
  },
  {
    id: "env-staging",
    name: "Staging",
    variables: [],
    isActive: false,
    envType: "staging",
  },
  {
    id: "env-prod",
    name: "Production",
    variables: [],
    isActive: false,
    envType: "production",
  },
];

export const useEnvironmentStore = create<EnvironmentStore>()(
  immer((set, get) => ({
    environments: [],
    activeEnvironmentId: localStorage.getItem("activeEnvironmentId") || null,
    globals: [
      { key: "timestamp", value: "", enabled: true },
      { key: "guid", value: "", enabled: true },
    ],
    isLoaded: false,

    setActiveEnvironment: (id) => {
      set({ activeEnvironmentId: id });
      localStorage.setItem("activeEnvironmentId", id || "");
    },

    addEnvironment: (env) => {
      set((state) => {
        state.environments.push(env);
      });
      saveEnvironment(toIpcEnv(env)).catch((e) => {
        console.error(`Failed to save environment "${env.name}":`, e);
      });
    },

    updateEnvironment: (id, updates) => {
      set((state) => {
        const idx = state.environments.findIndex((e) => e.id === id);
        if (idx !== -1 && state.environments[idx]) {
          Object.assign(state.environments[idx], updates);
        }
      });
      const env = get().environments.find((e) => e.id === id);
      if (env) {
        saveEnvironment(toIpcEnv(env)).catch((e) => {
          console.error(`Failed to persist environment "${env.name}" (${id}):`, e);
        });
      }
    },

    deleteEnvironment: (id) => {
      set((state) => {
        state.environments = state.environments.filter((e) => e.id !== id);
        if (state.activeEnvironmentId === id) state.activeEnvironmentId = null;
      });
      deleteEnvironmentIpc(id).catch((e) => {
        console.error(`Failed to delete environment ${id}:`, e);
      });
    },

    setGlobalVariable: (key, value) =>
      set((state) => {
        const existing = state.globals.find((v) => v.key === key);
        if (existing) {
          existing.value = value;
        } else {
          state.globals.push({ key, value, enabled: true });
        }
      }),

    getVariable: (key) => {
      const state = get();
      const globalVar = state.globals.find((v) => v.key === key && v.enabled);
      if (globalVar) return globalVar.value;

      if (state.activeEnvironmentId) {
        const env = state.environments.find((e) => e.id === state.activeEnvironmentId);
        if (env) {
          const envVar = env.variables.find((v) => v.key === key && v.enabled);
          if (envVar) return envVar.value;
        }
      }

      try {
        const activeTab = useTabStore.getState().tabs.find((t) => t.id === useTabStore.getState().activeTabId);
        const requestId = activeTab?.requestId;
        if (requestId) {
          const hierarchy = useCollectionStore.getState().resolveRequestHierarchy(requestId);
          if (hierarchy) {
            for (let i = hierarchy.folderPath.length - 1; i >= 0; i--) {
              const folderVars = hierarchy.folderPath[i]?.config?.variables;
              if (folderVars) {
                const found = folderVars.find((v) => v.key === key && v.enabled);
                if (found) return found.value;
              }
            }
            if (hierarchy.collectionConfig?.variables) {
              const found = hierarchy.collectionConfig.variables.find((v) => v.key === key && v.enabled);
              if (found) return found.value;
            }
          }
        }
      } catch (e) {
        console.error("Failed to resolve collection variable:", e);
      }

      return undefined;
    },

    loadFromDisk: async () => {
      if (get().isLoaded) return;
      try {
        const summaries = await listEnvironments();
        if (summaries.length === 0) {
          set({ environments: DEFAULT_ENVS, isLoaded: true });
          for (const env of DEFAULT_ENVS) {
            saveEnvironment(toIpcEnv(env)).catch((e) => console.error('Failed to save default environment:', e));
          }
          return;
        }
        const envs: Environment[] = [];
        for (const s of summaries) {
          try {
      const file = await getEnvironment(s.id);
      envs.push({
        id: file.id,
        name: file.name,
        variables: file.variables.map((v) => ({ key: v.key, value: v.value, enabled: v.enabled })),
        isActive: false,
        envType: (file.env_type as Environment["envType"]) ?? undefined,
      });
          } catch {
            // skip broken env files
          }
        }
        set({ environments: envs.length > 0 ? envs : DEFAULT_ENVS, isLoaded: true });
      } catch {
        set({ environments: DEFAULT_ENVS, isLoaded: true });
        for (const env of DEFAULT_ENVS) {
          saveEnvironment(toIpcEnv(env)).catch((e) => console.error('Failed to save default environment:', e));
        }
      }
    },

    persistEnvironment: (id) => {
      const state = get();
      const env = state.environments.find((e) => e.id === id);
      if (env) {
        saveEnvironment(toIpcEnv(env)).catch((e) => {
          console.error(`Failed to persist environment "${env.name}" (${id}):`, e);
        });
      }
    },

    persistAll: () => {
      const state = get();
      for (const env of state.environments) {
        saveEnvironment(toIpcEnv(env)).catch((e) => {
          console.error(`Failed to persist environment "${env.name}" (${env.id}):`, e);
        });
      }
    },
  })),
);
