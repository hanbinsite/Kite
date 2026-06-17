import { describe, it, expect } from "vitest";
import {
  getErrorMapping,
  categorizeError,
  isRetryableError,
  isNetworkError,
  parseAppError,
} from "./error-messages";

describe("error-messages", () => {
  const ALL_CODES = [
    "NET_CONNECT_FAILED", "NET_TIMEOUT", "NET_REQUEST_CANCELLED", "NET_DNS_ERROR",
    "NET_TLS_ERROR", "NET_SSL_VERIFICATION", "NET_REDIRECT_LIMIT", "NET_BODY_TOO_LARGE",
    "NET_INVALID_URL", "NET_AUTH_FAILED",
    "STORAGE_READ_FAILED", "STORAGE_WRITE_FAILED", "STORAGE_NOT_FOUND",
    "STORAGE_PATH_TRAVERSAL", "STORAGE_PARSE_FAILED", "STORAGE_FILE_TOO_LARGE",
    "SCRIPT_TIMEOUT", "SCRIPT_ERROR", "SCRIPT_MEMORY_LIMIT",
    "VAULT_LOCKED", "VAULT_UNLOCK_FAILED", "VAULT_ENCRYPT_FAILED", "VAULT_DECRYPT_FAILED",
    "VALIDATION_FAILED", "INVALID_INPUT",
    "MOCK_START_FAILED", "MOCK_NOT_RUNNING",
    "NOT_IMPLEMENTED", "INTERNAL",
  ];

  describe("getErrorMapping", () => {
    it("returns a valid mapping for all 28 known error codes", () => {
      for (const code of ALL_CODES) {
        const mapping = getErrorMapping(code);
        expect(mapping.title).toBeTruthy();
        expect(mapping.description).toBeTruthy();
        expect(["success", "error", "warning", "info"]).toContain(mapping.variant);
        expect(typeof mapping.retryable).toBe("boolean");
        expect(["network", "storage", "script", "vault", "validation", "mock", "general"]).toContain(mapping.category);
      }
    });

    it("returns fallback for unknown code", () => {
      const mapping = getErrorMapping("UNKNOWN_CODE");
      expect(mapping.title).toBe("Error");
      expect(mapping.description).toBe("An unknown error occurred.");
      expect(mapping.variant).toBe("error");
      expect(mapping.category).toBe("general");
      expect(mapping.retryable).toBe(false);
    });

    it("NET_CONNECT_FAILED has retry action", () => {
      const m = getErrorMapping("NET_CONNECT_FAILED");
      expect(m.action?.handler).toBe("retry");
      expect(m.retryable).toBe(true);
    });

    it("NET_TIMEOUT has retry action", () => {
      const m = getErrorMapping("NET_TIMEOUT");
      expect(m.action?.handler).toBe("retry");
    });

    it("NET_REQUEST_CANCELLED has retry action", () => {
      const m = getErrorMapping("NET_REQUEST_CANCELLED");
      expect(m.action?.handler).toBe("retry");
    });

    it("NET_SSL_VERIFICATION has openSettings action", () => {
      const m = getErrorMapping("NET_SSL_VERIFICATION");
      expect(m.action?.handler).toBe("openSettings");
    });

    it("NET_AUTH_FAILED has editAuth action", () => {
      const m = getErrorMapping("NET_AUTH_FAILED");
      expect(m.action?.handler).toBe("editAuth");
    });
  });

  describe("categorizeError", () => {
    it("categorizes NET_ codes as network", () => {
      expect(categorizeError("NET_CONNECT_FAILED")).toBe("network");
      expect(categorizeError("NET_TIMEOUT")).toBe("network");
      expect(categorizeError("NET_BODY_TOO_LARGE")).toBe("network");
    });

    it("categorizes STORAGE_ codes as storage", () => {
      expect(categorizeError("STORAGE_READ_FAILED")).toBe("storage");
      expect(categorizeError("STORAGE_NOT_FOUND")).toBe("storage");
    });

    it("categorizes SCRIPT_ codes as script", () => {
      expect(categorizeError("SCRIPT_TIMEOUT")).toBe("script");
      expect(categorizeError("SCRIPT_ERROR")).toBe("script");
    });

    it("categorizes VAULT_ codes as vault", () => {
      expect(categorizeError("VAULT_LOCKED")).toBe("vault");
      expect(categorizeError("VAULT_DECRYPT_FAILED")).toBe("vault");
    });

    it("categorizes VALIDATION_ and INVALID_INPUT as validation", () => {
      expect(categorizeError("VALIDATION_FAILED")).toBe("validation");
      expect(categorizeError("INVALID_INPUT")).toBe("validation");
    });

    it("categorizes MOCK_ codes as mock", () => {
      expect(categorizeError("MOCK_START_FAILED")).toBe("mock");
    });

    it("categorizes unknown codes as general", () => {
      expect(categorizeError("NOT_IMPLEMENTED")).toBe("general");
      expect(categorizeError("INTERNAL")).toBe("general");
      expect(categorizeError("SOMETHING_WEIRD")).toBe("general");
    });
  });

  describe("isRetryableError", () => {
    it("retryable error codes", () => {
      expect(isRetryableError("NET_CONNECT_FAILED")).toBe(true);
      expect(isRetryableError("NET_TIMEOUT")).toBe(true);
      expect(isRetryableError("STORAGE_WRITE_FAILED")).toBe(true);
      expect(isRetryableError("VAULT_UNLOCK_FAILED")).toBe(true);
    });

    it("non-retryable error codes", () => {
      expect(isRetryableError("NET_TLS_ERROR")).toBe(false);
      expect(isRetryableError("SCRIPT_TIMEOUT")).toBe(false);
      expect(isRetryableError("STORAGE_NOT_FOUND")).toBe(false);
    });
  });

  describe("isNetworkError", () => {
    it("returns true for network codes", () => {
      expect(isNetworkError("NET_CONNECT_FAILED")).toBe(true);
      expect(isNetworkError("NET_DNS_ERROR")).toBe(true);
    });

    it("returns false for non-network codes", () => {
      expect(isNetworkError("STORAGE_READ_FAILED")).toBe(false);
      expect(isNetworkError("VAULT_LOCKED")).toBe(false);
    });
  });

  describe("parseAppError", () => {
    it("parses object with code and detail", () => {
      const result = parseAppError({ code: "INTERNAL", detail: "boom" });
      expect(result).toEqual({ code: "INTERNAL", detail: "boom" });
    });

    it("returns null for non-objects", () => {
      expect(parseAppError("string")).toBeNull();
      expect(parseAppError(null)).toBeNull();
      expect(parseAppError(undefined)).toBeNull();
      expect(parseAppError(42)).toBeNull();
    });

    it("returns null for objects missing code or detail", () => {
      expect(parseAppError({})).toBeNull();
      expect(parseAppError({ code: "X" })).toBeNull();
      expect(parseAppError({ detail: "y" })).toBeNull();
    });
  });
});