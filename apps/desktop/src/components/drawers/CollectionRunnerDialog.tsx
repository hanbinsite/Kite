import { useState, useCallback, useMemo, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Play, Square, ChevronRight, ChevronDown, Check, X as XIcon, Minus, Upload } from "lucide-react";
import { useRunnerStore, type RunnerRequestResult, type RunnerIterationResult } from "../../stores/runner-store";
import { useCollectionStore } from "../../stores/collection-store";
import { useEnvironmentStore } from "../../stores/environment-store";
import { getCollection, type IpcCollectionItem } from "@api-client/core/http";
import type { RunnerRequestConfig } from "../../stores/runner-store";
import type { BodyConfig, AuthConfig } from "@api-client/types";
import { useTranslation } from "react-i18next";
import { createAuthConfig } from "../../utils/auth";

interface CollectionRunnerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function ipcBodyToBodyConfig(ipcBody: IpcCollectionItem["body"]): BodyConfig | null {
  if (!ipcBody || ipcBody.mode === "none") return null;
  const mode = ipcBody.mode as BodyConfig["mode"];
  if (mode === "raw") return { mode: "raw", raw: { language: (ipcBody.language ?? "json") as "json", content: ipcBody.content ?? "" } };
  if (mode === "urlencoded") return { mode: "urlencoded", urlencoded: (ipcBody.urlencoded ?? []).map((p) => ({ key: p.key, value: p.value, disabled: p.disabled })) };
  if (mode === "formdata") return { mode: "formdata", formdata: (ipcBody.formdata ?? []).map((p) => ({ key: p.key, value: p.value, type: (p.param_type === "file" ? "file" : "text") as "text" | "file", disabled: p.disabled })) };
  if (mode === "graphql") return { mode: "graphql", graphql: { query: ipcBody.graphql_query ?? "", variables: ipcBody.graphql_variables ?? "" } };
  if (mode === "binary") return { mode: "binary", binary: ipcBody.content ?? "" };
  return null;
}

function ipcAuthToAuthConfig(ipcAuth: IpcCollectionItem["auth"]): AuthConfig {
  if (!ipcAuth || ipcAuth.type === "none") return { type: "none", config: {} };
  return createAuthConfig(ipcAuth.type, (ipcAuth.config ?? {}) as Record<string, unknown>);
}

function flattenIpcItems(items: IpcCollectionItem[]): IpcCollectionItem[] {
  const result: IpcCollectionItem[] = [];
  for (const item of items) {
    if (item.type === "request") result.push(item);
    else if (item.type === "folder" && item.items) result.push(...flattenIpcItems(item.items));
  }
  return result;
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-accent-success";
  if (status >= 300 && status < 400) return "text-method-get";
  if (status >= 400 && status < 500) return "text-method-post";
  return "text-accent-danger";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function CollectionRunnerDialog({ isOpen, onClose }: CollectionRunnerDialogProps) {
  const { t } = useTranslation();
  const { status, result, selectedResultDetail,
    startRun, cancelRun, resetRunner, setSelectedResultDetail } = useRunnerStore();
  const collections = useCollectionStore((s) => s.collections);
  const environments = useEnvironmentStore((s) => s.environments);

  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [iterationCount, setIterationCount] = useState(1);
  const [delayMs, setDelayMs] = useState(0);
  const [persistVariables, setPersistVariables] = useState(false);
  const [dataRows, setDataRows] = useState<Record<string, string>[] | undefined>();
  const [dataFileName, setDataFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preRunScript, setPreRunScript] = useState("");
  const [postRunScript, setPostRunScript] = useState("");
  const [showScripts, setShowScripts] = useState(false);
  const [expandedIterations, setExpandedIterations] = useState<Set<number>>(new Set());

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDataFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      try {
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          const rows = Array.isArray(parsed) ? parsed : [parsed];
          setDataRows(rows as Record<string, string>[]);
        } else {
          const lines = text.split("\n").filter((l) => l.trim());
          if (lines.length < 2) { setDataRows([]); return; }
          const headers = lines[0]!.split(",").map((h) => h.trim());
          const rows = lines.slice(1).map((line) => {
            const values = line.split(",").map((v) => v.trim());
            const row: Record<string, string> = {};
            headers.forEach((h, i) => { if (h) row[h] = values[i] ?? ""; });
            return row;
          });
          setDataRows(rows);
        }
      } catch {
        setDataRows([]);
        setDataFileName("Error parsing file");
      }
    };
    reader.readAsText(file);
  }, []);

  const clearDataFile = useCallback(() => {
    setDataRows(undefined);
    setDataFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleRun = useCallback(async () => {
    if (!selectedCollectionId) return;
    try {
      const ipcCollection = await getCollection(selectedCollectionId);
      const flatItems = flattenIpcItems(ipcCollection.items);
      const requests: RunnerRequestConfig[] = flatItems.map((item) => ({
        id: item.id,
        method: item.method ?? "GET",
        name: item.name,
        url: item.url ?? "",
        headers: (item.headers ?? []).map((h) => ({ key: h.key, value: h.value, disabled: h.disabled })),
        params: (item.params ?? []).map((p) => ({ key: p.key, value: p.value, disabled: p.disabled })),
        body: ipcBodyToBodyConfig(item.body),
        auth: ipcAuthToAuthConfig(item.auth),
        settings: item.settings ? { timeoutMs: item.settings.timeout_ms, followRedirects: item.settings.follow_redirects, maxRedirects: item.settings.max_redirects, verifySsl: item.settings.verify_ssl } : { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, verifySsl: true },
        scripts: { preRequest: item.scripts?.pre_request, postResponse: item.scripts?.post_response },
      }));
      startRun({
        collectionId: selectedCollectionId,
        collectionName: ipcCollection.name,
        environmentId: selectedEnvironmentId,
        iterationCount,
        delayMs,
        persistVariables,
        dataRows,
        preRunScript: preRunScript || undefined,
        postRunScript: postRunScript || undefined,
        requests,
      });
    } catch (e) {
      console.error("Failed to load collection:", e);
    }
  }, [selectedCollectionId, selectedEnvironmentId, iterationCount, delayMs, persistVariables, startRun]);

  const handleExport = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `runner-${result.collectionName}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      if (status === "running") cancelRun();
      resetRunner();
      onClose();
    }
  }, [status, cancelRun, resetRunner, onClose]);

  const toggleIteration = (i: number) => {
    setExpandedIterations((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const progressPercent = useMemo(() => {
    if (!result || result.totalRequests === 0) return 0;
    const completed = result.iterations.reduce((sum, it) => sum + it.requests.length, 0);
    return Math.round((completed / result.totalRequests) * 100);
  }, [result]);

  const isRunning = status === "running";

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-modal animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] max-w-[95vw] max-h-[480px] bg-bg-elevated/85 backdrop-blur-[20px] border border-white/[0.06] rounded-xl shadow-xl z-modal flex flex-col overflow-hidden">
          <div className="h-12 flex items-center justify-between px-4 border-b border-border-default">
            <Dialog.Title className="font-sans text-sm font-semibold text-fg-primary">
              {t("runner.title")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="h-10 flex items-center gap-3 px-4 border-b border-border-default text-xs text-fg-secondary">
            <label className="flex items-center gap-1.5">
              {t("runner.collection")}
              <select
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                disabled={isRunning}
                className="h-7 px-2 bg-bg-input border border-border-default rounded-md text-fg-primary text-xs focus:border-border-focus outline-none disabled:opacity-50"
              >
                <option value="">{t("runner.selectCollection")}</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              {t("runner.environment")}
              <select
                value={selectedEnvironmentId ?? ""}
                onChange={(e) => setSelectedEnvironmentId(e.target.value || null)}
                disabled={isRunning}
                className="h-7 px-2 bg-bg-input border border-border-default rounded-md text-fg-primary text-xs focus:border-border-focus outline-none disabled:opacity-50"
              >
                <option value="">{t("runner.none")}</option>
                {environments.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              {t("runner.iterations")}
              <input
                type="number"
                min={1}
                max={1000}
                value={iterationCount}
                onChange={(e) => setIterationCount(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
                disabled={isRunning}
                className="h-7 w-14 px-2 bg-bg-input border border-border-default rounded-md text-fg-primary text-xs focus:border-border-focus outline-none disabled:opacity-50"
              />
            </label>
            <label className="flex items-center gap-1.5">
              {t("runner.delay")}
              <input
                type="number"
                min={0}
                step={100}
                value={delayMs}
                onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value) || 0))}
                disabled={isRunning}
                className="h-7 w-16 px-2 bg-bg-input border border-border-default rounded-md text-fg-primary text-xs focus:border-border-focus outline-none disabled:opacity-50"
              />
              <span className="text-fg-tertiary">{t("runner.ms")}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={persistVariables}
                onChange={(e) => setPersistVariables(e.target.checked)}
                disabled={isRunning}
                className="accent-brand"
              />
{t("runner.persist")}
            </label>
            <div className="flex items-center gap-1.5 text-xs">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileUpload}
                disabled={isRunning}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isRunning}
                className="h-7 px-2 bg-bg-input border border-border-default rounded-md text-fg-secondary hover:text-fg-primary disabled:opacity-50 cursor-pointer flex items-center gap-1 transition-colors"
              >
                <Upload className="w-3 h-3" />
                {t("runner.dataFile") || "Data (CSV/JSON)"}
              </button>
              {dataFileName && (
                <span className="flex items-center gap-1 text-fg-tertiary">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-success" />
                  {dataFileName}
                  <button onClick={clearDataFile} className="hover:text-accent-danger transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
            <div className="flex-1" />
            {isRunning ? (
              <button
                onClick={cancelRun}
                className="h-7 px-3 bg-accent-danger hover:bg-accent-danger/90 text-white rounded-md text-xs font-medium cursor-pointer transition-colors flex items-center gap-1"
              >
                <Square className="w-3 h-3" /> {t("common.stop")}
              </button>
            ) : (
              <button
                onClick={handleRun}
                disabled={!selectedCollectionId}
                className="h-7 px-3 bg-brand hover:bg-brand-hover text-white rounded-md text-xs font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Play className="w-3 h-3" /> {t("runner.run")}
              </button>
)}
            </div>
            <button
              onClick={() => setShowScripts(!showScripts)}
              className={`h-7 px-2 rounded-md text-xs font-medium cursor-pointer transition-colors flex items-center gap-1 ${showScripts ? "text-brand bg-brand/10" : "text-fg-tertiary hover:bg-bg-hover"}`}
            >
              {showScripts ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Scripts
            </button>
            {showScripts && (
              <div className="col-span-full grid grid-cols-2 gap-2 pb-2">
                <div>
                  <label className="text-[10px] text-fg-tertiary font-medium">Pre-run Script</label>
                  <textarea
                    value={preRunScript}
                    onChange={(e) => setPreRunScript(e.target.value)}
                    disabled={isRunning}
                    placeholder="// Runs once before all iterations"
                    className="w-full h-20 px-2 py-1 bg-bg-input border border-border-muted rounded-md text-[11px] font-mono text-fg-primary outline-none focus:border-border-focus resize-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-fg-tertiary font-medium">Post-run Script</label>
                  <textarea
                    value={postRunScript}
                    onChange={(e) => setPostRunScript(e.target.value)}
                    disabled={isRunning}
                    placeholder="// Runs once after all iterations"
                    className="w-full h-20 px-2 py-1 bg-bg-input border border-border-muted rounded-md text-[11px] font-mono text-fg-primary outline-none focus:border-border-focus resize-none disabled:opacity-50"
                  />
                </div>
              </div>
            )}

          {result && (
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="h-7 bg-bg-elevated text-[10px] font-semibold text-fg-tertiary uppercase">
                    <th className="text-left px-4 w-8">#</th>
                    <th className="text-left px-2">{t("common.name")}</th>
                    <th className="text-left px-2 w-14">{t("common.status")}</th>
                    <th className="text-left px-2 w-16">{t("runner.time")}</th>
                    <th className="text-left px-2 w-14">{t("runner.size")}</th>
                    <th className="text-center px-2 w-10">{t("runner.pass")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.iterations.map((iteration, iterIdx) => (
                    <IterationRow
                      key={iterIdx}
                      iteration={iteration}
                      iterationIndex={iterIdx}
                      expanded={expandedIterations.has(iterIdx)}
                      onToggle={() => toggleIteration(iterIdx)}
                      selectedDetail={selectedResultDetail}
                      onSelectDetail={setSelectedResultDetail}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!result && (
            <div className="flex-1 flex items-center justify-center text-fg-tertiary text-xs">
              {isRunning ? t("runner.running") : t("runner.placeholder")}
            </div>
          )}

          {result && (
            <div className="h-6 px-4 flex items-center gap-2 text-[11px] text-fg-secondary border-t border-border-default">
              <div className="h-1 flex-1 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span>{progressPercent}%</span>
              {status === "completed" && (
                <span className="text-fg-tertiary">
                  {result.passedRequests}/{result.totalRequests} {t("runner.passed")}
                </span>
              )}
            </div>
          )}

          <div className="h-8 px-4 flex items-center justify-between border-t border-border-default">
            <button
              onClick={handleExport}
              disabled={!result || result.iterations.length === 0}
              className="text-[11px] text-fg-secondary px-3 py-1 border border-border-default rounded-md hover:text-brand hover:border-brand hover:bg-brand/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {t("runner.exportResults")}
            </button>
            <button
              onClick={() => handleOpenChange(false)}
              className="text-[11px] text-fg-secondary px-3 py-1 hover:text-fg-primary transition-colors cursor-pointer"
            >
{t("common.close")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function IterationRow({
  iteration,
  iterationIndex,
  expanded,
  onToggle,
  selectedDetail,
  onSelectDetail,
}: {
  iteration: RunnerIterationResult;
  iterationIndex: number;
  expanded: boolean;
  onToggle: () => void;
  selectedDetail: { iteration: number; requestIndex: number } | null;
  onSelectDetail: (detail: { iteration: number; requestIndex: number } | null) => void;
}) {
  const { t } = useTranslation();
  const passCount = iteration.requests.filter((r) => r.status === "success").length;
  const failCount = iteration.requests.filter((r) => r.status === "failure").length;

  return (
    <>
      <tr
        className="h-8 text-xs text-fg-secondary cursor-pointer hover:bg-bg-hover"
        onClick={onToggle}
      >
        <td colSpan={6} className="px-4">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span className="font-medium text-fg-primary">
              {t("runner.iteration", { num: iteration.iteration + 1 })}
            </span>
            <span className="text-accent-success">{passCount} {t("runner.passed")}</span>
            {failCount > 0 && <span className="text-accent-danger">{failCount} {t("runner.failed")}</span>}
          </div>
        </td>
      </tr>
      {expanded && iteration.requests.map((req, reqIdx) => (
        <RequestResultRow
          key={reqIdx}
          result={req}
          index={reqIdx}
          isSelected={selectedDetail?.iteration === iterationIndex && selectedDetail?.requestIndex === reqIdx}
          onSelect={() => onSelectDetail({ iteration: iterationIndex, requestIndex: reqIdx })}
        />
      ))}
    </>
  );
}

function RequestResultRow({
  result,
  index,
  isSelected,
  onSelect,
}: {
  result: RunnerRequestResult;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusIcon = result.status === "success"
    ? <Check className="w-3.5 h-3.5 text-accent-success" />
    : result.status === "failure"
      ? <XIcon className="w-3.5 h-3.5 text-accent-danger" />
      : <Minus className="w-3.5 h-3.5 text-fg-tertiary" />;

  return (
    <tr
      className={`h-8 text-[11px] text-fg-secondary cursor-pointer ${isSelected ? "bg-brand/10" : "hover:bg-bg-hover"}`}
      onClick={onSelect}
    >
      <td className="px-4 text-fg-tertiary">{index + 1}</td>
      <td className="px-2 flex items-center gap-1.5">
        {statusIcon}
        <span className={`text-[10px] font-semibold ${result.method === "GET" ? "text-method-get" : result.method === "POST" ? "text-method-post" : result.method === "PUT" ? "text-method-post" : result.method === "DELETE" ? "text-accent-danger" : "text-fg-secondary"}`}>
          {result.method}
        </span>
        <span className="text-fg-primary truncate max-w-[240px]">{result.requestName || result.url}</span>
      </td>
      <td className={`px-2 ${result.statusCode > 0 ? statusColor(result.statusCode) : "text-fg-tertiary"}`}>
        {result.statusCode || "—"}
      </td>
      <td className="px-2">{result.time > 0 ? `${result.time}ms` : "—"}</td>
      <td className="px-2">{result.size > 0 ? formatSize(result.size) : "—"}</td>
      <td className="px-2 text-center">
        {result.testResults.length > 0 ? (
          <span>
            <span className="text-accent-success">{result.testPassCount}</span>
            <span className="text-fg-tertiary">/</span>
            <span className={result.testFailCount > 0 ? "text-accent-danger" : "text-fg-tertiary"}>{result.testFailCount}</span>
          </span>
        ) : "—"}
      </td>
    </tr>
  );
}
