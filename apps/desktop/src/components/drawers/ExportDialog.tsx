import { useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Copy, Check, Download } from "lucide-react";
import { exportCollection, type ExportFormat, type ExportOptions, type ExportCollection } from "@api-client/core";
import { useCollectionStore } from "../../stores/collection-store";
import { getCollection, type IpcCollectionItem } from "@api-client/core/http";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; description: string }[] = [
  { value: "postman", label: "Postman v2.1", description: "Postman Collection JSON format" },
  { value: "curl", label: "cURL", description: "cURL command(s)" },
  { value: "har", label: "HAR 1.2", description: "HTTP Archive JSON format" },
];

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const collections = useCollectionStore((s) => s.collections);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [format, setFormat] = useState<ExportFormat>("postman");
  const [includeScripts, setIncludeScripts] = useState(true);
  const [includeVariables, setIncludeVariables] = useState(true);
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedCollection = collections.find((c) => c.id === selectedCollectionId);

  const handleExport = useCallback(async () => {
    if (!selectedCollectionId) return;
    try {
      const ipcCollection = await getCollection(selectedCollectionId);
      const exportData: ExportCollection = {
        name: ipcCollection.name,
        requests: flattenIpcItems(ipcCollection.items).map((item: IpcCollectionItem) => ({
          name: item.name ?? "",
          method: item.method ?? "GET",
          url: item.url ?? "",
          headers: (item.headers ?? []).map((h: { key: string; value: string; disabled: boolean }) => ({ key: h.key, value: h.value, disabled: h.disabled ?? false })),
          params: (item.params ?? []).map((p: { key: string; value: string; disabled: boolean }) => ({ key: p.key, value: p.value, disabled: p.disabled ?? false })),
          body: item.body ? { mode: item.body.mode, content: item.body.content, content_type: item.body.content_type, language: item.body.language } : undefined,
          auth: item.auth ? { type: item.auth.type, config: item.auth.config ?? {} } : undefined,
          scripts: item.scripts ? { preRequest: item.scripts.pre_request, postResponse: item.scripts.post_response } : undefined,
        })),
        variables: ipcCollection.config?.variables?.map((v: { key: string; value: string; enabled: boolean }) => ({ key: v.key, value: v.value })),
      };

      const options: ExportOptions = { format, includeScripts, includeVariables };
      const result = exportCollection(exportData, options);
      setOutput(result);
    } catch (e) {
      setOutput(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [selectedCollectionId, format, includeScripts, includeVariables]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleDownload = useCallback(() => {
    if (!output || !selectedCollection) return;
    const ext = format === "postman" ? "postman.json" : format === "har" ? "har.json" : "curl.sh";
    const blob = new Blob([output], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedCollection.name}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [output, selectedCollection, format]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedCollectionId("");
      setOutput("");
      setCopied(false);
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
              Export Collection
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-4 flex flex-col gap-3 flex-1 overflow-auto">
            <label className="flex items-center gap-2 text-xs text-fg-secondary">
              Collection:
              <select
                value={selectedCollectionId}
                onChange={(e) => { setSelectedCollectionId(e.target.value); setOutput(""); }}
                className="h-7 px-2 bg-bg-input border border-border-default rounded-md text-fg-primary text-xs focus:border-border-focus outline-none"
              >
                <option value="">Select...</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-2 text-xs text-fg-secondary">
              Format:
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setFormat(opt.value); setOutput(""); }}
                  className={`h-7 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors ${format === opt.value ? "bg-brand text-white" : "bg-bg-hover text-fg-secondary hover:text-fg-primary"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs text-fg-secondary">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" checked={includeScripts} onChange={(e) => { setIncludeScripts(e.target.checked); setOutput(""); }} className="accent-brand" />
                Include scripts
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" checked={includeVariables} onChange={(e) => { setIncludeVariables(e.target.checked); setOutput(""); }} className="accent-brand" />
                Include variables
              </label>
            </div>

            <button
              onClick={handleExport}
              disabled={!selectedCollectionId}
              className="h-8 px-4 bg-brand hover:bg-brand-hover text-white text-xs font-medium rounded-md cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Export
            </button>

            {output && (
              <div className="relative flex-1 min-h-[100px]">
                <pre className="w-full h-full p-3 bg-bg-input border border-border-default rounded-md text-fg-primary text-[11px] font-mono overflow-auto whitespace-pre-wrap">
                  {output}
                </pre>
              </div>
            )}
          </div>

          <div className="h-10 px-4 flex items-center justify-end gap-2 border-t border-border-default">
            {output && (
              <>
                <button
                  onClick={handleCopy}
                  className="h-7 px-3 text-[11px] text-fg-secondary border border-border-default rounded-md hover:text-brand hover:border-brand hover:bg-brand/10 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3 h-3 text-accent-success" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={handleDownload}
                  className="h-7 px-3 text-[11px] text-fg-secondary border border-border-default rounded-md hover:text-brand hover:border-brand hover:bg-brand/10 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3 h-3" /> Download
                </button>
              </>
            )}
            <button
              onClick={() => handleOpenChange(false)}
              className="h-7 px-3 text-[11px] text-fg-secondary hover:text-fg-primary transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function flattenIpcItems(items: IpcCollectionItem[]): IpcCollectionItem[] {
  const result: IpcCollectionItem[] = [];
  for (const item of items) {
    if (item.type === "request") result.push(item);
    else if (item.type === "folder" && item.items) result.push(...flattenIpcItems(item.items));
  }
  return result;
}