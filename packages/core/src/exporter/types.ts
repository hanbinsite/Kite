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
  description?: string;
  folderGroup?: string;
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

export interface ExportFolder {
  name: string;
  description?: string;
  items: ExportRequest[];
}

export interface ExportCollection {
  name: string;
  requests: ExportRequest[];
  folders?: ExportFolder[];
  variables?: { key: string; value: string }[];
}
