import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Search, Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { useEnvironmentStore } from "../../stores/environment-store";
import { useTranslation } from "react-i18next";

interface VariableInspectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VariableInspector({ isOpen, onClose }: VariableInspectorProps) {
  const { t } = useTranslation();
  const environments = useEnvironmentStore((s) => s.environments);
  const globals = useEnvironmentStore((s) => s.globals);
  const [search, setSearch] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedScopes, setExpandedScopes] = useState<Set<string>>(new Set(["globals", "environment", "collection"]));

  const toggleScope = (scope: string) => {
    setExpandedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const copyValue = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSearch("");
      onClose();
    }
  };

  const filteredGlobals = globals.filter((v) =>
    v.key.toLowerCase().includes(search.toLowerCase()) ||
    v.value.toLowerCase().includes(search.toLowerCase()),
  );

  const scopeData: { scope: string; label: string; vars: { key: string; value: string; enabled: boolean }[] }[] = [
    { scope: "globals", label: t("variableInspector.globals"), vars: filteredGlobals },
    ...environments.map((env) => ({
      scope: `env-${env.id}`,
      label: env.name,
      vars: env.variables.filter((v) =>
        v.key.toLowerCase().includes(search.toLowerCase()) ||
        v.value.toLowerCase().includes(search.toLowerCase()),
      ),
    })),
  ];

  const totalVars = scopeData.reduce((sum, s) => sum + s.vars.length, 0);

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-modal animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-h-[400px] bg-bg-elevated/85 backdrop-blur-[20px] border border-white/[0.06] rounded-xl shadow-xl z-modal flex flex-col overflow-hidden">
          <div className="h-12 flex items-center justify-between px-4 border-b border-border-default">
            <Dialog.Title className="font-sans text-sm font-semibold text-fg-primary">
              {t("variableInspector.title")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-fg-primary cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="h-10 px-4 flex items-center gap-2 border-b border-border-default">
            <Search className="w-3.5 h-3.5 text-fg-tertiary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="flex-1 bg-transparent text-xs text-fg-primary placeholder:text-fg-tertiary outline-none"
            />
            <span className="text-[11px] text-fg-tertiary">{t("variableInspector.variableCount", { count: totalVars })}</span>
          </div>

          <div className="flex-1 overflow-auto">
            {scopeData.map(({ scope, label, vars }) => {
              const expanded = expandedScopes.has(scope);
              return (
                <div key={scope} className="border-b border-border-default last:border-b-0">
                  <button
                    onClick={() => toggleScope(scope)}
                    className="w-full h-8 flex items-center gap-2 px-4 text-xs text-fg-secondary hover:bg-bg-hover cursor-pointer transition-colors"
                  >
                    {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span className="font-semibold text-fg-primary">{label}</span>
                    <span className="text-fg-tertiary">{vars.length}</span>
                  </button>
                  {expanded && vars.length === 0 && (
                    <div className="px-4 py-2 text-[11px] text-fg-tertiary">{t("variableInspector.noVariables")}</div>
                  )}
                  {expanded && vars.map((v) => (
                    <div key={v.key} className="flex items-center gap-2 px-4 h-7 hover:bg-bg-hover group">
                      <span className={`text-xs font-mono font-medium min-w-[120px] truncate ${v.enabled ? "text-brand" : "text-fg-tertiary"}`}>
                        {v.key}
                      </span>
                      <span className={`flex-1 text-xs font-mono truncate ${v.enabled ? "text-fg-primary" : "text-fg-tertiary"}`}>
                        {v.value}
                      </span>
                      <button
                        onClick={() => copyValue(v.key, v.value)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-bg-active text-fg-tertiary hover:text-fg-primary cursor-pointer transition-all"
                      >
                        {copiedKey === v.key ? <Check className="w-3 h-3 text-accent-success" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}