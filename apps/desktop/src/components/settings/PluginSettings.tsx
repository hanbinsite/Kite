import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Pencil, Puzzle, AlertCircle, Loader2, PackagePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { usePluginStore } from "../../stores/plugin-store";
import type { PluginInfo } from "@api-client/core/plugin";
import { PluginCodeEditor } from "./PluginCodeEditor";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-sans text-md font-semibold text-fg-primary mb-4">{children}</h3>;
}

export function PluginSettings() {
  const { t } = useTranslation();
  const plugins = usePluginStore((s) => s.plugins);
  const loading = usePluginStore((s) => s.loading);
  const loadPlugins = usePluginStore((s) => s.loadPlugins);
  const installPlugin = usePluginStore((s) => s.installPlugin);
  const uninstallPlugin = usePluginStore((s) => s.uninstallPlugin);
  const togglePlugin = usePluginStore((s) => s.togglePlugin);

  const [editingPlugin, setEditingPlugin] = useState<PluginInfo | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uninstallConfirmId, setUninstallConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  const handleInstall = useCallback(async () => {
    setBusy(true);
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: t("plugins.selectZip"), extensions: ["zip"] }],
      });
      if (typeof selected === "string" && selected) {
        await installPlugin(selected);
      }
    } finally {
      setBusy(false);
    }
  }, [installPlugin, t]);

  const handleToggle = useCallback(
    async (plugin: PluginInfo, enabled: boolean) => {
      await togglePlugin(plugin.manifest.id, enabled);
    },
    [togglePlugin],
  );

  const handleUninstall = useCallback(
    async (id: string) => {
      await uninstallPlugin(id);
      setUninstallConfirmId(null);
    },
    [uninstallPlugin],
  );

  const handleCreated = useCallback((plugin: PluginInfo) => {
    setShowCreate(false);
    setEditingPlugin(plugin);
  }, []);

  if (editingPlugin) {
    return <PluginCodeEditor plugin={editingPlugin} onClose={() => setEditingPlugin(null)} />;
  }

  return (
    <div className="mb-6">
      <SectionTitle>{t("plugins.title")}</SectionTitle>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleInstall}
          disabled={busy}
          className="h-8 px-3 rounded-md bg-brand text-white text-[12px] font-medium cursor-pointer hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackagePlus className="w-3.5 h-3.5" />}
          {t("plugins.install")}
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="h-8 px-3 rounded-md border border-border-muted text-fg-secondary text-[12px] font-medium cursor-pointer hover:border-brand hover:text-brand transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          {t("plugins.create")}
        </button>
      </div>

      {loading && plugins.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 text-fg-tertiary animate-spin" />
        </div>
      ) : plugins.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
          <Puzzle className="w-8 h-8 text-fg-tertiary mb-1" />
          <div className="font-sans text-[13px] text-fg-secondary">{t("plugins.noPlugins")}</div>
          <div className="font-sans text-[11px] text-fg-tertiary max-w-[320px]">{t("plugins.noPluginsHint")}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {plugins.map((plugin) => (
            <PluginRow
              key={plugin.manifest.id}
              plugin={plugin}
              onToggle={(enabled) => handleToggle(plugin, enabled)}
              onEdit={() => setEditingPlugin(plugin)}
              onUninstall={() => setUninstallConfirmId(plugin.manifest.id)}
              uninstallConfirmId={uninstallConfirmId}
              onConfirmUninstall={() => handleUninstall(plugin.manifest.id)}
              onCancelUninstall={() => setUninstallConfirmId(null)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePluginForm onSave={handleCreated} onCancel={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function PluginRow({
  plugin,
  onToggle,
  onEdit,
  onUninstall,
  uninstallConfirmId,
  onConfirmUninstall,
  onCancelUninstall,
}: {
  plugin: PluginInfo;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onUninstall: () => void;
  uninstallConfirmId: string | null;
  onConfirmUninstall: () => void;
  onCancelUninstall: () => void;
}) {
  const { t } = useTranslation();
  const { manifest, enabled, hasError, error } = plugin;
  const isConfirming = uninstallConfirmId === manifest.id;

  return (
    <div
      className={`rounded-md border transition-colors overflow-hidden ${
        hasError ? "border-accent-danger/40" : "border-border-muted hover:bg-bg-hover"
      }`}
    >
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {hasError && (
              <AlertCircle className="w-3.5 h-3.5 text-accent-danger shrink-0" />
            )}
            <span className="font-sans text-[13px] font-medium text-fg-primary truncate">{manifest.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-fg-tertiary shrink-0 font-mono">
              v{manifest.version}
            </span>
            {manifest.author && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-fg-tertiary shrink-0">
                {manifest.author}
              </span>
            )}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                enabled ? "bg-accent-success/15 text-accent-success" : "bg-bg-elevated text-fg-tertiary"
              }`}
            >
              {enabled ? t("plugins.enabled") : t("plugins.disabled")}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onToggle(!enabled)}
              role="switch"
              aria-checked={enabled}
              className={`relative w-9 h-5 rounded-[10px] cursor-pointer transition-[background] duration-[180ms] shrink-0 ${
                enabled ? "bg-brand" : "bg-bg-active"
              }`}
            >
              <span
                className={`absolute top-[2px] w-4 h-4 rounded-full transition-[left,background] duration-[180ms] ${
                  enabled ? "left-[18px] bg-white" : "left-[2px] bg-fg-secondary"
                }`}
              />
            </button>
            <button
              onClick={onEdit}
              className="h-6 px-2 rounded text-[10px] text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover cursor-pointer transition-colors flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              {t("plugins.editCode")}
            </button>
            {isConfirming ? (
              <>
                <button
                  onClick={onConfirmUninstall}
                  className="h-6 px-2 rounded text-[10px] text-white bg-accent-danger cursor-pointer transition-colors"
                >
                  {t("common.confirm")}
                </button>
                <button
                  onClick={onCancelUninstall}
                  onBlur={onCancelUninstall}
                  className="h-6 px-2 rounded text-[10px] text-fg-tertiary hover:text-fg-primary cursor-pointer transition-colors"
                >
                  {t("common.cancel")}
                </button>
              </>
            ) : (
              <button
                onClick={onUninstall}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-bg-hover text-fg-tertiary hover:text-accent-danger cursor-pointer transition-colors"
                title={t("plugins.uninstall")}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {manifest.description && (
          <div className="font-sans text-[11px] text-fg-secondary">{manifest.description}</div>
        )}

        {(manifest.permissions.length > 0 || manifest.hooks.length > 0 || manifest.commands.length > 0) && (
          <div className="flex flex-col gap-1.5 pt-1">
            {manifest.hooks.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-fg-tertiary shrink-0">{t("plugins.hooks")}:</span>
                {manifest.hooks.map((h) => (
                  <span key={h} className="text-[10px] px-1.5 py-0.5 rounded bg-brand-muted text-brand font-mono">
                    {h}
                  </span>
                ))}
              </div>
            )}
            {manifest.permissions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-fg-tertiary shrink-0">{t("plugins.permissions")}:</span>
                {manifest.permissions.map((p) => (
                  <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-accent-warning/15 text-accent-warning font-mono">
                    {p}
                  </span>
                ))}
              </div>
            )}
            {manifest.commands.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-fg-tertiary shrink-0">{t("plugins.commands")}:</span>
                {manifest.commands.map((c) => (
                  <span key={c.id} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-fg-secondary font-mono">
                    {c.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {hasError && error && (
          <div className="flex items-start gap-1.5 mt-1 text-accent-danger">
            <AlertCircle className="w-3 h-3 shrink-0 mt-[1px]" />
            <span className="font-sans text-[11px] break-all">
              {t("plugins.error")}: {error}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const TEMPLATE_CODE = `// Plugin entry point
// Hooks: onRequest, onResponse, onCommand
// Available API: pm.variables, pm.request, pm.response

function onRequest(context) {
  console.log("onRequest hook called", context.event);
  return context.data;
}

function onResponse(context) {
  console.log("onResponse hook called", context.event);
  return context.data;
}

function onCommand(context) {
  console.log("onCommand hook called", context.event);
  return { ok: true };
}
`;

function CreatePluginForm({
  onSave,
  onCancel,
}: {
  onSave: (plugin: PluginInfo) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSubmitting(true);
    setError(null);
    try {
      const id = `plugin-${Date.now()}`;
      const code = TEMPLATE_CODE;
      const manifest = {
        id,
        name: name.trim(),
        version: "0.1.0",
        description: description.trim(),
        author: author.trim() || undefined,
        entry: "index.js",
        permissions: [],
        hooks: ["onRequest", "onResponse", "onCommand"],
        commands: [],
      };
      const { pluginSaveCode } = await import("@api-client/core/plugin");
      await pluginSaveCode(id, code);
      onSave({ manifest, enabled: false, hasError: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-brand/30 bg-brand/5 rounded-md p-3 space-y-3">
      <div className="text-[11px] text-fg-tertiary">{t("plugins.createHint")}</div>
      <div>
        <label className="font-sans text-[11px] text-fg-tertiary mb-1 block">{t("plugins.createName")}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("plugins.createName")}
          className="w-full h-8 px-3 bg-bg-input border border-border-muted rounded-md text-[13px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary"
          autoFocus
        />
      </div>
      <div>
        <label className="font-sans text-[11px] text-fg-tertiary mb-1 block">{t("plugins.createDescription")}</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("plugins.createDescription")}
          className="w-full h-8 px-3 bg-bg-input border border-border-muted rounded-md text-[13px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary"
        />
      </div>
      <div>
        <label className="font-sans text-[11px] text-fg-tertiary mb-1 block">{t("plugins.createAuthor")}</label>
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder={t("plugins.createAuthor")}
          className="w-full h-8 px-3 bg-bg-input border border-border-muted rounded-md text-[13px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary"
        />
      </div>
      {error && (
        <div className="flex items-start gap-1.5 text-accent-danger">
          <AlertCircle className="w-3 h-3 shrink-0 mt-[1px]" />
          <span className="font-sans text-[11px] break-all">{error}</span>
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!canSave || submitting}
          className="h-8 px-4 rounded-md bg-brand text-white text-[12px] font-medium cursor-pointer hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t("common.loading") : t("plugins.create")}
        </button>
        <button
          onClick={onCancel}
          className="h-8 px-3 rounded-md text-fg-tertiary text-[12px] cursor-pointer hover:text-fg-primary transition-colors"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
