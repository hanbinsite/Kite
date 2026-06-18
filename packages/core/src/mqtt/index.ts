import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface MqttMessage {
  connectionId: string;
  topic: string;
  payload: string;
  qos: number;
  direction: "sent" | "received" | "system" | "error";
  timestamp: number;
}

export interface MqttConnectConfig {
  broker: string;
  port: number;
  clientId: string;
  username?: string;
  password?: string;
  cleanSession: boolean;
  keepAlive: number;
}

export async function mqttConnect(
  connectionId: string,
  config: MqttConnectConfig,
): Promise<void> {
  return invoke<void>("mqtt_connect", { connectionId, config });
}

export async function mqttSubscribe(
  connectionId: string,
  topic: string,
  qos: number,
): Promise<void> {
  return invoke<void>("mqtt_subscribe", { connectionId, topic, qos });
}

export async function mqttUnsubscribe(
  connectionId: string,
  topic: string,
): Promise<void> {
  return invoke<void>("mqtt_unsubscribe", { connectionId, topic });
}

export async function mqttPublish(
  connectionId: string,
  topic: string,
  payload: string,
  qos: number,
): Promise<void> {
  return invoke<void>("mqtt_publish", { connectionId, topic, payload, qos });
}

export async function mqttDisconnect(
  connectionId: string,
): Promise<void> {
  return invoke<void>("mqtt_disconnect", { connectionId });
}

export async function onMqttMessage(
  callback: (msg: MqttMessage) => void,
): Promise<UnlistenFn> {
  return listen<MqttMessage>("mqtt-message", (event) => {
    callback(event.payload);
  });
}
