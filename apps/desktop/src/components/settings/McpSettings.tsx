import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Pencil, Plug, PlugZap, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMcpExternalStore } from "../../stores/mcp-external-store";
import type { McpServerConfig, McpTransport } from "@api-client/core/ai/mcp-external";
import { ConfirmDialog } from "../shared/ConfirmDialog";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-sans text-md font-semibold text-fg-primary mb-4">{children}</h3>;
}

function newId() {
  return `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function McpSettings() {
  const { t } = useTranslation();
  const servers = useMcpExternalStore((s) => s.servers);
  const statuses = useMcpExternalStore((s) => s.statuses);
  const loadServers = useMcpExternalStore((s) => s.loadServers);
  const deleteServer = useMcpExternalStore((s) => s.deleteServer);
  const connectServer = useMcpExternalStore((s) => s.connectServer);
  const disconnectServer = useMcpExternalStore((s) => s.disconnectServer);

  const [editing, setEditing] = useState<McpServerConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteServerId, setDeleteServerId] = useState<string | null>(null);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const handleAdd = useCallback(() => {
    setEditing(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((server: McpServerConfig) => {
    setEditing(server);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleteServerId(id);
    },
    [],
  );

  const handleToggleConnect = useCallback(
    async (server: McpServerConfig) => {
      const status = statuses[server.id];
      setBusy(server.id);
      try {
        if (status?.connected) {
          await disconnectServer(server.id);
        } else {
          await connectServer(server.id);
        }
      } finally {
        setBusy(null);
      }
    },
    [statuses, connectServer, disconnectServer],
  );

  const handleTest = useCallback(
    async (server: McpServerConfig) => {
      setBusy(server.id);
      try {
        await connectServer(server.id);
      } finally {
        setBusy(null);
      }
    },
    [connectServer],
  );

  const handleFormSave = useCallback(
    async (config: McpServerConfig) => {
      await useMcpExternalStore.getState().saveServer(config);
      setShowForm(false);
      setEditing(null);
    },
    [],
  );

  const handleFormCancel = useCallback(() => {
    setShowForm(false);
    setEditing(null);
  }, []);

  return (
    <div className="mb-6">
      <SectionTitle>{t("mcp.title")}</SectionTitle>

      {servers.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
          <Plug className="w-8 h-8 text-fg-tertiary mb-1" />
          <div className="font-sans text-[13px] text-fg-secondary">{t("mcp.noServers")}</div>
          <div className="font-sans text-[11px] text-fg-tertiary max-w-[320px]">{t("mcp.noServersHint")}</div>
          <button
            onClick={handleAdd}
            className="mt-3 h-8 px-4 rounded-md bg-brand text-white text-[12px] font-medium cursor-pointer hover:bg-brand-hover transition-colors"
          >
            {t("mcp.addServer")}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 mb-4">
            {servers.map((server) => {
              const status = statuses[server.id];
              const isConnected = !!status?.connected;
              const hasError = !!status?.error && !isConnected;
              const toolCount = server.id in statuses ? statuses[server.id]?.toolCount ?? 0 : 0;
              const transportLabel = server.transport.type === "stdio" ? t("mcp.stdio") : t("mcp.http");
              return (
                <div
                  key={server.id}
                  className="rounded-md border border-border-muted hover:bg-bg-hover transition-colors overflow-hidden"
                >
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isConnected ? "bg-accent-success" : hasError ? "bg-accent-danger" : "bg-fg-tertiary"
                          }`}
                          title={
                            isConnected
                              ? t("mcp.connected")
                              : hasError
                                ? t("mcp.connectionFailed")
                                : t("mcp.disconnected")
                          }
                        />
                        <span className="font-sans text-[13px] font-medium text-fg-primary truncate">{server.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-fg-tertiary shrink-0">
                          {transportLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isConnected && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-success/15 text-accent-success shrink-0">
                            {t("mcp.tools", { count: toolCount })}
                          </span>
                        )}
                        <button
                          onClick={() => handleToggleConnect(server)}
                          disabled={busy === server.id}
                          className="h-6 px-2 rounded text-[10px] text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          title={isConnected ? t("mcp.disconnect") : t("mcp.connect")}
                        >
                          {busy === server.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isConnected ? (
                            <PlugZap className="w-3 h-3" />
                          ) : (
                            <Plug className="w-3 h-3" />
                          )}
                          {isConnected ? t("mcp.disconnected") : t("mcp.connected")}
                        </button>
                        {!isConnected && (
                          <button
                            onClick={() => handleTest(server)}
                            disabled={busy === server.id}
                            className="h-6 px-2 rounded text-[10px] text-fg-tertiary hover:text-fg-primary hover:bg-bg-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t("mcp.testConnection")}
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(server)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-bg-hover text-fg-tertiary hover:text-brand cursor-pointer transition-colors"
                          title={t("common.edit")}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(server.id)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-bg-hover text-fg-tertiary hover:text-accent-danger cursor-pointer transition-colors"
                          title={t("common.delete")}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      {server.transport.type === "stdio" ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-fg-tertiary shrink-0 w-[50px]">{t("mcp.command")}</span>
                            <span className="font-mono text-fg-secondary truncate">{server.transport.command}</span>
                          </div>
                          {server.transport.args.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-fg-tertiary shrink-0 w-[50px]">{t("mcp.args")}</span>
                              <span className="font-mono text-fg-secondary truncate">
                                {server.transport.args.join(" ")}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-fg-tertiary shrink-0 w-[50px]">{t("mcp.url")}</span>
                          <span className="font-mono text-fg-secondary truncate">{server.transport.url}</span>
                        </div>
                      )}
                      {hasError && status?.error && (
                        <div className="flex items-start gap-1.5 mt-1 text-accent-danger">
                          <AlertCircle className="w-3 h-3 shrink-0 mt-[1px]" />
                          <span className="font-sans text-[11px] break-all">{status.error}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {showForm ? (
            <McpServerForm initial={editing} onSave={handleFormSave} onCancel={handleFormCancel} />
          ) : (
            <button
              onClick={handleAdd}
              className="w-full h-9 flex items-center justify-center gap-2 rounded-md border border-dashed border-border-muted text-fg-secondary hover:border-brand hover:text-brand hover:bg-brand-muted transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="font-sans text-[13px] font-medium">{t("mcp.addServer")}</span>
            </button>
          )}
        </>
      )}

    <ConfirmDialog
      open={deleteServerId !== null}
      onOpenChange={(open) => { if (!open) setDeleteServerId(null); }}
      title={t("mcp.deleteConfirm")}
      description={t("mcp.deleteConfirmMessage")}
      confirmLabel={t("common.delete")}
      variant="danger"
      onConfirm={async () => {
        if (deleteServerId) {
          await deleteServer(deleteServerId);
          setDeleteServerId(null);
        }
      }}
      onCancel={() => setDeleteServerId(null)}
    />
    </div>
  );
}

function McpServerForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: McpServerConfig | null;
  onSave: (config: McpServerConfig) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [transportType, setTransportType] = useState<"stdio" | "http">(initial?.transport.type ?? "stdio");
  const [command, setCommand] = useState(initial?.transport.type === "stdio" ? initial.transport.command : "");
  const [args, setArgs] = useState(initial?.transport.type === "stdio" ? initial.transport.args.join(", ") : "");
  const [envText, setEnvText] = useState(
    initial?.transport.type === "stdio" && initial.transport.env
      ? Object.entries(initial.transport.env)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n")
      : "",
  );
  const [url, setUrl] = useState(initial?.transport.type === "http" ? initial.transport.url : "");
  const [headersText, setHeadersText] = useState(
    initial?.transport.type === "http" && initial.transport.headers
      ? initial.transport.headers.map(([k, v]) => `${k}: ${v}`).join("\n")
      : "",
  );
  const [submitting, setSubmitting] = useState(false);

  const canSave =
    name.trim().length > 0 &&
    (transportType === "stdio" ? command.trim().length > 0 : url.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      let transport: McpTransport;
      if (transportType === "stdio") {
        const env = parseEnvVars(envText);
        transport = {
          type: "stdio",
          command: command.trim(),
          args: args
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
          ...(Object.keys(env).length > 0 ? { env } : {}),
        };
      } else {
        const headers = parseHeaders(headersText);
        transport = {
          type: "http",
          url: url.trim(),
          ...(headers.length > 0 ? { headers } : {}),
        };
      }
      const config: McpServerConfig = {
        id: initial?.id ?? newId(),
        name: name.trim(),
        transport,
        enabled: initial?.enabled ?? true,
      };
      await onSave(config);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-brand/30 bg-brand/5 rounded-md p-3 space-y-3">
      <div>
        <label className="font-sans text-[11px] text-fg-tertiary mb-1 block">{t("mcp.serverName")}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("mcp.serverName")}
          className="w-full h-8 px-3 bg-bg-input border border-border-muted rounded-md text-[13px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary"
        />
      </div>

      <div>
        <label className="font-sans text-[11px] text-fg-tertiary mb-1 block">{t("mcp.transportType")}</label>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="transport"
              checked={transportType === "stdio"}
              onChange={() => setTransportType("stdio")}
              className="accent-brand"
            />
            <span className="font-sans text-[12px] text-fg-primary">{t("mcp.stdio")}</span>
            <span className="font-sans text-[10px] text-fg-tertiary">{t("mcp.stdioHint")}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="transport"
              checked={transportType === "http"}
              onChange={() => setTransportType("http")}
              className="accent-brand"
            />
            <span className="font-sans text-[12px] text-fg-primary">{t("mcp.http")}</span>
            <span className="font-sans text-[10px] text-fg-tertiary">{t("mcp.httpHint")}</span>
          </label>
        </div>
      </div>

      {transportType === "stdio" ? (
        <>
          <div>
            <label className="font-sans text-[11px] text-fg-tertiary mb-1 block">{t("mcp.command")}</label>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={t("mcp.commandPlaceholder")}
              className="w-full h-8 px-3 bg-bg-input border border-border-muted rounded-md text-[12px] text-fg-primary font-mono outline-none focus:border-border-focus placeholder:text-fg-tertiary"
            />
          </div>
          <div>
            <label className="font-sans text-[11px] text-fg-tertiary mb-1 block">{t("mcp.args")}</label>
            <input
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder={t("mcp.argsPlaceholder")}
              className="w-full h-8 px-3 bg-bg-input border border-border-muted rounded-md text-[12px] text-fg-primary font-mono outline-none focus:border-border-focus placeholder:text-fg-tertiary"
            />
          </div>
          <div>
            <label className="font-sans text-[11px] text-fg-tertiary mb-1 block">{t("mcp.envVars")}</label>
            <textarea
              value={envText}
              onChange={(e) => setEnvText(e.target.value)}
              placeholder={"KEY=VALUE\nKEY2=VALUE2"}
              className="w-full h-20 px-3 py-1 bg-bg-input border border-border-muted rounded-md text-[12px] text-fg-primary font-mono outline-none focus:border-border-focus placeholder:text-fg-tertiary resize-none"
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="font-sans text-[11px] text-fg-tertiary mb-1 block">{t("mcp.url")}</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("mcp.urlPlaceholder")}
              className="w-full h-8 px-3 bg-bg-input border border-border-muted rounded-md text-[12px] text-fg-primary font-mono outline-none focus:border-border-focus placeholder:text-fg-tertiary"
            />
          </div>
          <div>
            <label className="font-sans text-[11px] text-fg-tertiary mb-1 block">{t("mcp.headers")}</label>
            <textarea
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
              placeholder={"Header: value\nAuthorization: Bearer xxx"}
              className="w-full h-20 px-3 py-1 bg-bg-input border border-border-muted rounded-md text-[12px] text-fg-primary font-mono outline-none focus:border-border-focus placeholder:text-fg-tertiary resize-none"
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!canSave || submitting}
          className="h-8 px-4 rounded-md bg-brand text-white text-[12px] font-medium cursor-pointer hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {initial ? t("common.save") : t("mcp.addServer")}
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

function parseEnvVars(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) env[key] = value;
  }
  return env;
}

function parseHeaders(text: string): [string, string][] {
  const headers: [string, string][] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (key) headers.push([key, value]);
  }
  return headers;
}
