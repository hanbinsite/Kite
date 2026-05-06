import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface GrpcMethodInfo {
  serviceName: string;
  methodName: string;
  inputType: string;
  outputType: string;
  clientStreaming: boolean;
  serverStreaming: boolean;
}

export interface GrpcResponse {
  requestId: string;
  status: string;
  headers: [string, string][];
  body: string;
  timeMs: number;
}

export interface GrpcStreamMessage {
  requestId: string;
  body: string;
  streamType: "data" | "error" | "end";
}

export interface GrpcRequestConfig {
  requestId: string;
  url: string;
  serviceName: string;
  methodName: string;
  requestJson: string;
  metadata?: [string, string][];
  timeoutMs?: number;
  protoFileId?: string;
}

export async function parseProtoFile(
  protoFileId: string,
  filePath: string,
): Promise<GrpcMethodInfo[]> {
  return invoke<GrpcMethodInfo[]>("parse_proto_file", { protoFileId, filePath });
}

export async function sendGrpcRequest(
  config: GrpcRequestConfig,
): Promise<GrpcResponse> {
  return invoke<GrpcResponse>("send_grpc_request", { config });
}

export async function onGrpcStreamMessage(
  callback: (msg: GrpcStreamMessage) => void,
): Promise<UnlistenFn> {
  return listen<GrpcStreamMessage>("grpc-stream-message", (event) => {
    callback(event.payload);
  });
}
