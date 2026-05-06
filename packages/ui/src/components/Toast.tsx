import { useState, useCallback, useRef, useEffect } from "react";
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const VARIANT_STYLES: Record<ToastVariant, { icon: typeof CheckCircle2; border: string; iconColor: string }> = {
  success: { icon: CheckCircle2, border: "border-accent-success", iconColor: "text-accent-success" },
  error: { icon: AlertCircle, border: "border-accent-danger", iconColor: "text-accent-danger" },
  warning: { icon: AlertTriangle, border: "border-accent-warning", iconColor: "text-accent-warning" },
  info: { icon: Info, border: "border-accent-info", iconColor: "text-accent-info" },
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { icon: Icon, border, iconColor } = VARIANT_STYLES[toast.variant];
  const duration = toast.duration ?? (toast.variant === "error" ? 8000 : 4000);

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  return (
    <div
      className={`toast-item flex items-start gap-3 w-[360px] p-3 bg-bg-elevated border ${border} border-l-[3px] rounded-md shadow-lg animate-in slide-in-from-right duration-200`}
      role="alert"
    >
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="font-sans text-[12px] font-semibold text-fg-primary leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="font-sans text-[11px] text-fg-secondary mt-1 leading-snug">{toast.description}</p>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="font-sans text-[11px] font-semibold text-brand mt-1.5 hover:underline cursor-pointer"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-0.5 text-fg-tertiary hover:text-fg-secondary cursor-pointer transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export interface ToastContextValue {
  addToast: (toast: Omit<Toast, "id">) => string;
  dismissToast: (id: string) => void;
  toasts: Toast[];
}

let toastContextValue: ToastContextValue | null = null;

export function getToastContext(): ToastContextValue {
  if (!toastContextValue) {
    throw new Error("ToastProvider not mounted");
  }
  return toastContextValue;
}

export function toast(opts: Omit<Toast, "id">): string {
  return getToastContext().addToast(opts);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((opts: Omit<Toast, "id">): string => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { ...opts, id }]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    toastContextValue = { addToast, dismissToast, toasts };
  }, [addToast, dismissToast, toasts]);

  return (
    <ToastContext.Provider value={{ addToast, dismissToast, toasts }}>
      {children}
      <div className="toast-container fixed top-4 right-4 z-toast flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

import { createContext, useContext } from "react";

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
