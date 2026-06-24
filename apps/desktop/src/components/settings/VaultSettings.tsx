import { useState, useEffect } from "react";
import { Lock, Unlock, Trash2, Plus, Loader2, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useVaultStore } from "../../stores/vault-store";
import { ConfirmDialog } from "../shared/ConfirmDialog";

export function VaultSettings() {
  const { t } = useTranslation();
  const unlocked = useVaultStore((s) => s.unlocked);
  const secrets = useVaultStore((s) => s.secrets);
  const loading = useVaultStore((s) => s.loading);
  const error = useVaultStore((s) => s.error);
  const checkStatus = useVaultStore((s) => s.checkStatus);
  const lock = useVaultStore((s) => s.lock);
  const refreshSecrets = useVaultStore((s) => s.refreshSecrets);
  const addSecret = useVaultStore((s) => s.addSecret);
  const removeSecret = useVaultStore((s) => s.removeSecret);
  const clearError = useVaultStore((s) => s.clearError);

  const [password, setPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteSecretName, setDeleteSecretName] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (unlocked) refreshSecrets();
  }, [unlocked, refreshSecrets]);

  const handleUnlock = async () => {
    if (!password) return;
    const { unlock } = useVaultStore.getState();
    const ok = await unlock(password);
    if (ok) setPassword("");
  };

  const handleLock = async () => {
    await lock();
    setPassword("");
    setShowAddForm(false);
  };

  const handleAddSecret = async () => {
    if (!newName || !newValue) return;
    const ok = await addSecret(newName, newValue);
    if (ok) {
      setNewName("");
      setNewValue("");
      setShowAddForm(false);
    }
  };

  const handleDeleteSecret = async (name: string) => {
    setDeleteSecretName(name);
  };

  const formatDate = (iso: string) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-sans text-md font-semibold text-fg-primary">{t("vault.title")}</h3>
        <span
          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
            unlocked
              ? "bg-accent-success/15 text-accent-success"
              : "bg-accent-danger/15 text-accent-danger"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${unlocked ? "bg-accent-success" : "bg-accent-danger"}`} />
          {unlocked ? t("vault.unlocked") : t("vault.locked")}
        </span>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 h-8 px-3 mb-3 rounded-md bg-accent-danger/10 border border-accent-danger/20">
          <span className="text-[11px] text-accent-danger truncate">{error}</span>
          <button
            onClick={clearError}
            className="text-[10px] text-accent-danger/70 hover:text-accent-danger cursor-pointer shrink-0"
          >
            {t("common.close")}
          </button>
        </div>
      )}

      {!unlocked ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-fg-secondary text-[12px] font-sans">
            <Lock className="w-3.5 h-3.5" />
            <span>{t("vault.vaultLockedHint")}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && password && handleUnlock()}
              placeholder={t("vault.passwordPlaceholder")}
              className="flex-1 h-8 px-3 bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none transition-[border-color] duration-[100ms] placeholder:text-fg-tertiary focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)]"
            />
            <button
              onClick={handleUnlock}
              disabled={!password || loading}
              className="h-8 px-4 rounded-md bg-brand text-white text-[12px] font-medium cursor-pointer hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t("vault.unlock")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-accent-success text-[12px] font-sans">
              <Unlock className="w-3.5 h-3.5" />
              <span>{t("vault.unlocked")}</span>
            </div>
            <button
              onClick={handleLock}
              className="h-8 px-3 rounded-md border border-border-muted font-sans text-[12px] font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-hover cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              {t("vault.lock")}
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-sans text-[13px] font-medium text-fg-primary">{t("vault.secrets")}</span>
              <button
                onClick={() => setShowAddForm((v) => !v)}
                className="h-7 px-2 rounded-md text-[11px] text-brand hover:bg-brand-muted cursor-pointer transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                {t("vault.addSecret")}
              </button>
            </div>

            {showAddForm && (
              <div className="border border-brand/30 bg-brand/5 rounded-md p-3 space-y-2 mb-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("vault.secretName")}
                  className="w-full h-8 px-3 bg-bg-input border border-border-muted rounded-md font-sans text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary"
                />
                <input
                  type="password"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={t("vault.secretValue")}
                  className="w-full h-8 px-3 bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddSecret}
                    disabled={!newName || !newValue || loading}
                    className="h-7 px-3 rounded-md bg-brand text-white text-[11px] font-medium cursor-pointer hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                    {t("common.save")}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewName("");
                      setNewValue("");
                    }}
                    className="h-7 px-2 rounded-md text-fg-tertiary text-[11px] cursor-pointer hover:text-fg-primary transition-colors"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            )}

            <div className="border border-border-muted rounded-md overflow-hidden">
              {secrets.length === 0 ? (
                <div className="flex items-center justify-center h-[60px] text-fg-tertiary text-[12px] gap-2">
                  <Shield className="w-3.5 h-3.5 opacity-50" />
                  {t("vault.noSecrets")}
                </div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-bg-elevated text-fg-tertiary">
                      <th className="text-left px-2 py-1 font-semibold">{t("vault.secretName")}</th>
                      <th className="text-left px-2 py-1 font-semibold">{t("common.expires")}</th>
                      <th className="w-[30px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {secrets.map((s) => (
                      <tr key={s.name} className="border-t border-border-muted">
                        <td className="px-2 py-1 font-mono text-fg-primary truncate max-w-[160px]">{s.name}</td>
                        <td className="px-2 py-1 font-mono text-fg-tertiary">{formatDate(s.createdAt)}</td>
                        <td className="px-2 py-1">
                          <button
                            onClick={() => handleDeleteSecret(s.name)}
                            className="p-0.5 rounded hover:bg-bg-hover text-fg-tertiary hover:text-accent-danger cursor-pointer transition-colors"
                            title={t("common.delete")}
                          >
                            <Trash2 size={10} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

    <ConfirmDialog
      open={deleteSecretName !== null}
      onOpenChange={(open) => { if (!open) setDeleteSecretName(null); }}
      title={t("vault.deleteSecret")}
      description={t("vault.deleteSecretConfirm")}
      confirmLabel={t("common.delete")}
      variant="danger"
      onConfirm={async () => {
        if (deleteSecretName) {
          await removeSecret(deleteSecretName);
          setDeleteSecretName(null);
        }
      }}
      onCancel={() => setDeleteSecretName(null)}
    />
    </div>
  );
}
