import { useState } from "react";
import { Wrench, ChevronDown, ChevronRight, Loader2, Play, Code, AlertCircle } from "lucide-react";
import { useProviderStore, callMcpTool } from "@api-client/core/ai";
import type { McpToolInfo } from "@api-client/core/ai";

function SchemaParams({ schema }: { schema: Record<string, unknown> }) {
  const properties = (schema.properties ?? {}) as Record<string, { type?: string; description?: string }>;
  const required = (schema.required ?? []) as string[];
  const entries = Object.entries(properties);

  if (entries.length === 0) {
    return <span className="text-[10px] text-fg-tertiary italic">No parameters</span>;
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

function ToolCard({ tool }: { tool: McpToolInfo }) {
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
      const res = await callMcpTool(tool.name, parsed);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

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
          <div className="text-[11px] text-fg-primary font-medium truncate">{tool.name}</div>
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
          title="Run tool"
        >
          <Play className="w-3 h-3" />
        </button>
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-2 border-t border-border-default pt-2">
          <div>
            <div className="text-[9px] text-fg-tertiary uppercase tracking-wider mb-1">Parameters</div>
            <SchemaParams schema={tool.inputSchema} />
          </div>

          {showRunner && (
            <div className="space-y-2">
              <div className="text-[9px] text-fg-tertiary uppercase tracking-wider">Arguments (JSON)</div>
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
                Run
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

export function McpToolsPanel() {
  const mcpTools = useProviderStore((s) => s.mcpTools);
  const loadMcpTools = useProviderStore((s) => s.loadMcpTools);
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    await loadMcpTools();
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-brand" />
          <span className="text-[11px] font-semibold text-fg-primary">MCP Tools</span>
          {mcpTools.length > 0 && (
            <span className="text-[10px] text-fg-tertiary">({mcpTools.length})</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh tools"
        >
          <Loader2 className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {mcpTools.length === 0 ? (
        <div className="text-[10px] text-fg-tertiary text-center py-4">
          No MCP tools connected. Configure MCP servers in Settings.
        </div>
      ) : (
        <div className="space-y-1">
          {mcpTools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}