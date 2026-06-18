import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { parseProtoFile as ipcParse, sendGrpcRequest as ipcSend, reflectGrpcServices as ipcReflect, onGrpcStreamMessage, type GrpcMethodInfo, type GrpcResponse, type GrpcStreamMessage, type GrpcRequestConfig, type GrpcServiceInfo } from "@api-client/core/grpc";
import { handleError } from "@api-client/core/error";

export interface GrpcParsedProto {
  methods: GrpcMethodInfo[];
  filePath: string;
}

export interface GrpcRequestState {
  loading: boolean;
  response: GrpcResponse | null;
  error: string | null;
  streamMessages: GrpcStreamMessage[];
}

export interface GrpcState {
  parsedProtos: Record<string, GrpcParsedProto>;
  requests: Record<string, GrpcRequestState>;
  discoveredServices: Record<string, GrpcServiceInfo[]>;
}

export interface GrpcActions {
  parseProto: (protoFileId: string, filePath: string) => Promise<void>;
  sendRequest: (config: GrpcRequestConfig) => Promise<void>;
  clearResponse: (requestId: string) => void;
  pushStreamMessage: (requestId: string, msg: GrpcStreamMessage) => void;
  reflectServices: (connectionId: string, url: string) => Promise<void>;
  clearDiscoveredServices: (connectionId: string) => void;
}

export type GrpcStore = GrpcState & GrpcActions;

export const useGrpcStore = create<GrpcStore>()(
  immer((set) => ({
    parsedProtos: {},
    requests: {},
    discoveredServices: {},

    parseProto: async (protoFileId, filePath) => {
      try {
        const methods = await ipcParse(protoFileId, filePath);
        set((state) => {
          state.parsedProtos[protoFileId] = { methods, filePath };
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          state.requests[protoFileId] = {
            loading: false,
            response: null,
            error: handled.description,
            streamMessages: [],
          };
        });
      }
    },

    sendRequest: async (config) => {
      set((state) => {
        state.requests[config.requestId] = {
          loading: true,
          response: null,
          error: null,
          streamMessages: [],
        };
      });

      try {
        const response = await ipcSend(config);
        set((state) => {
          const req = state.requests[config.requestId];
          if (req) {
            req.loading = false;
            req.response = response;
          }
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          const req = state.requests[config.requestId];
          if (req) {
            req.loading = false;
            req.error = handled.description;
          }
        });
      }
    },

    clearResponse: (requestId) =>
      set((state) => {
        delete state.requests[requestId];
      }),

    pushStreamMessage: (requestId, msg) =>
      set((state) => {
        if (!state.requests[requestId]) {
          state.requests[requestId] = { loading: true, response: null, error: null, streamMessages: [] };
        }
        state.requests[requestId].streamMessages.push(msg);
        if (msg.streamType === "end" || msg.streamType === "error") {
          state.requests[requestId].loading = false;
        }
      }),

    reflectServices: async (connectionId, url) => {
      set((state) => {
        state.requests[connectionId] = {
          loading: true,
          response: null,
          error: null,
          streamMessages: [],
        };
      });
      try {
        const services = await ipcReflect(url);
        set((state) => {
          state.discoveredServices[connectionId] = services;
          const req = state.requests[connectionId];
          if (req) req.loading = false;
        });
      } catch (err) {
        const handled = handleError(err);
        set((state) => {
          const req = state.requests[connectionId];
          if (req) {
            req.loading = false;
            req.error = handled.description;
          }
        });
      }
    },

    clearDiscoveredServices: (connectionId) =>
      set((state) => {
        delete state.discoveredServices[connectionId];
      }),
  })),
);

let _unlisten: (() => void) | null = null;

export async function initGrpcEventListener() {
  if (_unlisten) return;
  _unlisten = await onGrpcStreamMessage((msg) => {
    useGrpcStore.getState().pushStreamMessage(msg.requestId, msg);
  });
}

export function destroyGrpcEventListener() {
  if (_unlisten) {
    _unlisten();
    _unlisten = null;
  }
}
