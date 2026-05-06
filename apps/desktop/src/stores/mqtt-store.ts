import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { mqttConnect as ipcConnect, mqttSubscribe as ipcSubscribe, mqttPublish as ipcPublish, mqttDisconnect as ipcDisconnect, onMqttMessage, type MqttMessage, type MqttConnectConfig } from "@api-client/core/mqtt";
import { handleError } from "@api-client/core/error";

export type MqttConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface MqttConnectionState {
  status: MqttConnectionStatus;
  config: MqttConnectConfig | null;
  messages: MqttMessage[];
  subscriptions: string[];
  error: string | null;
}

export interface MqttState {
  connections: Record<string, MqttConnectionState>;
}

export interface MqttActions {
  connect: (connectionId: string, config: MqttConnectConfig) => Promise<void>;
  subscribe: (connectionId: string, topic: string, qos: number) => Promise<void>;
  publish: (connectionId: string, topic: string, payload: string, qos: number) => Promise<void>;
  disconnect: (connectionId: string) => Promise<void>;
  clearMessages: (connectionId: string) => void;
  removeConnection: (connectionId: string) => void;
  pushMessage: (connectionId: string, msg: MqttMessage) => void;
}

const MAX_MESSAGES = 500;

export type MqttStore = MqttState & MqttActions;

export const useMqttStore = create<MqttStore>()(
  immer((set, get) => ({
    connections: {},

    connect: async (connectionId, config) => {
      set((state) => {
        state.connections[connectionId] = {
          status: "connecting",
          config,
          messages: [],
          subscriptions: [],
          error: null,
        };
      });

      try {
        await ipcConnect(connectionId, config);
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

    subscribe: async (connectionId, topic, qos) => {
      try {
        await ipcSubscribe(connectionId, topic, qos);
        set((state) => {
          if (state.connections[connectionId]) {
            state.connections[connectionId].subscriptions.push(topic);
          }
        });
        get().pushMessage(connectionId, {
          connectionId,
          topic,
          payload: `Subscribed to ${topic} (QoS ${qos})`,
          qos,
          direction: "system",
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

    publish: async (connectionId, topic, payload, qos) => {
      try {
        await ipcPublish(connectionId, topic, payload, qos);
        get().pushMessage(connectionId, {
          connectionId,
          topic,
          payload,
          qos,
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
          conn.error = msg.payload;
        }
        if (msg.direction === "system" && msg.payload.toLowerCase().includes("disconnected")) {
          conn.status = "disconnected";
        }
      }),
  })),
);

let _unlisten: (() => void) | null = null;

export async function initMqttEventListener() {
  if (_unlisten) return;
  _unlisten = await onMqttMessage((msg) => {
    useMqttStore.getState().pushMessage(msg.connectionId, msg);
  });
}

export function destroyMqttEventListener() {
  if (_unlisten) {
    _unlisten();
    _unlisten = null;
  }
}
