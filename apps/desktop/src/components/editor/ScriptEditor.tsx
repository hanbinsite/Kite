import { useState, lazy, Suspense, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Bookmark, Settings2, Trash2, Save } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "@api-client/ui";
import type * as MonacoType from "monaco-editor";
import {
  listScriptTemplates,
  saveScriptTemplate,
  deleteScriptTemplate,
  type ScriptTemplate,
} from "@api-client/core/script";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.default }))
);

const FALLBACK_SNIPPETS: ScriptTemplate[] = [
  {
    id: "builtin-set-timestamp",
    name: "Set timestamp variable",
    description: "Sets a timestamp variable in ISO format",
    code: `pm.variables.set('timestamp', new Date().toISOString());`,
    category: "variables",
    isBuiltin: true,
  },
  {
    id: "builtin-extract-token",
    name: "Extract token from response",
    description: "Extracts access_token from JSON response",
    code: `const jsonData = pm.response.json();
pm.variables.set('token', jsonData.access_token);`,
    category: "extraction",
    isBuiltin: true,
  },
  {
    id: "builtin-add-header",
    name: "Add custom header",
    description: "Adds a custom request header with a UUID",
    code: `pm.request.addHeader('X-Request-ID', crypto.randomUUID());`,
    category: "request",
    isBuiltin: true,
  },
  {
    id: "builtin-status-assertion",
    name: "Status code assertion",
    description: "Asserts that response status is 200",
    code: `pm.test('Status code is 200', () => {
  pm.expect(pm.response.status).to.eql(200);
});`,
    category: "tests",
    isBuiltin: true,
  },
  {
    id: "builtin-body-assertion",
    name: "Response body assertion",
    description: "Asserts response body has a property",
    code: `pm.test('Has expected property', () => {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.have.property('id');
});`,
    category: "tests",
    isBuiltin: true,
  },
  {
    id: "builtin-time-assertion",
    name: "Response time assertion",
    description: "Asserts response time is under 500ms",
    code: `pm.test('Response time is less than 500ms', () => {
  pm.expect(pm.response.time).to.be.below(500);
});`,
    category: "tests",
    isBuiltin: true,
  },
  {
    id: "builtin-send-request",
    name: "Send additional request",
    description: "Performs a health check request",
    code: `pm.sendRequest('https://api.example.com/health', function(err, res) {
  if (err) { console.error(err); return; }
  pm.test('Health check passes', () => {
    pm.expect(res.status).to.eql(200);
  });
});`,
    category: "request",
    isBuiltin: true,
  },
  {
    id: "builtin-clear-variable",
    name: "Clear environment variable",
    description: "Unsets an environment variable",
    code: `pm.environment.unset('tempVar');`,
    category: "variables",
    isBuiltin: true,
  },
  {
    id: "builtin-set-variables",
    name: "Set multiple variables",
    description: "Sets baseUrl and apiKey environment variables",
    code: `pm.environment.set('baseUrl', 'https://api.example.com');
pm.environment.set('apiKey', 'your-key-here');`,
    category: "variables",
    isBuiltin: true,
  },
];

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function LoadingPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full text-fg-tertiary text-[12px] font-sans">
      Loading editor...
    </div>
  );
}

function SnippetMenu({
  templates,
  onSelect,
  onClose,
}: {
  templates: ScriptTemplate[];
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-3 top-[44px] z-50 w-[260px] bg-bg-elevated border border-border-muted rounded-lg shadow-xl py-1 max-h-[320px] overflow-y-auto"
    >
      <div className="px-3 py-1.5 font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em]">
        {t("scripts.snippets")}
      </div>
      {templates.length === 0 ? (
        <div className="px-3 py-2 font-sans text-[12px] text-fg-tertiary">
          {t("scripts.noTemplates")}
        </div>
      ) : (
        templates.map((template) => (
          <button
            key={template.id}
            onClick={() => {
              onSelect(template.code);
              onClose();
            }}
            className="w-full text-left px-3 py-2 hover:bg-bg-hover cursor-pointer transition-colors"
            title={template.description}
          >
            <span className="font-sans text-[12px] text-fg-primary">{template.name}</span>
          </button>
        ))
      )}
    </div>
  );
}

function SaveTemplateDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description: string, category: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("custom");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setCategory("custom");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSave = () => {
    if (!name.trim()) {
      toast({ variant: "error", title: t("scripts.templateNameRequired") });
      return;
    }
    onSave(name.trim(), description.trim(), category.trim() || "custom");
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-modal animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-bg-elevated border border-border-default rounded-xl shadow-xl z-modal p-6 animate-fade-in">
          <div className="flex items-start justify-between mb-4">
            <Dialog.Title className="font-sans text-[15px] font-semibold text-fg-primary">
              {t("scripts.saveAsTemplate")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary cursor-pointer transition-colors">
                <Settings2 className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-3 mb-6">
            <label className="flex flex-col gap-1">
              <span className="font-sans text-[12px] text-fg-secondary">{t("scripts.templateName")}</span>
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                className="h-[32px] px-3 rounded-md bg-bg-base border border-border-default font-sans text-[13px] text-fg-primary focus:outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-sans text-[12px] text-fg-secondary">{t("scripts.templateDescription")}</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-[32px] px-3 rounded-md bg-bg-base border border-border-default font-sans text-[13px] text-fg-primary focus:outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-sans text-[12px] text-fg-secondary">{t("scripts.templateCategory")}</span>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-[32px] px-3 rounded-md bg-bg-base border border-border-default font-sans text-[13px] text-fg-primary focus:outline-none focus:border-brand"
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => onOpenChange(false)}
              className="h-[32px] px-4 rounded-md font-sans text-[13px] font-medium text-fg-secondary bg-bg-hover hover:bg-bg-active cursor-pointer transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              className="h-[32px] px-4 rounded-md font-sans text-[13px] font-medium text-white bg-brand hover:bg-brand-hover cursor-pointer transition-colors"
            >
              {t("common.save")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ManageTemplatesDialog({
  open,
  onOpenChange,
  templates,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ScriptTemplate[];
  onDelete: (template: ScriptTemplate) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-modal animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-h-[60vh] bg-bg-elevated border border-border-default rounded-xl shadow-xl z-modal p-6 animate-fade-in flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <Dialog.Title className="font-sans text-[15px] font-semibold text-fg-primary">
              {t("scripts.templatesTitle")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary cursor-pointer transition-colors">
                <Settings2 className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto -mx-2 px-2">
            {templates.length === 0 ? (
              <div className="py-8 text-center font-sans text-[13px] text-fg-tertiary">
                {t("scripts.noTemplates")}
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {templates.map((tpl) => (
                  <li
                    key={tpl.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-bg-hover transition-colors"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-sans text-[13px] text-fg-primary truncate">{tpl.name}</span>
                        <span
                          className={`font-sans text-[10px] px-1.5 py-0.5 rounded ${
                            tpl.isBuiltin
                              ? "bg-bg-hover text-fg-tertiary"
                              : "bg-brand/15 text-brand"
                          }`}
                        >
                          {tpl.isBuiltin ? t("scripts.templateBuiltin") : t("scripts.templateUser")}
                        </span>
                      </div>
                      {tpl.description && (
                        <span className="font-sans text-[11px] text-fg-tertiary truncate">{tpl.description}</span>
                      )}
                    </div>
                    {!tpl.isBuiltin && (
                      <button
                        onClick={() => onDelete(tpl)}
                        className="p-1.5 rounded hover:bg-accent-danger/15 text-fg-tertiary hover:text-accent-danger cursor-pointer transition-colors shrink-0"
                        title={t("scripts.templateDelete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-end mt-4 pt-4 border-t border-border-muted">
            <button
              onClick={() => onOpenChange(false)}
              className="h-[32px] px-4 rounded-md font-sans text-[13px] font-medium text-fg-secondary bg-bg-hover hover:bg-bg-active cursor-pointer transition-colors"
            >
              {t("common.close")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ScriptEditor({ value, onChange, placeholder }: ScriptEditorProps) {
  const { t } = useTranslation();
  const [showSnippets, setShowSnippets] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [templates, setTemplates] = useState<ScriptTemplate[]>(FALLBACK_SNIPPETS);
  const editorRef = useRef<{ dispose?: () => void } | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const result = await listScriptTemplates();
      if (result.length > 0) {
        setTemplates(result);
      }
    } catch (err) {
      // Keep fallback snippets if IPC fails
      console.warn("Failed to load script templates:", err);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleEditorMount = useCallback((editor: { dispose?: () => void }) => {
    editorRef.current = editor;
  }, []);

  const handleBeforeMount = useCallback((monaco: typeof MonacoType) => {
    monaco.languages.registerCompletionItemProvider("javascript", {
      triggerCharacters: ["{"],
      provideCompletionItems: (model, position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const match = textUntilPosition.match(/\{\{[^}]*$/);
        if (!match) return { suggestions: [] };

        const envStore = (window as unknown as Record<string, unknown>)["__envStore"] as { getActiveVariables: () => Record<string, string> } | undefined;
        const variables = envStore?.getActiveVariables() ?? {};

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        return {
          suggestions: Object.entries(variables).map(([key, val]) => ({
            label: `{{${key}}}`,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: `{{${key}}}`,
            detail: val,
            range,
          })),
        };
      },
    });
  }, []);

  useEffect(() => {
    return () => {
      editorRef.current?.dispose?.();
      editorRef.current = null;
    };
  }, []);

  const handleSnippetSelect = useCallback(
    (code: string) => {
      const newValue = value ? value + "\n" + code : code;
      onChange(newValue);
    },
    [value, onChange]
  );

  const handleSaveAsTemplate = useCallback(
    async (name: string, description: string, category: string) => {
      const template: ScriptTemplate = {
        id: `user-${crypto.randomUUID()}`,
        name,
        description,
        code: value,
        category,
        isBuiltin: false,
      };
      try {
        await saveScriptTemplate(template);
        toast({ variant: "success", title: t("scripts.templateSaved"), description: name });
        await loadTemplates();
      } catch (err) {
        toast({
          variant: "error",
          title: t("scripts.templateSaveFailed"),
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [value, loadTemplates, t]
  );

  const handleDeleteTemplate = useCallback(
    async (template: ScriptTemplate) => {
      if (template.isBuiltin) return;
      try {
        await deleteScriptTemplate(template.id);
        toast({ variant: "success", title: t("scripts.templateDeleted"), description: template.name });
        await loadTemplates();
      } catch (err) {
        toast({
          variant: "error",
          title: t("scripts.templateDeleteFailed"),
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [loadTemplates, t]
  );

  return (
    <div className="script-editor relative flex flex-col h-full">
      <div className="script-editor-toolbar flex items-center justify-between h-[32px] px-3 border-b border-border-muted shrink-0">
        <span className="font-sans text-[11px] text-fg-tertiary">{t("scripts.language")}</span>
        <div className="flex items-center gap-1 relative">
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={!value.trim()}
            className="flex items-center gap-1 h-[24px] px-2 rounded-[4px] font-sans text-[11px] font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-hover cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={t("scripts.saveAsTemplate")}
          >
            <Save size={12} />
            {t("scripts.saveAsTemplate")}
          </button>
          <button
            onClick={() => setShowManageDialog(true)}
            className="flex items-center gap-1 h-[24px] px-2 rounded-[4px] font-sans text-[11px] font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-hover cursor-pointer transition-colors"
            title={t("scripts.manageTemplates")}
          >
            <Bookmark size={12} />
            {t("scripts.manageTemplates")}
          </button>
          <button
            onClick={() => setShowSnippets(!showSnippets)}
            className="flex items-center gap-1 h-[24px] px-2 rounded-[4px] font-sans text-[11px] font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-hover cursor-pointer transition-colors"
          >
            <Sparkles size={12} />
            {t("scripts.snippets")}
          </button>
          {showSnippets && (
            <SnippetMenu
              templates={templates}
              onSelect={handleSnippetSelect}
              onClose={() => setShowSnippets(false)}
            />
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<LoadingPlaceholder />}>
          <MonacoEditor
            height="100%"
            language="javascript"
            theme="vs-dark"
            value={value}
            onChange={(v) => onChange(v ?? "")}
            onMount={handleEditorMount}
            beforeMount={handleBeforeMount}
            options={{
              fontSize: 12,
              fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              renderLineHighlight: "line",
              wordWrap: "on",
              automaticLayout: true,
              tabSize: 2,
              padding: { top: 8 },
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              placeholder: placeholder ?? "",
            }}
          />
        </Suspense>
      </div>
      <SaveTemplateDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSaveAsTemplate}
      />
      <ManageTemplatesDialog
        open={showManageDialog}
        onOpenChange={setShowManageDialog}
        templates={templates}
        onDelete={handleDeleteTemplate}
      />
    </div>
  );
}
