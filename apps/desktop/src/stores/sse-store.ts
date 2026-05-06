import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { sseConnect as ipcConnect, sseDisconnect as ipcDisconnect, onSseEvent, type SseEvent } from "@api-client/core/sse";
import { handleError } from "@api-client/core/error";

export type SseConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface SseConnectionState {
  status: SseConnectionStatus;
  url: string;
  events: SseEvent[];
  error: string | null;
}

export interface SseState {
  connections: Record<string, SseConnectionState>;
}

export interface SseActions {
  connect: (connectionId: string, url: string, headers?: [string, string][]) => Promise<void>;
  disconnect: (connectionId: string) => Promise<void>;
  clearEvents: (connectionId: string) => void;
  removeConnection: (connectionId: string) => void;
  pushEvent: (connectionId: string, event: SseEvent) => void;
}

const MAX_EVENTS = 200;

export type SseStore = SseState & SseActions;

export const useSseStore = create<SseStore>()(
  immer((set) => ({
    connections: {},

    connect: async (connectionId, url, headers) => {
      set((state) => {
        state.connections[connectionId] = {
          status: "connecting",
          url,
          events: [],
          error: null,
        };
      });

      try {
        await ipcConnect(connectionId, url, headers);
        set((state) => {
          if (state.connections[connectionId]) {
            state.connections[connectionId].status = "connected";
          }
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          if (state.connections[connectionId]) {
            state.connections[connectionId].status = "error";
            state.connections[connectionId].error = handled.description;
          }
        });
      }
    },

    disconnect: async (connectionId) => {
      try {
        await ipcDisconnect(connectionId);
        set((state) => {
          if (state.connections[connectionId]) {
            state.connections[connectionId].status = "disconnected";
          }
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          if (state.connections[connectionId]) {
            state.connections[connectionId].status = "error";
            state.connections[connectionId].error = handled.description;
          }
        });
      }
    },

    clearEvents: (connectionId) =>
      set((state) => {
        if (state.connections[connectionId]) {
          state.connections[connectionId].events = [];
        }
      }),

    removeConnection: (connectionId) =>
      set((state) => {
        delete state.connections[connectionId];
      }),

    pushEvent: (connectionId, sseEvent) =>
      set((state) => {
        if (!state.connections[connectionId]) return;
        const conn = state.connections[connectionId];
        conn.events.push(sseEvent);
        if (conn.events.length > MAX_EVENTS) {
          conn.events = conn.events.slice(-MAX_EVENTS);
        }
        if (sseEvent.event === "error") {
          conn.status = "error";
          conn.error = sseEvent.data;
        }
        if (sseEvent.event === "disconnected") {
          conn.status = "disconnected";
        }
      }),
  })),
);

let _unlisten: (() => void) | null = null;

export async function initSseEventListener() {
  if (_unlisten) return;
  _unlisten = await onSseEvent((event) => {
    useSseStore.getState().pushEvent(event.connectionId, event);
  });
}

export function destroySseEventListener() {
  if (_unlisten) {
    _unlisten();
    _unlisten = null;
  }
}
