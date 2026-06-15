import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
  onCancel,
  secondaryLabel,
  onSecondary,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const resolvedConfirmLabel = confirmLabel ?? t("common.confirm");
  const resolvedCancelLabel = cancelLabel ?? t("common.cancel");
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => confirmRef.current?.focus(), 50);
    }
  }, [open]);

  const confirmBtnClass =
    variant === "danger"
      ? "bg-accent-danger hover:bg-accent-danger/90 text-white"
      : variant === "warning"
        ? "bg-accent-warning hover:bg-accent-warning/90 text-bg-base"
        : "bg-brand hover:bg-brand-hover text-white";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-modal animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-bg-elevated border border-border-default rounded-xl shadow-xl z-modal p-6 animate-fade-in">
          <div className="flex items-start justify-between mb-4">
            <Dialog.Title className="font-sans text-[15px] font-semibold text-fg-primary">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="font-sans text-[13px] text-fg-secondary leading-snug mb-6">
            {description}
          </Dialog.Description>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                onCancel();
                onOpenChange(false);
              }}
              className="h-[32px] px-4 rounded-md font-sans text-[13px] font-medium text-fg-secondary bg-bg-hover hover:bg-bg-active cursor-pointer transition-colors"
            >
              {resolvedCancelLabel}
            </button>
            {secondaryLabel && onSecondary && (
              <button
                onClick={() => {
                  onSecondary();
                  onOpenChange(false);
                }}
                className="h-[32px] px-4 rounded-md font-sans text-[13px] font-medium text-white bg-brand hover:bg-brand-hover cursor-pointer transition-colors"
              >
                {secondaryLabel}
              </button>
            )}
            <button
              ref={confirmRef}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={`h-[32px] px-4 rounded-md font-sans text-[13px] font-medium cursor-pointer transition-colors ${confirmBtnClass}`}
            >
              {resolvedConfirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
