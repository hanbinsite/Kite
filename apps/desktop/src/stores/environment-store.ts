import { create } from "zustand";
import type { Environment, Variable } from "@api-client/types";

export interface EnvironmentState {
  environments: Environment[];
  activeEnvironmentId: string | null;
  globals: Variable[];
}

export interface EnvironmentActions {
  setActiveEnvironment: (id: string | null) => void;
  addEnvironment: (env: Environment) => void;
  updateEnvironment: (id: string, updates: Partial<Environment>) => void;
  deleteEnvironment: (id: string) => void;
  setGlobalVariable: (key: string, value: string) => void;
  getVariable: (key: string) => string | undefined;
}

export type EnvironmentStore = EnvironmentState & EnvironmentActions;

const defaultEnvironments: Environment[] = [
  {
    id: "env-dev",
    name: "Development",
    variables: [
      { key: "base_url", value: "http://localhost:3000", enabled: true },
      { key: "api_key", value: "dev-key-123", enabled: true },
    ],
    isActive: false,
  },
  {
    id: "env-staging",
    name: "Staging",
    variables: [
      { key: "base_url", value: "https://staging.api.example.com", enabled: true },
      { key: "api_key", value: "staging-key-456", enabled: true },
    ],
    isActive: false,
  },
  {
    id: "env-prod",
    name: "Production",
    variables: [
      { key: "base_url", value: "https://api.example.com", enabled: true },
      { key: "api_key", value: "", enabled: false },
    ],
    isActive: false,
  },
];

export const useEnvironmentStore = create<EnvironmentStore>()((set, get) => ({
  environments: defaultEnvironments,
  activeEnvironmentId: null,
  globals: [
    { key: "timestamp", value: "", enabled: true },
    { key: "guid", value: "", enabled: true },
  ],

  setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),

  addEnvironment: (env) => set((state) => ({ environments: [...state.environments, env] })),

  updateEnvironment: (id, updates) =>
    set((state) => ({
      environments: state.environments.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  deleteEnvironment: (id) =>
    set((state) => ({
      environments: state.environments.filter((e) => e.id !== id),
      activeEnvironmentId: state.activeEnvironmentId === id ? null : state.activeEnvironmentId,
    })),

  setGlobalVariable: (key, value) =>
    set((state) => {
      const existing = state.globals.find((v) => v.key === key);
      if (existing) {
        return {
          globals: state.globals.map((v) => (v.key === key ? { ...v, value } : v)),
        };
      }
      return { globals: [...state.globals, { key, value, enabled: true }] };
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
    return undefined;
  },
}));
