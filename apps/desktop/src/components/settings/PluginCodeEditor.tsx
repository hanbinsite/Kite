import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { X, Save, Play, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type * as MonacoType from "monaco-editor";
import { usePluginStore } from "../../stores/plugin-store";
import type { PluginInfo, PluginHookResult } from "@api-client/core/plugin";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.default })),
);

interface PluginCodeEditorProps {
  plugin: PluginInfo;
  onClose: () => void;
}

function LoadingPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full text-fg-tertiary text-[12px] font-sans">
      Loading editor...
    </div>
  );
}

export function PluginCodeEditor({ plugin, onClose }: PluginCodeEditorProps) {
  const { t } = useTranslation();
  const getPluginCode = usePluginStore((s) => s.getPluginCode);
  const savePluginCode = usePluginStore((s) => s.savePluginCode);
  const executeCommand = usePluginStore((s) => s.executeCommand);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<PluginHookResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPluginCode(plugin.manifest.id)
      .then((c) => {
        if (!cancelled) setCode(c);
      })
      .catch(() => {
        if (!cancelled) setCode("");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plugin.manifest.id, getPluginCode]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await savePluginCode(plugin.manifest.id, code);
      setSavedAt(Date.now());
    } catch {
      // error handled in store
    } finally {
      setSaving(false);
    }
  }, [code, plugin.manifest.id, savePluginCode]);

  const handleBeforeMount = useCallback((monaco: typeof MonacoType) => {
    monaco.languages.registerCompletionItemProvider("javascript", {
      triggerCharacters: ["."],
      provideCompletionItems: () => ({ suggestions: [] }),
    });
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      await handleSave();
      const result = await executeCommand(plugin.manifest.id, "test", {
        event: "test",
        data: {},
      });
      setTestResult(result);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  }, [executeCommand, handleSave, plugin.manifest.id]);

  return (
    <div className="fixed inset-0 z-modal flex flex-col bg-bg-base animate-fade-in" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="flex items-center h-12 px-5 border-b border-border-muted shrink-0 gap-3">
        <span className="font-sans text-[14px] font-semibold text-fg-primary">
          {t("plugins.codeEditor")}
        </span>
        <span className="text-[12px] text-fg-tertiary">— {plugin.manifest.name}</span>
        <div className="ml-auto flex items-center gap-2">
          {savedAt && (
            <span className="text-[11px] text-accent-success flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {t("plugins.saved")}
            </span>
          )}
          <button
            onClick={handleTest}
            disabled={testing}
            className="h-7 px-3 rounded-md border border-border-muted text-fg-secondary text-[12px] font-medium cursor-pointer hover:border-brand hover:text-brand transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {t("plugins.test")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-7 px-3 rounded-md bg-brand text-white text-[12px] font-medium cursor-pointer hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {t("plugins.save")}
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-sm text-fg-tertiary cursor-pointer transition-all duration-[50ms] hover:bg-bg-hover hover:text-fg-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 px-5 py-2 border-b border-border-muted shrink-0 bg-bg-surface/50">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-fg-tertiary">{t("plugins.manifestInfo")}:</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-fg-tertiary font-mono">
            v{plugin.manifest.version}
          </span>
          {plugin.manifest.author && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-fg-tertiary">
              {plugin.manifest.author}
            </span>
          )}
          {plugin.manifest.hooks.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-fg-tertiary">{t("plugins.hooks")}:</span>
              {plugin.manifest.hooks.map((h) => (
                <span key={h} className="text-[10px] px-1.5 py-0.5 rounded bg-brand-muted text-brand font-mono">
                  {h}
                </span>
              ))}
            </div>
          )}
          {plugin.manifest.permissions.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-fg-tertiary">{t("plugins.permissions")}:</span>
              {plugin.manifest.permissions.map((p) => (
                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-accent-warning/15 text-accent-warning font-mono">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-fg-tertiary animate-spin" />
          </div>
        ) : (
          <Suspense fallback={<LoadingPlaceholder />}>
            <MonacoEditor
              height="100%"
              language="javascript"
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v ?? "")}
              beforeMount={handleBeforeMount}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                renderLineHighlight: "line",
                wordWrap: "on",
                automaticLayout: true,
                tabSize: 2,
                padding: { top: 8 },
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
              }}
            />
          </Suspense>
        )}
      </div>

      {(testResult || testError) && (
        <div className="border-t border-border-muted shrink-0 max-h-[200px] overflow-y-auto bg-bg-surface">
          <div className="flex items-center justify-between px-5 py-2 border-b border-border-muted sticky top-0 bg-bg-surface">
            <span className="font-sans text-[12px] font-semibold text-fg-primary">
              {t("plugins.testResult")}
            </span>
            <button
              onClick={() => { setTestResult(null); setTestError(null); }}
              className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary cursor-pointer transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="px-5 py-3 space-y-2">
            {testError && (
              <div className="flex items-start gap-2 text-accent-danger">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
                <span className="font-mono text-[11px] break-all">{testError}</span>
              </div>
            )}
            {testResult && (
              <>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-success" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-accent-danger" />
                  )}
                  <span className={`text-[12px] font-medium ${testResult.success ? "text-accent-success" : "text-accent-danger"}`}>
                    {testResult.success ? "Success" : "Failed"}
                  </span>
                </div>
                {testResult.error && (
                  <div className="font-mono text-[11px] text-accent-danger break-all pl-5">
                    {testResult.error}
                  </div>
                )}
                {testResult.result !== undefined && (
                  <div className="pl-5">
                    <div className="text-[10px] text-fg-tertiary mb-1">result:</div>
                    <pre className="font-mono text-[11px] text-fg-secondary whitespace-pre-wrap break-all bg-bg-elevated rounded p-2">
                      {typeof testResult.result === "string" ? testResult.result : JSON.stringify(testResult.result, null, 2)}
                    </pre>
                  </div>
                )}
                {testResult.logs.length > 0 && (
                  <div className="pl-5">
                    <div className="text-[10px] text-fg-tertiary mb-1">logs:</div>
                    <pre className="font-mono text-[11px] text-fg-tertiary whitespace-pre-wrap break-all">
                      {testResult.logs.join("\n")}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
