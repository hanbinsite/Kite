import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface ConsoleEntry {
  id: string;
  tabId: string;
  level: "log" | "warn" | "error" | "info";
  message: string;
  timestamp: number;
  source?: "pre-request" | "post-response" | "system";
}

export interface ConsoleState {
  entries: Record<string, ConsoleEntry[]>;
}

export interface ConsoleActions {
  addEntry: (tabId: string, entry: Omit<ConsoleEntry, "id" | "tabId" | "timestamp">) => void;
  clearEntries: (tabId: string) => void;
  getEntries: (tabId: string) => ConsoleEntry[];
}

export type ConsoleStore = ConsoleState & ConsoleActions;

export const useConsoleStore = create<ConsoleStore>()(
  immer((set, get) => ({
    entries: {},

    addEntry: (tabId, entry) =>
      set((state) => {
        if (!state.entries[tabId]) state.entries[tabId] = [];
        state.entries[tabId].push({
          ...entry,
          id: crypto.randomUUID(),
          tabId,
          timestamp: Date.now(),
        });
      }),

    clearEntries: (tabId) =>
      set((state) => {
        state.entries[tabId] = [];
      }),

    getEntries: (tabId) => get().entries[tabId] ?? [],
  })),
);
