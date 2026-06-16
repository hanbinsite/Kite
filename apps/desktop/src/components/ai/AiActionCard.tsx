import { useState } from "react";
import type { CreateRequestAction, ModifyRequestAction, WriteTestAction, FixErrorAction, ExtractVariablesAction, AgentAction } from "@api-client/core/ai";

interface AiActionCardProps {
  actions: AgentAction[];
  onApply: (message: string) => void;
  onReject: () => void;
}

export function AiActionCard({ actions, onApply, onReject }: AiActionCardProps) {
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<Record<number, string>>({});

  if (actions.length === 0) return null;

  const handleApply = async () => {
    setApplying(true);
    const newResults: Record<number, string> = {};
    for (let i = 0; i < actions.length; i++) {
      try {
        const msg = await applyAction(actions[i]!);
        newResults[i] = msg;
        setApplied((prev) => new Set([...prev, i]));
      } catch (e) {
        newResults[i] = `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    setResults(newResults);
    setApplying(false);
    onApply(Object.values(newResults).join("\n"));
  };

  return (
    <div className="rounded-xl border border-fg-primary/10 bg-bg-surface p-4 space-y-4">
      {actions.map((action, i) => (
        <div key={i} className={results[i] ? "space-y-2" : "space-y-2"}>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-brand/20 text-brand">
              {action.type}
            </span>
            <span className="text-sm text-fg-primary font-medium">
              {action.description || action.type}
            </span>
          </div>

          {renderPreview(action)}

          {results[i] ? (
            <div className={`text-xs px-3 py-2 rounded-lg ${applied.has(i) ? "bg-accent-success/10 text-accent-success" : "bg-accent-danger/10 text-accent-danger"}`}>
              {results[i]}
            </div>
          ) : null}
        </div>
      ))}

      {Object.keys(results).length === 0 ? (
        <div className="flex items-center gap-2">
          <button
            onClick={handleApply}
            disabled={applying}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-brand hover:bg-brand/80 text-white transition-colors disabled:opacity-50"
          >
            {applying ? "Applying..." : "Apply All"}
          </button>
          <button
            onClick={onReject}
            disabled={applying}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-fg-primary/10 hover:bg-fg-primary/20 text-fg-primary transition-colors disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : null}
    </div>
  );
}

async function applyAction(action: AgentAction): Promise<string> {
  switch (action.type) {
    case "create_request":
      return applyCreateRequest(action as CreateRequestAction);
    case "write_test":
      return applyWriteTest(action as WriteTestAction);
    case "modify_request":
      return applyModifyRequest(action as ModifyRequestAction);
    case "fix_error":
      return applyFixError(action as FixErrorAction);
    case "extract_variables":
      return applyExtractVariables(action as ExtractVariablesAction);
    default:
      return `${action.type}: action received. Manual configuration needed.`;
  }
}

async function applyCreateRequest(action: CreateRequestAction): Promise<string> {
  const { useCollectionStore } = await import("@/stores/collection-store");
  const { useTabStore } = await import("@api-client/core");

  const { data } = action;
  const collections = useCollectionStore.getState().collections;
  const activeCollectionId = collections[0]?.id;
  if (!activeCollectionId) return "No collection found to add request.";

  const requestId = `req-${Date.now()}`;
  useCollectionStore.getState().addRequestToCollection(activeCollectionId, {
    id: requestId,
    method: data.method,
    name: data.name,
    url: data.url,
  });

  useTabStore.getState().openTab({
    name: data.name,
    method: data.method,
    url: data.url,
    requestId,
    meta: { collectionId: activeCollectionId },
  });

  return `Created "${data.name}" — ${data.method} ${data.url}`;
}

async function applyWriteTest(action: WriteTestAction): Promise<string> {
  return `Test script generated (${action.data.script.length} chars). Paste into Script editor to use.`;
}

async function applyModifyRequest(action: ModifyRequestAction): Promise<string> {
  const changes = action.data.changes;
  return changes.map((c) => `${c.op} ${c.path}`).join(", ");
}

async function applyFixError(action: FixErrorAction): Promise<string> {
  return action.data.suggestions.map((s) => `${s.path}: ${s.fix}`).join("\n");
}

async function applyExtractVariables(action: ExtractVariablesAction): Promise<string> {
  const { useEnvironmentStore } = await import("@/stores/environment-store");
  for (const v of action.data.variables) {
    useEnvironmentStore.getState().setGlobalVariable(v.key, v.value);
  }
  const names = action.data.variables.map((v) => v.key).join(", ");
  return `Added to globals: ${names}`;
}

function renderPreview(action: AgentAction) {
  const data = action.data as Record<string, unknown>;
  switch (action.type) {
    case "create_request": {
      return (
        <div className="space-y-1 text-xs text-fg-secondary bg-bg-base rounded-lg p-3">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-method-get">{String(data.method)}</span>
            <span>{String(data.url)}</span>
          </div>
          {Array.isArray(data.headers) && data.headers.length > 0 ? (
            <div className="text-fg-secondary/60">
              {(data.headers as Array<{ key: string; value: string }>).map((h, i) => (
                <div key={i} className="truncate">{h.key}: {h.value}</div>
              ))}
            </div>
          ) : null}
        </div>
      );
    }
    case "modify_request": {
      const changes = Array.isArray(data.changes) ? data.changes as Array<{ path: string; op: string; value?: unknown }> : [];
      return (
        <div className="space-y-0.5 text-xs font-mono bg-bg-base rounded-lg p-3">
          {changes.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-brand">{c.op}</span>
              <span>{c.path}</span>
              {c.value !== undefined ? <span className="text-fg-secondary/60">{JSON.stringify(c.value)}</span> : null}
            </div>
          ))}
        </div>
      );
    }
    case "write_test": {
      const script = String(data.script || "");
      return (
        <pre className="text-xs text-fg-secondary bg-bg-base rounded-lg p-3 overflow-auto max-h-24">
          {script.slice(0, 200)}{script.length > 200 ? "..." : ""}
        </pre>
      );
    }
    case "fix_error": {
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions as Array<{ path: string; issue: string; fix: string }> : [];
      return (
        <div className="space-y-1 text-xs bg-bg-base rounded-lg p-3">
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-accent-danger shrink-0">!</span>
              <div><span className="text-fg-primary">{s.path}</span><span className="text-fg-secondary/60 ml-2">{s.fix}</span></div>
            </div>
          ))}
        </div>
      );
    }
    case "extract_variables": {
      const variables = Array.isArray(data.variables) ? data.variables as Array<{ key: string; value: string }> : [];
      return (
        <div className="space-y-0.5 text-xs font-mono bg-bg-base rounded-lg p-3">
          {variables.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-brand">{v.key}</span>
              <span>=</span>
              <span className="text-fg-secondary">{v.value}</span>
            </div>
          ))}
        </div>
      );
    }
    case "generate_mock": {
      const body = data.responseBody;
      return (
        <pre className="text-xs text-fg-secondary bg-bg-base rounded-lg p-3 overflow-auto max-h-24">
          {typeof body === "string" ? body : JSON.stringify(body, null, 2).slice(0, 200)}
        </pre>
      );
    }
    case "generate_doc": {
      const md = String(data.markdown || "");
      return (
        <div className="text-xs text-fg-secondary bg-bg-base rounded-lg p-3 max-h-24 overflow-hidden">
          {md.slice(0, 200)}{md.length > 200 ? "..." : ""}
        </div>
      );
    }
    default:
      return <pre className="text-xs text-fg-secondary bg-bg-base rounded-lg p-3">{JSON.stringify(data, null, 2).slice(0, 200)}</pre>;
  }
}