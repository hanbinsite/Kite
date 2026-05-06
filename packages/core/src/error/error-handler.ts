import type { AppError } from "@api-client/types";
import { getErrorMapping, parseAppError } from "./error-messages";

export { getErrorMapping, parseAppError, isRetryableError, categorizeError, isNetworkError } from "./error-messages";
export type { ErrorMapping, ErrorCategory } from "./error-messages";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface HandledError {
  title: string;
  description: string;
  variant: ToastVariant;
  retryable: boolean;
  action?: { label: string; onClick: () => void };
  originalError: AppError | null;
}

export function handleError(
  err: unknown,
  options?: {
    onRetry?: () => void;
    onOpenSettings?: () => void;
    onEditAuth?: () => void;
  },
): HandledError {
  const appError = parseAppError(err);
  if (!appError) {
    const message = typeof err === "string" ? err : "An unexpected error occurred";
    return {
      title: "Error",
      description: message,
      variant: "error",
      retryable: false,
      originalError: null,
    };
  }

  const mapping = getErrorMapping(appError.code);
  const action: HandledError["action"] = mapping.action
    ? {
        label: mapping.action.label,
        onClick:
          mapping.action.handler === "retry" && options?.onRetry
            ? options.onRetry
            : mapping.action.handler === "openSettings" && options?.onOpenSettings
              ? options.onOpenSettings
              : mapping.action.handler === "editAuth" && options?.onEditAuth
                ? options.onEditAuth
                : () => {},
      }
    : undefined;

  return {
    title: mapping.title,
    description: appError.detail || mapping.description,
    variant: mapping.variant,
    retryable: mapping.retryable,
    action,
    originalError: appError,
  };
}
