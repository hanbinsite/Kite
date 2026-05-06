export type ImportFormat = "curl" | "postman" | "openapi" | "har" | "unknown";

export interface ImportRequest {
  name: string;
  method: string;
  url: string;
  headers: { key: string; value: string; disabled: boolean }[];
  params: { key: string; value: string; disabled: boolean }[];
  body?: {
    mode: string;
    content?: string;
    content_type?: string;
    language?: string;
  };
  auth?: {
    type: string;
    config: Record<string, unknown>;
  };
}

export interface ImportResult {
  format: ImportFormat;
  collectionName: string;
  requests: ImportRequest[];
  errors: string[];
}
