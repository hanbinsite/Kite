import type { AuthConfig } from "@api-client/types";

const EMPTY_CONFIGS: Record<string, Record<string, unknown>> = {
  none: {},
  apikey: { key: "", value: "", addTo: "header" },
  bearer: { token: "", prefix: "Bearer" },
  basic: { username: "", password: "" },
  jwt: { token: "" },
  oauth1: { consumerKey: "", consumerSecret: "", token: "", tokenSecret: "", signatureMethod: "HMAC-SHA1" },
  oauth2: { accessToken: "", tokenType: "Bearer" },
  awsv4: { accessKeyId: "", secretAccessKey: "", service: "", region: "" },
};

export function createAuthConfig(type: string, config?: Record<string, unknown>): AuthConfig {
  const defaults = EMPTY_CONFIGS[type] ?? {};
  return { type, config: { ...defaults, ...config } } as AuthConfig;
}
