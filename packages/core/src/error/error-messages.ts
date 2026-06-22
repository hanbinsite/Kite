import type { AppError } from "@api-client/types";

// These are fallback descriptions for backend error codes (AppError.code).
// They are NOT user-facing translatable strings — translations happen at the UI layer
// via i18n using code-based lookups. This map only provides defaults when i18n is unavailable.

export type ErrorCategory = "network" | "storage" | "script" | "vault" | "validation" | "mock" | "general" | "auth" | "import" | "export";

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
  NET_CONNECTION_REFUSED: {
    title: "Connection Refused",
    description: "The server refused the connection.",
    variant: "error",
    category: "network",
    retryable: true,
    action: { label: "Check URL", handler: "checkUrl" },
  },
  NET_SEND_FAILED: {
    title: "Send Failed",
    description: "Failed to send the request.",
    variant: "error",
    category: "network",
    retryable: true,
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
  STORAGE_DELETE_FAILED: {
    title: "Delete Failed",
    description: "Failed to delete data.",
    variant: "error",
    category: "storage",
    retryable: false,
  },
  STORAGE_DB_ERROR: {
    title: "Database Error",
    description: "A database error occurred.",
    variant: "error",
    category: "storage",
    retryable: false,
  },
  STORAGE_MIGRATION_FAILED: {
    title: "Migration Failed",
    description: "Database migration failed. Backup may be needed.",
    variant: "error",
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
  VAULT_SECRET_NOT_FOUND: {
    title: "Secret Not Found",
    description: "The requested vault secret was not found.",
    variant: "warning",
    category: "vault",
    retryable: false,
  },
  AUTH_INVALID_CREDENTIALS: {
    title: "Invalid Credentials",
    description: "The provided credentials are invalid.",
    variant: "error",
    category: "auth",
    retryable: false,
    action: { label: "Edit Auth", handler: "editAuth" },
  },
  AUTH_TOKEN_EXPIRED: {
    title: "Token Expired",
    description: "Your authentication token has expired.",
    variant: "warning",
    category: "auth",
    retryable: false,
    action: { label: "Refresh Auth", handler: "refreshAuth" },
  },
  AUTH_OAUTH_STATE_MISMATCH: {
    title: "Security Error",
    description: "OAuth state parameter mismatch.",
    variant: "error",
    category: "auth",
    retryable: false,
  },
  AUTH_OAUTH_NO_CODE: {
    title: "Authorization Failed",
    description: "No authorization code received.",
    variant: "error",
    category: "auth",
    retryable: false,
  },
  AUTH_OAUTH_EXCHANGE_FAILED: {
    title: "Token Exchange Failed",
    description: "Failed to exchange authorization code for token.",
    variant: "error",
    category: "auth",
    retryable: false,
  },
  IMPORT_INVALID_FORMAT: {
    title: "Invalid Format",
    description: "The file content is not in a valid format.",
    variant: "error",
    category: "import",
    retryable: false,
  },
  IMPORT_FILE_NOT_FOUND: {
    title: "File Not Found",
    description: "The specified file was not found.",
    variant: "error",
    category: "import",
    retryable: false,
  },
  IMPORT_PARSE_ERROR: {
    title: "Parse Error",
    description: "Failed to parse the file content.",
    variant: "error",
    category: "import",
    retryable: false,
  },
  IMPORT_UNSUPPORTED_FORMAT: {
    title: "Unsupported Format",
    description: "This format is not supported.",
    variant: "error",
    category: "import",
    retryable: false,
  },
  EXPORT_FAILED: {
    title: "Export Failed",
    description: "Failed to export data.",
    variant: "error",
    category: "export",
    retryable: false,
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
  MOCK_START_FAILED: {
    title: "Mock Server Failed",
    description: "Could not start the mock server.",
    variant: "error",
    category: "mock",
    retryable: true,
  },
  MOCK_NOT_RUNNING: {
    title: "Mock Server Not Running",
    description: "The mock server is not running.",
    variant: "warning",
    category: "mock",
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
  if (code.startsWith("AUTH_")) return "auth";
  if (code.startsWith("IMPORT_")) return "import";
  if (code.startsWith("EXPORT_")) return "export";
  if (code.startsWith("VALIDATION_") || code === "INVALID_INPUT") return "validation";
  if (code.startsWith("MOCK_")) return "mock";
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
