export type ExportFormat = "postman" | "curl" | "har";

export interface ExportOptions {
  format: ExportFormat;
  includeScripts?: boolean;
  includeVariables?: boolean;
}

export interface ExportRequest {
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
  scripts?: {
    preRequest?: string;
    postResponse?: string;
  };
}

export interface ExportCollection {
  name: string;
  requests: ExportRequest[];
  variables?: { key: string; value: string }[];
}
