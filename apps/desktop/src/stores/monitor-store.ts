import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { sendHttpRequest } from "@api-client/core/http";
import type { HttpResponse } from "@api-client/types";
import type { IpcHttpRequestConfig } from "@api-client/core/http";
import { buildIpcBodyConfig, buildIpcSettings, buildIpcAuth } from "./request-store";
import { useTabStore } from "@api-client/core";
import type { Header, QueryParam, BodyConfig, RequestSettings, AuthConfig } from "@api-client/types";

export interface MonitorConfig {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Header[];
  params: QueryParam[];
  body: BodyConfig | null;
  auth: AuthConfig | null;
  settings: RequestSettings | null;
  intervalMs: number;
  enabled: boolean;
}

export interface MonitorResult {
  monitorId: string;
  timestamp: number;
  status: number;
  duration: number;
  success: boolean;
  error?: string;
}

interface MonitorState {
  monitors: MonitorConfig[];
  results: Record<string, MonitorResult[]>;
  timers: Record<string, ReturnType<typeof setInterval>>;
  activeMonitorId: string | null;
}

interface MonitorActions {
  addMonitor: (config: Omit<MonitorConfig, "id" | "enabled">) => void;
  removeMonitor: (id: string) => void;
  toggleMonitor: (id: string) => void;
  updateMonitor: (id: string, updates: Partial<MonitorConfig>) => void;
  clearResults: (id: string) => void;
  stopAll: () => void;
}

function buildConfig(monitor: MonitorConfig): IpcHttpRequestConfig {
  const tabStore = useTabStore.getState();
  const id = tabStore.activeTabId ?? `monitor-${monitor.id}`;
  return {
    id,
    method: monitor.method,
    url: monitor.url,
    headers: monitor.headers,
    params: monitor.params,
    body: monitor.body ? buildIpcBodyConfig(monitor.body) : null,
    auth: monitor.auth ? buildIpcAuth(monitor.auth) : null,
    settings: buildIpcSettings(monitor.settings ?? { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, verifySsl: true }),
  };
}

async function executeMonitor(monitor: MonitorConfig, set: (fn: (state: MonitorState) => void) => void) {
  const start = Date.now();
  try {
    const config = buildConfig(monitor);
    const response: HttpResponse = await sendHttpRequest(config);
    const result: MonitorResult = {
      monitorId: monitor.id,
      timestamp: start,
      status: response.status,
      duration: response.time,
      success: response.status >= 200 && response.status < 400,
    };
    set((state) => {
      if (!state.results[monitor.id]) state.results[monitor.id] = [];
      state.results[monitor.id]!.push(result);
      if (state.results[monitor.id]!.length > 100) {
        state.results[monitor.id] = state.results[monitor.id]!.slice(-100);
      }
    });
  } catch (e) {
    const result: MonitorResult = {
      monitorId: monitor.id,
      timestamp: start,
      status: 0,
      duration: Date.now() - start,
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
    set((state) => {
      if (!state.results[monitor.id]) state.results[monitor.id] = [];
      state.results[monitor.id]!.push(result);
      if (state.results[monitor.id]!.length > 100) {
        state.results[monitor.id] = state.results[monitor.id]!.slice(-100);
      }
    });
  }
}

export const useMonitorStore = create<MonitorState & MonitorActions>()(
  immer((set, get) => ({
    monitors: [],
    results: {},
    timers: {},
    activeMonitorId: null,

    addMonitor: (config) => {
      const id = `monitor-${Date.now()}`;
      const monitor: MonitorConfig = { ...config, id, enabled: false };
      set((state) => {
        state.monitors.push(monitor);
        state.results[id] = [];
      });
    },

    removeMonitor: (id) => {
      const { timers } = get();
      if (timers[id]) {
        clearInterval(timers[id]!);
      }
      set((state) => {
        delete state.timers[id];
        delete state.results[id];
        state.monitors = state.monitors.filter((m) => m.id !== id);
      });
    },

    toggleMonitor: (id) => {
      const { monitors, timers } = get();
      const monitor = monitors.find((m) => m.id === id);
      if (!monitor) return;

      if (timers[id]) {
        clearInterval(timers[id]!);
        set((state) => {
          delete state.timers[id];
          const m = state.monitors.find((m) => m.id === id);
          if (m) m.enabled = false;
        });
      } else {
        void executeMonitor(monitor, set);
        const timer = setInterval(() => {
          const current = get().monitors.find((m) => m.id === id);
          if (current) void executeMonitor(current, set);
        }, monitor.intervalMs);
        set((state) => {
          state.timers[id] = timer;
          const m = state.monitors.find((m) => m.id === id);
          if (m) m.enabled = true;
        });
      }
    },

    updateMonitor: (id, updates) => {
      const { timers } = get();
      if (timers[id] && updates.intervalMs) {
        clearInterval(timers[id]!);
        const monitor = get().monitors.find((m) => m.id === id);
        if (monitor) {
          const timer = setInterval(() => {
            const current = get().monitors.find((m) => m.id === id);
            if (current) void executeMonitor(current, set);
          }, updates.intervalMs);
          set((state) => {
            state.timers[id] = timer;
            const m = state.monitors.find((m) => m.id === id);
            if (m) Object.assign(m, updates);
          });
        }
      } else {
        set((state) => {
          const m = state.monitors.find((m) => m.id === id);
          if (m) Object.assign(m, updates);
        });
      }
    },

    clearResults: (id) => {
      set((state) => {
        state.results[id] = [];
      });
    },

    stopAll: () => {
      const { timers } = get();
      for (const timer of Object.values(timers)) {
        clearInterval(timer);
      }
      set((state) => {
        state.timers = {};
        state.monitors.forEach((m) => { m.enabled = false; });
      });
    },
  })),
);
