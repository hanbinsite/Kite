import { useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Upload, Clipboard, FileText, AlertCircle } from "lucide-react";
import { importCollection, detectFormat, type ImportResult } from "@api-client/core";
import { useCollectionStore } from "../../stores/collection-store";
import { saveCollection, type IpcCollectionItem } from "@api-client/core/http";
import type { BodyConfig, AuthConfig } from "@api-client/types";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function importBodyToBodyConfig(body: ImportResult["requests"][0]["body"]): BodyConfig | null {
  if (!body) return null;
  if (body.mode === "raw") return { mode: "raw", raw: { language: (body.language ?? "json") as "json", content: body.content ?? "" } };
  if (body.mode === "urlencoded") return { mode: "urlencoded", urlencoded: [] };
  if (body.mode === "formdata") return { mode: "formdata", formdata: [] };
  return null;
}

function importAuthToAuthConfig(auth: ImportResult["requests"][0]["auth"]): AuthConfig {
  if (!auth) return { type: "none", config: {} };
  return { type: auth.type as AuthConfig["type"], config: auth.config as never } as AuthConfig;
}

function importRequestToIpcItem(req: ImportResult["requests"][0]): IpcCollectionItem {
  const body = req.body
    ? { mode: req.body.mode, content: req.body.content, content_type: req.body.content_type, language: req.body.language, formdata: [], urlencoded: [], graphql_query: undefined, graphql_variables: undefined }
    : undefined;
  const auth = req.auth ? { type: req.auth.type, config: req.auth.config as Record<string, unknown> | null } : undefined;
  const settings = { timeout_ms: 30000, follow_redirects: true, max_redirects: 10, verify_ssl: true };

  return {
    type: "request",
    id: crypto.randomUUID(),
    name: req.name,
    method: req.method,
    url: req.url,
    headers: req.headers.map((h) => ({ key: h.key, value: h.value, disabled: h.disabled })),
    params: req.params.map((p) => ({ key: p.key, value: p.value, disabled: p.disabled })),
    body,
    auth,
    scripts: { pre_request: undefined, post_response: undefined },
    settings,
  };
}

const FORMAT_LABELS: Record<string, string> = {
  curl: "cURL",
  postman: "Postman Collection",
  har: "HAR 1.2",
  openapi: "OpenAPI",
  unknown: "Unknown",
};

export function ImportDialog({ isOpen, onClose }: ImportDialogProps) {
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const detectedFormat = input.trim() ? detectFormat(input.trim()) : null;

  const handlePreview = useCallback(() => {
    if (!input.trim()) return;
    const result = importCollection(input.trim());
    setPreview(result);
  }, [input]);

  const handleImport = useCallback(async () => {
    if (!preview || preview.requests.length === 0) return;
    setImporting(true);

    try {
      const collectionId = crypto.randomUUID();
      const items: IpcCollectionItem[] = preview.requests.map(importRequestToIpcItem);
      const collection = {
        id: collectionId,
        name: preview.collectionName,
        items,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveCollection(collection);

      useCollectionStore.getState().setCollections([
        ...useCollectionStore.getState().collections,
        { id: collectionId, name: preview.collectionName, items: preview.requests.map((r) => ({
          type: "request" as const,
          id: crypto.randomUUID(),
          method: r.method,
          name: r.name,
          url: r.url,
          auth: r.auth ? importAuthToAuthConfig(r.auth) : undefined,
          body: importBodyToBodyConfig(r.body) ?? undefined,
        })) },
      ]);

      setInput("");
      setPreview(null);
      onClose();
    } catch (e) {
      console.error("Import failed:", e);
    } finally {
      setImporting(false);
    }
  }, [preview, onClose]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
    } catch {
      // clipboard access denied
    }
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setInput(text);
    };
    reader.readAsText(file);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setInput("");
      setPreview(null);
      onClose();
    }
  }, [onClose]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-modal animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] max-h-[520px] bg-bg-elevated/85 backdrop-blur-[20px] border border-white/[0.06] rounded-xl shadow-xl z-modal flex flex-col overflow-hidden">
          <div className="h-12 flex items-center justify-between px-4 border-b border-border-default">
            <Dialog.Title className="font-sans text-sm font-semibold text-fg-primary">
              Import
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-4 flex flex-col gap-3 flex-1 overflow-auto">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePaste}
                className="h-7 px-3 text-[11px] text-fg-secondary border border-border-default rounded-md hover:text-brand hover:border-brand hover:bg-brand/10 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Clipboard className="w-3 h-3" /> Paste
              </button>
              <label className="h-7 px-3 text-[11px] text-fg-secondary border border-border-default rounded-md hover:text-brand hover:border-brand hover:bg-brand/10 transition-colors cursor-pointer flex items-center gap-1.5">
                <Upload className="w-3 h-3" /> File
                <input type="file" accept=".json,.har,.yaml,.yml" className="hidden" onChange={handleFileUpload} />
              </label>
              {detectedFormat && detectedFormat !== "unknown" && (
                <span className="text-[11px] text-brand ml-auto flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {FORMAT_LABELS[detectedFormat] ?? detectedFormat}
                </span>
              )}
            </div>

            <textarea
              value={input}
              onChange={(e) => { setInput(e.target.value); setPreview(null); }}
              placeholder="Paste cURL command, Postman Collection JSON, or HAR JSON here..."
              className="w-full h-32 p-3 bg-bg-input border border-border-default rounded-md text-fg-primary text-xs font-mono resize-none focus:border-border-focus outline-none placeholder:text-fg-tertiary"
              spellCheck={false}
            />

            <button
              onClick={handlePreview}
              disabled={!input.trim()}
              className="h-8 px-4 bg-bg-hover hover:bg-bg-active text-fg-primary text-xs font-medium rounded-md cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Preview Import
            </button>

            {preview && (
              <div className="border border-border-default rounded-md overflow-hidden">
                {preview.errors.length > 0 && (
                  <div className="px-3 py-2 bg-accent-danger/10 border-b border-border-default">
                    {preview.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-accent-danger">
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        {err}
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-3 py-2">
                  <div className="text-xs text-fg-secondary mb-1">
                    {preview.requests.length} request{preview.requests.length !== 1 ? "s" : ""} will be imported as "{preview.collectionName}"
                  </div>
                  <div className="max-h-[120px] overflow-auto space-y-0.5">
                    {preview.requests.map((req, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] text-fg-secondary">
                        <span className={`font-semibold ${req.method === "GET" ? "text-method-get" : req.method === "POST" ? "text-method-post" : req.method === "DELETE" ? "text-accent-danger" : "text-fg-secondary"}`}>
                          {req.method}
                        </span>
                        <span className="text-fg-primary truncate">{req.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-10 px-4 flex items-center justify-end gap-2 border-t border-border-default">
            <button
              onClick={() => handleOpenChange(false)}
              className="h-7 px-3 text-[11px] text-fg-secondary hover:text-fg-primary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!preview || preview.requests.length === 0 || importing}
              className="h-7 px-4 bg-brand hover:bg-brand-hover text-white text-[11px] font-medium rounded-md cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? "Importing..." : "Import"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
