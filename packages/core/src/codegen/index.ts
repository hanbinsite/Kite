import { invoke } from "@tauri-apps/api/core";

export type CodeLanguage =
  | "curl"
  | "python-requests"
  | "javascript-fetch"
  | "javascript-axios"
  | "typescript-fetch"
  | "go-net-http"
  | "java-httpurlconnection"
  | "php-curl"
  | "ruby-net-http"
  | "csharp-httpclient"
  | "kotlin-okhttp"
  | "swift-urlsession"
  | "dart-http"
  | "node-undici";

export interface CodeGenResult {
  code: string;
  language: string;
}

export interface CodeGenRequest {
  id: string;
  method: string;
  url: string;
  headers: { key: string; value: string; disabled: boolean }[];
  params: { key: string; value: string; disabled: boolean }[];
  body: { mode: string; content?: string; content_type?: string } | null;
  auth: { type: string; config: Record<string, unknown> | null } | null;
  settings: { timeout_ms: number; follow_redirects: boolean; max_redirects: number; verify_ssl: boolean };
}

export async function generateCode(
  config: CodeGenRequest,
  language: CodeLanguage,
): Promise<CodeGenResult> {
  return invoke<CodeGenResult>("generate_code", { config, language });
}

export const CODE_LANGUAGES: { value: CodeLanguage; label: string }[] = [
  { value: "curl", label: "cURL" },
  { value: "python-requests", label: "Python" },
  { value: "javascript-fetch", label: "JavaScript (Fetch)" },
  { value: "javascript-axios", label: "JavaScript (Axios)" },
  { value: "typescript-fetch", label: "TypeScript" },
  { value: "go-net-http", label: "Go" },
  { value: "java-httpurlconnection", label: "Java" },
  { value: "php-curl", label: "PHP" },
  { value: "ruby-net-http", label: "Ruby" },
  { value: "csharp-httpclient", label: "C#" },
  { value: "kotlin-okhttp", label: "Kotlin" },
  { value: "swift-urlsession", label: "Swift" },
  { value: "dart-http", label: "Dart" },
  { value: "node-undici", label: "Node.js" },
];
