import { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Lock, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useVaultStore } from "../../stores/vault-store";

interface VaultUnlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked?: () => void;
}

export function VaultUnlockDialog({ open, onOpenChange, onUnlocked }: VaultUnlockDialogProps) {
  const { t } = useTranslation();
  const unlock = useVaultStore((s) => s.unlock);
  const loading = useVaultStore((s) => s.loading);
  const error = useVaultStore((s) => s.error);
  const clearError = useVaultStore((s) => s.clearError);

  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPassword("");
      clearError();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, clearError]);

  const handleUnlock = async () => {
    if (!password) return;
    const ok = await unlock(password);
    if (ok) {
      onOpenChange(false);
      onUnlocked?.();
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) clearError();
    onOpenChange(next);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-modal animate-fade-in" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-w-[95vw] bg-bg-surface border border-border-default rounded-xl shadow-lg flex flex-col overflow-hidden"
          style={{ zIndex: 420 }}
        >
          <div className="flex items-center h-12 px-5 border-b border-border-muted shrink-0">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-brand" />
              <Dialog.Title className="font-sans text-base font-semibold text-fg-primary">
                {t("vault.title")}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                className="ml-auto w-7 h-7 flex items-center justify-center rounded-sm text-fg-tertiary cursor-pointer transition-all duration-50 hover:bg-bg-hover hover:text-fg-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-5 flex flex-col gap-4">
            <p className="font-sans text-[12px] text-fg-secondary">
              {t("vault.passwordPlaceholder")}
            </p>

            <div className="flex flex-col gap-2">
              <label className="font-sans text-[11px] font-semibold text-fg-secondary">
                {t("vault.password")}
              </label>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) clearError();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading && password) handleUnlock();
                }}
                placeholder={t("vault.passwordPlaceholder")}
                className="w-full h-9 px-3 bg-bg-input border border-border-muted rounded-md font-mono text-[13px] text-fg-primary outline-none transition-[border-color] duration-[100ms] placeholder:text-fg-tertiary focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)]"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 h-8 px-3 rounded-md bg-accent-danger/10 border border-accent-danger/20">
                <span className="text-[11px] text-accent-danger">{t("vault.wrongPassword")}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 h-14 px-5 border-t border-border-muted shrink-0">
            <button
              onClick={() => onOpenChange(false)}
              className="h-8 px-4 rounded-md font-sans text-[13px] font-medium text-fg-secondary hover:bg-bg-hover cursor-pointer transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleUnlock}
              disabled={!password || loading}
              className="h-8 px-4 rounded-md font-sans text-[13px] font-medium text-white bg-brand hover:bg-brand-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t("vault.unlock")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
