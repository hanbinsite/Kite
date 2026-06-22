import { useState, useEffect } from "react";
import { Wrench, ChevronDown, ChevronRight, Loader2, Play, Code, AlertCircle, Server } from "lucide-react";
import { useProviderStore, callMcpTool } from "@api-client/core/ai";
import type { McpToolInfo } from "@api-client/core/ai";
import { useMcpExternalStore } from "../../stores/mcp-external-store";
import type { McpToolInfo as McpExternalToolInfo } from "@api-client/core/ai/mcp-external";
import { useTranslation } from "react-i18next";

function SchemaParams({ schema }: { schema: Record<string, unknown> }) {
  const { t } = useTranslation();
  const properties = (schema.properties ?? {}) as Record<string, { type?: string; description?: string }>;
  const required = (schema.required ?? []) as string[];
  const entries = Object.entries(properties);

  if (entries.length === 0) {
    return <span className="text-[10px] text-fg-tertiary italic">{t("ai.noParameters")}</span>;
  }

  return (
    <div className="space-y-1.5">
      {entries.map(([key, prop]) => (
        <div key={key} className="flex items-start gap-2">
          <Code className="w-3 h-3 text-fg-tertiary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] text-fg-primary font-medium">{key}</span>
            {required.includes(key) && (
              <span className="text-[9px] text-accent-danger ml-1">*</span>
            )}
            <span className="text-[9px] text-fg-tertiary ml-1">({prop.type ?? "any"})</span>
            {prop.description && (
              <span className="block text-[10px] text-fg-tertiary truncate">{prop.description}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ToolCard({ tool, serverBadge, onRun }: {
  tool: McpToolInfo | McpExternalToolInfo;
  serverBadge?: string;
  onRun: (args: Record<string, unknown>) => Promise<string>;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showRunner, setShowRunner] = useState(false);
  const [args, setArgs] = useState("{}");
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const parsed = JSON.parse(args);
      const res = await onRun(parsed);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const inputSchema = (tool.inputSchema as Record<string, unknown>) ?? {};

  return (
    <div className="bg-bg-elevated border border-border-default rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-fg-tertiary shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-fg-tertiary shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-fg-primary font-medium truncate">{tool.name}</span>
            {serverBadge && (
              <span className="shrink-0 text-[9px] text-fg-secondary bg-bg-base border border-border-default rounded px-1 py-px">
                {serverBadge}
              </span>
            )}
          </div>
          {tool.description && (
            <div className="text-[10px] text-fg-tertiary truncate">{tool.description}</div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowRunner(!showRunner);
            if (!expanded) setExpanded(true);
          }}
          className="p-1 rounded hover:bg-bg-active text-fg-tertiary hover:text-brand transition-colors cursor-pointer"
          title={t("ai.runTool")}
        >
          <Play className="w-3 h-3" />
        </button>
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-2 border-t border-border-default pt-2">
          <div>
            <div className="text-[9px] text-fg-tertiary uppercase tracking-wider mb-1">{t("ai.parameters")}</div>
            <SchemaParams schema={inputSchema} />
          </div>

          {showRunner && (
            <div className="space-y-2">
              <div className="text-[9px] text-fg-tertiary uppercase tracking-wider">{t("ai.argumentsJson")}</div>
              <textarea
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                rows={3}
                className="w-full bg-bg-input border border-border-default rounded px-2 py-1 text-[10px] text-fg-primary font-mono placeholder:text-fg-tertiary outline-none focus:border-border-focus resize-none"
                placeholder='{"key": "value"}'
              />
              <button
                onClick={handleRun}
                disabled={running}
                className="flex items-center gap-1 px-2 py-1 text-[10px] bg-brand hover:bg-brand-hover text-white rounded cursor-pointer transition-colors disabled:opacity-50"
              >
                {running ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
{t("ai.run")}
              </button>

              {error && (
                <div className="flex items-start gap-1 text-accent-danger text-[10px]">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                  <span className="break-all">{error}</span>
                </div>
              )}

              {result !== null && (
                <div className="bg-bg-input border border-border-default rounded px-2 py-1 max-h-[120px] overflow-auto">
                  <pre className="text-[10px] text-fg-primary font-mono whitespace-pre-wrap break-all">{result}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 pt-1">
      <span className="text-[9px] text-fg-tertiary uppercase tracking-wider font-semibold">{children}</span>
    </div>
  );
}

export function McpToolsPanel() {
  const { t } = useTranslation();
  const mcpTools = useProviderStore((s) => s.mcpTools);
  const loadMcpTools = useProviderStore((s) => s.loadMcpTools);

  const externalTools = useMcpExternalStore((s) => s.tools);
  const loadServers = useMcpExternalStore((s) => s.loadServers);
  const refreshTools = useMcpExternalStore((s) => s.refreshTools);
  const callTool = useMcpExternalStore((s) => s.callTool);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadServers();
    refreshTools();
  }, [loadServers, refreshTools]);

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([loadMcpTools(), refreshTools()]);
    setLoading(false);
  };

  const externalByServer = externalTools.reduce<Record<string, McpExternalToolInfo[]>>((acc, tool) => {
    (acc[tool.serverName] ??= []).push(tool);
    return acc;
  }, {});
  const hasExternal = Object.keys(externalByServer).length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-brand" />
          <span className="text-[11px] font-semibold text-fg-primary">{t("ai.mcpTools")}</span>
          {(mcpTools.length + externalTools.length) > 0 && (
            <span className="text-[10px] text-fg-tertiary">({mcpTools.length + externalTools.length})</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary transition-colors cursor-pointer disabled:opacity-50"
          title={t("ai.refreshTools")}
        >
          <Loader2 className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {mcpTools.length === 0 && !hasExternal ? (
        <div className="text-[10px] text-fg-tertiary text-center py-4">
          {t("ai.noMcpTools")}
          {!hasExternal && (
            <div className="mt-1 flex items-center justify-center gap-1 text-fg-tertiary">
              <Server className="w-2.5 h-2.5" />
              <span>{t("ai.noExternalServers")}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {mcpTools.length > 0 && (
            <>
              <SectionLabel>{t("ai.builtinTools")}</SectionLabel>
              {mcpTools.map((tool) => (
                <ToolCard
                  key={`bi-${tool.name}`}
                  tool={tool}
                  onRun={async (args) => callMcpTool(tool.name, args)}
                />
              ))}
            </>
          )}

          {hasExternal ? (
            Object.entries(externalByServer).map(([serverName, tools]) => (
              <div key={`srv-${serverName}`} className="space-y-1">
                <SectionLabel>{t("ai.externalTools", { server: serverName })}</SectionLabel>
                {tools.map((tool) => (
                  <ToolCard
                    key={`ext-${tool.serverId}-${tool.name}`}
                    tool={tool}
                    serverBadge={tool.serverName}
                    onRun={async (args) => {
                      const res = await callTool(tool.serverId, tool.name, args);
                      return typeof res === "string" ? res : JSON.stringify(res, null, 2);
                    }}
                  />
                ))}
              </div>
            ))
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-fg-tertiary pt-1">
              <Server className="w-2.5 h-2.5" />
              <span>{t("ai.noExternalServers")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
