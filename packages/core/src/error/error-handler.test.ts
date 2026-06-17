import { describe, it, expect } from "vitest";
import { handleError, parseAppError, isRetryableError, isNetworkError, categorizeError, getErrorMapping } from "./error-handler";
import type { AppError } from "@api-client/types";

describe("handleError", () => {
  it("handles AppError with known code", () => {
    const err: AppError = { code: "NET_TIMEOUT", detail: "timed out" };
    const result = handleError(err);
    expect(result.title).toBe("Request Timeout");
    expect(result.description).toBe("timed out");
    expect(result.variant).toBe("error");
    expect(result.retryable).toBe(true);
  });

  it("handles AppError with empty detail (uses fallback)", () => {
    const err: AppError = { code: "NET_CONNECT_FAILED", detail: "" };
    const result = handleError(err);
    expect(result.title).toBe("Connection Failed");
    expect(result.description).toContain("Could not connect");
  });

  it("handles string error gracefully", () => {
    const result = handleError("something went wrong");
    expect(result.title).toBe("Error");
    expect(result.description).toBe("something went wrong");
    expect(result.retryable).toBe(false);
    expect(result.originalError).toBeNull();
  });

  it("handles unknown object error", () => {
    const result = handleError({ foo: "bar" });
    expect(result.description).toBe("An unexpected error occurred");
  });

  it("handles null/undefined", () => {
    const result = handleError(null);
    expect(result.title).toBe("Error");
  });

  it("returns action with retry handler", () => {
    let called = false;
    const err: AppError = { code: "NET_CONNECT_FAILED", detail: "fail" };
    const result = handleError(err, { onRetry: () => { called = true; } });
    expect(result.action).toBeDefined();
    result.action!.onClick();
    expect(called).toBe(true);
  });

  it("returns action with settings handler for NET_SSL_VERIFICATION", () => {
    let called = false;
    const err: AppError = { code: "NET_SSL_VERIFICATION", detail: "invalid cert" };
    const result = handleError(err, { onOpenSettings: () => { called = true; } });
    expect(result.action).toBeDefined();
    result.action!.onClick();
    expect(called).toBe(true);
  });
});

describe("parseAppError", () => {
  it("parses AppError object", () => {
    const err: AppError = { code: "INTERNAL", detail: "bug" };
    const result = parseAppError(err);
    expect(result).toEqual(err);
  });

  it("parses serialized AppError JSON string", () => {
    const result = parseAppError(JSON.parse('{"code":"NOT_FOUND","detail":"missing"}'));
    expect(result!.code).toBe("NOT_FOUND");
    expect(result!.detail).toBe("missing");
  });

  it("returns null for malformed string", () => {
    const result = parseAppError("not json");
    expect(result).toBeNull();
  });

  it("returns null for object without code field", () => {
    const result = parseAppError({ detail: "test" });
    expect(result).toBeNull();
  });

  it("returns null for null input", () => {
    const result = parseAppError(null);
    expect(result).toBeNull();
  });
});

describe("isRetryableError", () => {
  it("returns true for NET_TIMEOUT", () => {
    expect(isRetryableError("NET_TIMEOUT")).toBe(true);
  });

  it("returns true for NET_CONNECT_FAILED", () => {
    expect(isRetryableError("NET_CONNECT_FAILED")).toBe(true);
  });

  it("returns true for NET_DNS_ERROR", () => {
    expect(isRetryableError("NET_DNS_ERROR")).toBe(true);
  });

  it("returns false for NET_SSL_VERIFICATION", () => {
    expect(isRetryableError("NET_SSL_VERIFICATION")).toBe(false);
  });

  it("returns false for NET_AUTH_FAILED", () => {
    expect(isRetryableError("NET_AUTH_FAILED")).toBe(false);
  });

  it("returns false for unknown code", () => {
    expect(isRetryableError("UNKNOWN_CODE")).toBe(false);
  });

  it("returns false for NET_BODY_TOO_LARGE", () => {
    expect(isRetryableError("NET_BODY_TOO_LARGE")).toBe(false);
  });
});

describe("isNetworkError", () => {
  it("returns true for NET_CONNECT_FAILED", () => {
    expect(isNetworkError("NET_CONNECT_FAILED")).toBe(true);
  });

  it("returns true for NET_TIMEOUT", () => {
    expect(isNetworkError("NET_TIMEOUT")).toBe(true);
  });

  it("returns true for NET_DNS_ERROR", () => {
    expect(isNetworkError("NET_DNS_ERROR")).toBe(true);
  });

  it("returns false for STORAGE_NOT_FOUND", () => {
    expect(isNetworkError("STORAGE_NOT_FOUND")).toBe(false);
  });

  it("returns false for SCRIPT_ERROR", () => {
    expect(isNetworkError("SCRIPT_ERROR")).toBe(false);
  });
});

describe("categorizeError", () => {
  it("categorizes NET_CONNECT_FAILED as network", () => {
    expect(categorizeError("NET_CONNECT_FAILED")).toBe("network");
  });

  it("categorizes STORAGE_READ_FAILED as storage", () => {
    expect(categorizeError("STORAGE_READ_FAILED")).toBe("storage");
  });

  it("categorizes SCRIPT_ERROR as script", () => {
    expect(categorizeError("SCRIPT_ERROR")).toBe("script");
  });

  it("categorizes VAULT_LOCKED as vault", () => {
    expect(categorizeError("VAULT_LOCKED")).toBe("vault");
  });

  it("categorizes VALIDATION_FAILED as validation", () => {
    expect(categorizeError("VALIDATION_FAILED")).toBe("validation");
  });

  it("categorizes MOCK_START_FAILED as mock", () => {
    expect(categorizeError("MOCK_START_FAILED")).toBe("mock");
  });

  it("categorizes unknown as general", () => {
    expect(categorizeError("UNKNOWN_ERR")).toBe("general");
  });
});

describe("getErrorMapping", () => {
  it("returns mapping for known code", () => {
    const mapping = getErrorMapping("NET_TIMEOUT");
    expect(mapping.title).toBe("Request Timeout");
    expect(mapping.variant).toBe("error");
    expect(mapping.retryable).toBe(true);
  });

  it("returns fallback for unknown code", () => {
    const mapping = getErrorMapping("FAKE_CODE");
    expect(mapping.title).toBe("Error");
    expect(mapping.variant).toBe("error");
    expect(mapping.retryable).toBe(false);
  });

  it("all known error codes have mappings", () => {
    const knownCodes = [
      "NET_CONNECT_FAILED", "NET_TIMEOUT", "NET_REQUEST_CANCELLED",
      "NET_DNS_ERROR", "NET_TLS_ERROR", "NET_SSL_VERIFICATION",
      "NET_REDIRECT_LIMIT", "NET_BODY_TOO_LARGE", "NET_INVALID_URL",
      "NET_AUTH_FAILED",
      "STORAGE_READ_FAILED", "STORAGE_WRITE_FAILED", "STORAGE_NOT_FOUND",
      "STORAGE_PATH_TRAVERSAL", "STORAGE_PARSE_FAILED", "STORAGE_FILE_TOO_LARGE",
      "SCRIPT_TIMEOUT", "SCRIPT_ERROR", "SCRIPT_MEMORY_LIMIT",
      "VAULT_LOCKED", "VAULT_UNLOCK_FAILED", "VAULT_ENCRYPT_FAILED",
      "VAULT_DECRYPT_FAILED", "VAULT_KEYRING_FAILED",
      "VALIDATION_FAILED", "INVALID_INPUT",
      "MOCK_START_FAILED", "MOCK_NOT_RUNNING",
      "NOT_FOUND", "NOT_IMPLEMENTED", "INTERNAL",
    ];
    for (const code of knownCodes) {
      const mapping = getErrorMapping(code);
      expect(mapping.title).toBeDefined();
      expect(mapping.variant).toBeDefined();
      expect(mapping.category).toBeDefined();
      expect(typeof mapping.retryable).toBe("boolean");
    }
  });
});