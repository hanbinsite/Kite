import { useState } from "react";
import type { CreateRequestAction, ModifyRequestAction, WriteTestAction, FixErrorAction, ExtractVariablesAction, GenerateMockAction, GenerateDocAction, AgentAction } from "@api-client/core/ai";
import type { BodyConfig, AuthConfig, Header, QueryParam, BodyMode } from "@api-client/types";
import { toast } from "@api-client/ui";

interface ModifyContext {
  headers: Header[];
  params: QueryParam[];
  body: BodyConfig | null;
  auth: AuthConfig | null;
  change: { path: string; op: string; value?: unknown };
  setUrl: (v: string) => void;
  setMethod: (v: string) => void;
}

function setByPath(obj: Record<string, unknown>, path: string[], value: unknown): void {
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    if (!(key in obj) || typeof obj[key] !== "object" || obj[key] === null) {
      obj[key] = {};
    }
    obj = obj[key] as Record<string, unknown>;
  }
  obj[path[path.length - 1]!] = value;
}

function applyPathChange(ctx: ModifyContext): void {
  const { headers, params, change, setUrl, setMethod } = ctx;
  const { path, op, value } = change;
  const parts = path.split(".");

  if (parts.length >= 2 && parts[0] === "headers") {
    const idx = parseInt(parts[1]!, 10);
    if (!isNaN(idx)) {
      if (op === "remove") {
        headers.splice(idx, 1);
      } else if (op === "set" && idx < headers.length) {
        if (parts.length === 3 && (parts[2] === "key" || parts[2] === "value")) {
          (headers[idx] as unknown as Record<string, unknown>)[parts[2]] = value;
        } else {
          Object.assign(headers[idx]!, value as object);
        }
      } else if (op === "add") {
        const newHeader = value as Record<string, unknown> ?? {};
        headers.push({ key: String(newHeader.key ?? ""), value: String(newHeader.value ?? ""), disabled: false });
      }
    }
    return;
  }

  if (parts.length >= 2 && parts[0] === "params") {
    const idx = parseInt(parts[1]!, 10);
    if (!isNaN(idx)) {
      if (op === "remove") {
        params.splice(idx, 1);
      } else if (op === "set" && idx < params.length) {
        if (parts.length === 3 && (parts[2] === "key" || parts[2] === "value")) {
          (params[idx] as unknown as Record<string, unknown>)[parts[2]] = value;
        } else {
          Object.assign(params[idx]!, value as object);
        }
      } else if (op === "add") {
        const newParam = value as Record<string, unknown> ?? {};
        params.push({ key: String(newParam.key ?? ""), value: String(newParam.value ?? ""), disabled: false });
      }
    }
    return;
  }

  if (parts[0] === "body") {
    if (ctx.body && parts.length >= 2) {
      if (parts[1] === "mode") {
        if (op === "set") ctx.body.mode = value as BodyMode;
      } else if (parts[1] === "content") {
        if (op === "set" && ctx.body.mode === "raw" && ctx.body.raw) {
          ctx.body.raw.content = String(value ?? "");
        }
      } else if (parts[1] === "graphql" && parts.length >= 3) {
        if (ctx.body.graphql) {
          setByPath(ctx.body.graphql as unknown as Record<string, unknown>, parts.slice(2), value);
        }
      }
    }
    return;
  }

  if (parts[0] === "auth") {
    return;
  }

  if (parts.length === 1) {
    if (parts[0] === "url" && op === "set") setUrl(String(value ?? ""));
    if (parts[0] === "method" && op === "set") setMethod(String(value ?? ""));
    return;
  }
}

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
    case "generate_mock":
      return applyGenerateMock(action as GenerateMockAction);
    case "generate_doc":
      return applyGenerateDoc(action as GenerateDocAction);
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
  const { useRequestStore } = await import("@/stores/request-store");
  const script = action.data.script;

  const tabs = (await import("@api-client/core")).useTabStore.getState();
  const activeTabId = tabs.activeTabId;
  if (activeTabId) {
    useRequestStore.getState().setRequestScripts({ postResponse: script });
  }

  return `Test script applied (${script.length} chars). Will run after the next response.`;
}

async function applyModifyRequest(action: ModifyRequestAction): Promise<string> {
  const { useRequestStore } = await import("@/stores/request-store");
  const { useTabStore } = await import("@api-client/core");
  const tabId = useTabStore.getState().activeTabId;
  if (!tabId) return "No active tab to modify.";

  const store = useRequestStore.getState();
  const requestData = store.requestDataMap[tabId];
  if (!requestData) return "No request data found for active tab.";

  const changes = action.data.changes;
  const applied: string[] = [];
  const headers = [...requestData.headers];
  const params = [...requestData.params];
  let body: BodyConfig | null = requestData.body ? { ...requestData.body } : null;
  let auth: AuthConfig | null = requestData.auth ? { ...requestData.auth } : null;
  let urlChanged: string | null = null;
  let methodChanged: string | null = null;

  for (const change of changes) {
    try {
      applyPathChange({ headers, params, body, auth, change, setUrl: (v) => { urlChanged = v; }, setMethod: (v) => { methodChanged = v; } });
      applied.push(`${change.op} ${change.path}${change.value !== undefined ? ` → ${JSON.stringify(change.value)}` : ""}`);
    } catch {
      applied.push(`${change.op} ${change.path}: failed`);
    }
  }

  if (headers !== requestData.headers) store.setRequestHeaders(headers);
  if (params !== requestData.params) store.setRequestParams(params);
  if (body && JSON.stringify(body) !== JSON.stringify(requestData.body)) store.setRequestBody(body);
  if (auth && JSON.stringify(auth) !== JSON.stringify(requestData.auth)) store.setRequestAuth(auth);
  if (urlChanged || methodChanged) {
    useTabStore.getState().updateTab(tabId, {
      url: urlChanged ?? useTabStore.getState().tabs.find((t) => t.id === tabId)?.url,
      method: (methodChanged ?? useTabStore.getState().tabs.find((t) => t.id === tabId)?.method) as string,
    });
  }

  return applied.length > 0 ? applied.join("\n") : "No changes detected.";
}

async function applyFixError(action: FixErrorAction): Promise<string> {
  const { useRequestStore } = await import("@/stores/request-store");
  const { useTabStore } = await import("@api-client/core");
  const tabId = useTabStore.getState().activeTabId;
  if (!tabId) return "No active tab.";

  const store = useRequestStore.getState();
  const requestData = store.requestDataMap[tabId];
  if (!requestData) return "No request data found.";

  const suggestions = action.data.suggestions;
  const applied: string[] = [];
  const manual: string[] = [];
  const headers = [...requestData.headers];
  const params = [...requestData.params];
  let body: BodyConfig | null = requestData.body ? { ...requestData.body } : null;
  let auth: AuthConfig | null = requestData.auth ? { ...requestData.auth } : null;
  let urlChanged: string | null = null;
  let methodChanged: string | null = null;

  const knownPaths = new Set([
    "url", "method", "headers", "params", "body", "body.mode", "body.content",
    "body.graphql.query", "body.graphql.variables", "auth", "settings.timeoutMs",
    "settings.followRedirects", "settings.verifySsl",
  ]);

  for (const s of suggestions) {
    const pathKey = s.path.split(".").slice(0, 2).join(".");
    if (knownPaths.has(s.path) || knownPaths.has(pathKey)) {
      try {
        applyPathChange({
          headers, params, body, auth,
          change: { path: s.path, op: "set", value: parseFixValue(s.fix) },
          setUrl: (v) => { urlChanged = v; },
          setMethod: (v) => { methodChanged = v; },
        });
        applied.push(`${s.path}: ${s.fix}`);
      } catch {
        manual.push(`${s.path}: ${s.fix} (apply failed, review manually)`);
      }
    } else {
      manual.push(`${s.path}: ${s.fix} (review and apply manually)`);
    }
  }

  if (applied.length > 0) {
    if (headers !== requestData.headers) store.setRequestHeaders(headers);
    if (params !== requestData.params) store.setRequestParams(params);
    if (body && JSON.stringify(body) !== JSON.stringify(requestData.body)) store.setRequestBody(body);
    if (auth && JSON.stringify(auth) !== JSON.stringify(requestData.auth)) store.setRequestAuth(auth);
    if (urlChanged || methodChanged) {
      useTabStore.getState().updateTab(tabId, {
        url: urlChanged ?? useTabStore.getState().tabs.find((t) => t.id === tabId)?.url,
        method: (methodChanged ?? useTabStore.getState().tabs.find((t) => t.id === tabId)?.method) as string,
      });
    }
  }

  const result: string[] = [];
  if (applied.length > 0) result.push(`Auto-applied ${applied.length} fix(es):\n${applied.join("\n")}`);
  if (manual.length > 0) result.push(`Manual ${manual.length} suggestion(s):\n${manual.join("\n")}`);
  return result.length > 0 ? result.join("\n\n") : "No fixes to apply.";
}

function parseFixValue(fix: string): unknown {
  if (fix.startsWith("{") || fix.startsWith("[")) {
    try { return JSON.parse(fix); } catch { /* fall through */ }
  }
  return fix;
}

async function applyExtractVariables(action: ExtractVariablesAction): Promise<string> {
  const { useEnvironmentStore } = await import("@/stores/environment-store");
  const envStore = useEnvironmentStore.getState();
  const activeEnvId = envStore.activeEnvironmentId;

  if (!activeEnvId) {
    for (const v of action.data.variables) {
      envStore.setGlobalVariable(v.key, v.value);
    }
    const names = action.data.variables.map((v) => v.key).join(", ");
    return `No active environment — added to globals: ${names}`;
  }

  const env = envStore.environments.find((e) => e.id === activeEnvId);
  if (!env) {
    for (const v of action.data.variables) {
      envStore.setGlobalVariable(v.key, v.value);
    }
    const names = action.data.variables.map((v) => v.key).join(", ");
    return `Active environment missing — added to globals: ${names}`;
  }

  const existingByKey = new Map(env.variables.map((v) => [v.key, v]));
  const merged = env.variables.map((v) => {
    const replacement = action.data.variables.find((nv) => nv.key === v.key);
    if (replacement) return { ...v, value: replacement.value };
    return v;
  });
  for (const nv of action.data.variables) {
    if (!existingByKey.has(nv.key)) {
      merged.push({ key: nv.key, value: nv.value, enabled: true });
    }
  }
  envStore.updateEnvironment(activeEnvId, { variables: merged });

  const count = action.data.variables.length;
  try {
    toast({
      variant: "success",
      title: "Variables Extracted",
      description: `Extracted ${count} variable${count === 1 ? "" : "s"} to ${env.name}`,
      duration: 3000,
    });
  } catch (e) {
    console.error("toast error", e);
  }
  return `Extracted ${count} variable${count === 1 ? "" : "s"} to ${env.name}`;
}

async function applyGenerateMock(action: GenerateMockAction): Promise<string> {
  const { useMockStore } = await import("@/stores/mock-store");
  const mockStore = useMockStore.getState();

  const routeId = `mock-${Date.now()}`;
  const responseBody = typeof action.data.responseBody === "string"
    ? action.data.responseBody
    : JSON.stringify(action.data.responseBody, null, 2);

  mockStore.addRoute({
    id: routeId,
    method: action.data.method,
    path: action.data.route,
    status: action.data.statusCode,
    headers: (action.data.headers ?? []).map((h) => ({ key: h.key, value: h.value })),
    body: responseBody,
    delayMs: 0,
  });

  return `Mock route added: ${action.data.method} ${action.data.route} → ${action.data.statusCode}`;
}

async function applyGenerateDoc(action: GenerateDocAction): Promise<string> {
  const markdown = action.data.markdown ?? "";
  const { invoke } = await import("@tauri-apps/api/core");
  const { useCollectionStore } = await import("@/stores/collection-store");
  const { useTabStore } = await import("@api-client/core");

  const tabStore = useTabStore.getState();
  const activeTabId = tabStore.activeTabId;
  const activeTab = tabStore.tabs.find((t) => t.id === activeTabId);
  const colStore = useCollectionStore.getState();

  let collectionId: string | undefined;
  if (activeTab?.requestId) {
    const hierarchy = colStore.resolveRequestHierarchy(activeTab.requestId);
    collectionId = hierarchy?.collectionId;
  }
  if (!collectionId) {
    collectionId = colStore.collections[0]?.id;
  }

  if (collectionId) {
    const collection = colStore.collections.find((c) => c.id === collectionId);
    const collectionName = collection?.name ?? collectionId;
    const relativePath = `collections/${collectionId}/README.md`;
    try {
      await invoke<void>("write_file", { path: relativePath, content: markdown });
      try {
        toast({
          variant: "success",
          title: "Documentation Saved",
          description: `Saved to ${collectionName}/README.md`,
          duration: 4000,
        });
      } catch (e) {
        console.error("toast error", e);
      }
      return `Documentation saved to ${collectionName}/README.md (${markdown.length} chars).`;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      try {
        navigator.clipboard.writeText(markdown);
        toast({
          variant: "warning",
          title: "Save Failed — Copied",
          description: `Could not write README.md: ${detail}. Copied to clipboard.`,
          duration: 5000,
        });
      } catch (err) {
        console.error("toast error", err);
      }
      return `Failed to save README.md (${detail}). Copied to clipboard.`;
    }
  }

  try {
    navigator.clipboard.writeText(markdown);
    toast({
      variant: "info",
      title: "Documentation Copied",
      description: "No collection context — markdown copied to clipboard.",
      duration: 4000,
    });
  } catch (e) {
    console.error("toast error", e);
  }
  return `No collection context — documentation copied to clipboard (${markdown.length} chars).`;
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