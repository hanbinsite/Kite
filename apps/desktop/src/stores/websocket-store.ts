import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { wsConnect as ipcConnect, wsSend as ipcSend, wsSendBinary as ipcSendBinary, wsClose as ipcClose, onWsMessage, type WsMessage } from "@api-client/core/ws";
import { handleError } from "@api-client/core/error";

export type WsConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface WsConnectionState {
  status: WsConnectionStatus;
  url: string;
  messages: WsMessage[];
  error: string | null;
}

export interface WsState {
  connections: Record<string, WsConnectionState>;
}

export interface WsActions {
  connect: (connectionId: string, url: string, headers?: [string, string][]) => Promise<void>;
  send: (connectionId: string, message: string) => Promise<void>;
  sendBinary: (connectionId: string, data: ArrayBuffer, fileName?: string) => Promise<void>;
  disconnect: (connectionId: string) => Promise<void>;
  clearMessages: (connectionId: string) => void;
  removeConnection: (connectionId: string) => void;
  pushMessage: (connectionId: string, msg: WsMessage) => void;
}

const MAX_MESSAGES = 500;

export type WsStore = WsState & WsActions;

export const useWsStore = create<WsStore>()(
  immer((set, get) => ({
    connections: {},

    connect: async (connectionId, url, headers) => {
      set((state) => {
        state.connections[connectionId] = {
          status: "connecting",
          url,
          messages: [],
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

    send: async (connectionId, message) => {
      try {
        await ipcSend(connectionId, message);
        get().pushMessage(connectionId, {
          connectionId,
          data: message,
          direction: "sent",
          timestamp: Date.now(),
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          if (state.connections[connectionId]) {
            state.connections[connectionId].error = handled.description;
          }
        });
      }
    },

    sendBinary: async (connectionId, data, fileName) => {
      try {
        await ipcSendBinary(connectionId, data);
        const len = data.byteLength;
        get().pushMessage(connectionId, {
          connectionId,
          data: fileName ? `(binary sent, ${len} bytes, ${fileName})` : `(binary sent, ${len} bytes)`,
          direction: "sent",
          timestamp: Date.now(),
          isBinary: true,
          byteLen: len,
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          if (state.connections[connectionId]) {
            state.connections[connectionId].error = handled.description;
          }
        });
      }
    },

    disconnect: async (connectionId) => {
      try {
        await ipcClose(connectionId);
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

    clearMessages: (connectionId) =>
      set((state) => {
        if (state.connections[connectionId]) {
          state.connections[connectionId].messages = [];
        }
      }),

    removeConnection: (connectionId) =>
      set((state) => {
        delete state.connections[connectionId];
      }),

    pushMessage: (connectionId, msg) =>
      set((state) => {
        if (!state.connections[connectionId]) return;
        const conn = state.connections[connectionId];
        conn.messages.push(msg);
        if (conn.messages.length > MAX_MESSAGES) {
          conn.messages = conn.messages.slice(-MAX_MESSAGES);
        }
        if (msg.direction === "error") {
          conn.status = "error";
          conn.error = msg.data;
        }
        if (msg.direction === "system" && msg.data.toLowerCase().includes("closed")) {
          conn.status = "disconnected";
        }
      }),
  })),
);

let _unlisten: (() => void) | null = null;

export async function initWsEventListener() {
  if (_unlisten) return;
  _unlisten = await onWsMessage((msg) => {
    useWsStore.getState().pushMessage(msg.connectionId, msg);
  });
}

export function destroyWsEventListener() {
  if (_unlisten) {
    _unlisten();
    _unlisten = null;
  }
}
