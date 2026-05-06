import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  startMockServer as ipcStart,
  stopMockServer as ipcStop,
  getMockServerStatus as ipcStatus,
  addMockRoute as ipcAddRoute,
  removeMockRoute as ipcRemoveRoute,
  updateMockRoute as ipcUpdateRoute,
  listMockRoutes as ipcListRoutes,
  clearMockRoutes as ipcClearRoutes,
  onMockRequestReceived,
  type MockRoute,
  type MockServerConfig,
  type MockServerStatus,
  type MockRequestLog,
} from "@api-client/core/mock";
import { handleError } from "@api-client/core/error";

const MAX_LOG_ENTRIES = 200;

export interface MockState {
  status: MockServerStatus;
  routes: MockRoute[];
  requestLog: MockRequestLog[];
  error: string | null;
}

export interface MockActions {
  startServer: (config: MockServerConfig) => Promise<void>;
  stopServer: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  addRoute: (route: MockRoute) => Promise<void>;
  removeRoute: (routeId: string) => Promise<void>;
  updateRoute: (route: MockRoute) => Promise<void>;
  loadRoutes: () => Promise<void>;
  clearRoutes: () => Promise<void>;
  clearLog: () => void;
  pushLog: (log: MockRequestLog) => void;
}

export type MockStore = MockState & MockActions;

export const useMockStore = create<MockStore>()(
  immer((set) => ({
    status: { running: false, port: null },
    routes: [],
    requestLog: [],
    error: null,

    startServer: async (config) => {
      try {
        await ipcStart(config);
        set((state) => {
          state.status = { running: true, port: config.port };
          state.error = null;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    stopServer: async () => {
      try {
        await ipcStop();
        set((state) => {
          state.status = { running: false, port: null };
          state.error = null;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    refreshStatus: async () => {
      try {
        const status = await ipcStatus();
        set((state) => {
          state.status = status;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    addRoute: async (route) => {
      try {
        await ipcAddRoute(route);
        set((state) => {
          state.routes.push(route);
          state.error = null;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    removeRoute: async (routeId: string) => {
      try {
        await ipcRemoveRoute(routeId);
        set((state) => {
          state.routes = state.routes.filter((r: MockRoute) => r.id !== routeId);
          state.error = null;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    updateRoute: async (route) => {
      try {
        await ipcUpdateRoute(route);
        set((state) => {
          const idx = state.routes.findIndex((r: MockRoute) => r.id === route.id);
          if (idx !== -1) state.routes[idx] = route;
          state.error = null;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    loadRoutes: async () => {
      try {
        const routes = await ipcListRoutes();
        set((state) => {
          state.routes = routes;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    clearRoutes: async () => {
      try {
        await ipcClearRoutes();
        set((state) => {
          state.routes = [];
          state.error = null;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.error = handled.description;
        });
      }
    },

    clearLog: () =>
      set((state) => {
        state.requestLog = [];
      }),

    pushLog: (log: MockRequestLog) =>
      set((state) => {
        state.requestLog.push(log);
        if (state.requestLog.length > MAX_LOG_ENTRIES) {
          state.requestLog = state.requestLog.slice(-MAX_LOG_ENTRIES);
        }
      }),
  })),
);

let _unlisten: (() => void) | null = null;

export async function initMockEventListener() {
  if (_unlisten) return;
  _unlisten = await onMockRequestReceived((log) => {
    useMockStore.getState().pushLog(log);
  });
}

export function destroyMockEventListener() {
  if (_unlisten) {
    _unlisten();
    _unlisten = null;
  }
}
