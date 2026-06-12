import type { AppError } from "@api-client/types";

// These are fallback descriptions for backend error codes (AppError.code).
// They are NOT user-facing translatable strings — translations happen at the UI layer
// via i18n using code-based lookups. This map only provides defaults when i18n is unavailable.

export type ErrorCategory = "network" | "storage" | "script" | "vault" | "validation" | "proxy" | "general";

export interface ErrorMapping {
  title: string;
  description: string;
  variant: "success" | "error" | "warning" | "info";
  category: ErrorCategory;
  retryable: boolean;
  action?: { label: string; handler: string };
}

const ERROR_MAP: Record<string, ErrorMapping> = {
  NET_CONNECT_FAILED: {
    title: "Connection Failed",
    description: "Could not connect to the server. Check your network and try again.",
    variant: "error",
    category: "network",
    retryable: true,
    action: { label: "Retry", handler: "retry" },
  },
  NET_TIMEOUT: {
    title: "Request Timeout",
    description: "The server took too long to respond. Try increasing the timeout in Settings.",
    variant: "error",
    category: "network",
    retryable: true,
    action: { label: "Retry", handler: "retry" },
  },
  NET_REQUEST_CANCELLED: {
    title: "Request Cancelled",
    description: "The request was cancelled before completion.",
    variant: "warning",
    category: "network",
    retryable: true,
    action: { label: "Resend", handler: "retry" },
  },
  NET_DNS_ERROR: {
    title: "DNS Error",
    description: "Could not resolve the server address. Check the URL and your DNS settings.",
    variant: "error",
    category: "network",
    retryable: true,
    action: { label: "Retry", handler: "retry" },
  },
  NET_TLS_ERROR: {
    title: "TLS Error",
    description: "A secure connection could not be established.",
    variant: "error",
    category: "network",
    retryable: false,
  },
  NET_SSL_VERIFICATION: {
    title: "SSL Verification Failed",
    description: "The server certificate could not be verified. Disable SSL verification in Settings if needed.",
    variant: "warning",
    category: "network",
    retryable: false,
    action: { label: "Open Settings", handler: "openSettings" },
  },
  NET_REDIRECT_LIMIT: {
    title: "Too Many Redirects",
    description: "The server redirected too many times. Check the redirect chain.",
    variant: "warning",
    category: "network",
    retryable: false,
  },
  NET_BODY_TOO_LARGE: {
    title: "Response Too Large",
    description: "The response body exceeds the size limit.",
    variant: "warning",
    category: "network",
    retryable: false,
  },
  NET_INVALID_URL: {
    title: "Invalid URL",
    description: "The request URL is not valid. Check the format.",
    variant: "error",
    category: "network",
    retryable: false,
  },
  NET_AUTH_FAILED: {
    title: "Authentication Failed",
    description: "The server rejected the credentials. Check your authentication settings.",
    variant: "error",
    category: "network",
    retryable: false,
    action: { label: "Edit Auth", handler: "editAuth" },
  },
  STORAGE_READ_FAILED: {
    title: "Read Failed",
    description: "Could not read from storage. The data may be corrupted.",
    variant: "error",
    category: "storage",
    retryable: true,
  },
  STORAGE_WRITE_FAILED: {
    title: "Save Failed",
    description: "Could not save to storage. Your changes may be lost.",
    variant: "error",
    category: "storage",
    retryable: true,
  },
  STORAGE_NOT_FOUND: {
    title: "Not Found",
    description: "The requested resource was not found.",
    variant: "warning",
    category: "storage",
    retryable: false,
  },
  STORAGE_PATH_TRAVERSAL: {
    title: "Access Denied",
    description: "The file path is not allowed.",
    variant: "error",
    category: "storage",
    retryable: false,
  },
  STORAGE_PARSE_FAILED: {
    title: "Parse Error",
    description: "Could not parse the data. The format may be invalid.",
    variant: "error",
    category: "storage",
    retryable: false,
  },
  STORAGE_FILE_TOO_LARGE: {
    title: "File Too Large",
    description: "The file exceeds the size limit.",
    variant: "warning",
    category: "storage",
    retryable: false,
  },
  SCRIPT_TIMEOUT: {
    title: "Script Timeout",
    description: "Script execution took too long and was terminated.",
    variant: "warning",
    category: "script",
    retryable: false,
  },
  SCRIPT_ERROR: {
    title: "Script Error",
    description: "An error occurred during script execution.",
    variant: "error",
    category: "script",
    retryable: false,
  },
  SCRIPT_MEMORY_LIMIT: {
    title: "Script Memory Limit",
    description: "Script exceeded the memory limit and was terminated.",
    variant: "warning",
    category: "script",
    retryable: false,
  },
  VAULT_LOCKED: {
    title: "Vault Locked",
    description: "The vault is locked. Unlock it to access secrets.",
    variant: "warning",
    category: "vault",
    retryable: false,
  },
  VAULT_UNLOCK_FAILED: {
    title: "Unlock Failed",
    description: "The vault password is incorrect.",
    variant: "error",
    category: "vault",
    retryable: true,
  },
  VAULT_ENCRYPT_FAILED: {
    title: "Encryption Failed",
    description: "Could not encrypt the data.",
    variant: "error",
    category: "vault",
    retryable: true,
  },
  VAULT_DECRYPT_FAILED: {
    title: "Decryption Failed",
    description: "Could not decrypt the data. The password may be wrong.",
    variant: "error",
    category: "vault",
    retryable: true,
  },
  VALIDATION_FAILED: {
    title: "Validation Error",
    description: "The input is not valid.",
    variant: "error",
    category: "validation",
    retryable: false,
  },
  INVALID_INPUT: {
    title: "Invalid Input",
    description: "The provided input is not valid.",
    variant: "error",
    category: "validation",
    retryable: false,
  },
  PROXY_START_FAILED: {
    title: "Proxy Failed",
    description: "Could not start the proxy server.",
    variant: "error",
    category: "proxy",
    retryable: true,
  },
  PROXY_NOT_RUNNING: {
    title: "Proxy Not Running",
    description: "The proxy server is not running.",
    variant: "warning",
    category: "proxy",
    retryable: true,
  },
  NOT_IMPLEMENTED: {
    title: "Not Available",
    description: "This feature is not yet implemented.",
    variant: "info",
    category: "general",
    retryable: false,
  },
  INTERNAL: {
    title: "Internal Error",
    description: "An unexpected error occurred.",
    variant: "error",
    category: "general",
    retryable: true,
  },
};

export function getErrorMapping(code: string): ErrorMapping {
  return ERROR_MAP[code] ?? {
    title: "Error",
    description: "An unknown error occurred.",
    variant: "error",
    category: "general",
    retryable: false,
  };
}

export function categorizeError(code: string): ErrorCategory {
  if (code.startsWith("NET_")) return "network";
  if (code.startsWith("STORAGE_")) return "storage";
  if (code.startsWith("SCRIPT_")) return "script";
  if (code.startsWith("VAULT_")) return "vault";
  if (code.startsWith("VALIDATION_") || code === "INVALID_INPUT") return "validation";
  if (code.startsWith("PROXY_")) return "proxy";
  return "general";
}

export function isRetryableError(code: string): boolean {
  return getErrorMapping(code).retryable;
}

export function isNetworkError(code: string): boolean {
  return categorizeError(code) === "network";
}

export function parseAppError(err: unknown): AppError | null {
  if (typeof err === "object" && err !== null && "code" in err && "detail" in err) {
    return err as AppError;
  }
  return null;
}
