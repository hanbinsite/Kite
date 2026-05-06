import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEnvironmentStore } from "../../stores/environment-store";
import { KeyValueEditor, type KeyValue } from "../request/KeyValueEditor";
import type { Variable } from "@api-client/types";

interface EnvironmentEditorProps {
  environmentId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ENV_TYPES = [
  { id: "dev", label: "Development" },
  { id: "staging", label: "Staging" },
  { id: "production", label: "Production" },
] as const;

function variablesToKv(variables: Variable[]): KeyValue[] {
  return variables.map((v) => ({
    id: crypto.randomUUID(),
    key: v.key,
    value: v.value,
    enabled: v.enabled,
    description: "",
  }));
}

function kvToVariables(kvs: KeyValue[]): Variable[] {
  return kvs
    .filter((kv) => kv.key)
    .map((kv) => ({
      key: kv.key,
      value: kv.value,
      enabled: kv.enabled,
    }));
}

function ensureEmptyRow(items: KeyValue[]): KeyValue[] {
  const last = items[items.length - 1];
  if (!last || last.key || last.value) {
    return [...items, { id: crypto.randomUUID(), key: "", value: "", enabled: true, description: "" }];
  }
  return items;
}

export function EnvironmentEditor({ environmentId, isOpen, onClose }: EnvironmentEditorProps) {
  const environment = useEnvironmentStore((s) => s.environments.find((e) => e.id === environmentId));
  const updateEnvironment = useEnvironmentStore((s) => s.updateEnvironment);
  const persistEnvironment = useEnvironmentStore((s) => s.persistEnvironment);

  const [name, setName] = useState("");
  const [envType, setEnvType] = useState<"dev" | "staging" | "production" | undefined>(undefined);
  const [variables, setVariables] = useState<KeyValue[]>([]);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    if (environment && isOpen) {
      setName(environment.name);
      setEnvType(environment.envType);
      setVariables(ensureEmptyRow(variablesToKv(environment.variables)));
      setNameError("");
    }
  }, [environment, isOpen]);

  const handleSave = () => {
    // 验证���称
    if (!name.trim()) {
      setNameError("Environment name is required");
      return;
    }

    // 保存
    updateEnvironment(environmentId, {
      name: name.trim(),
      envType,
      variables: kvToVariables(variables),
    });

    // 持���化
    persistEnvironment(environmentId);

    onClose();
  };

  const handleVariablesChange = (newItems: KeyValue[]) => {
    setVariables(ensureEmptyRow(newItems));
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  if (!environment) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-bg-overlay backdrop-blur-[4px] z-modal animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] max-h-[80vh] bg-bg-surface border border-border-default rounded-xl shadow-lg flex flex-col overflow-hidden" style={{ zIndex: 410 }}>
          {/* Header */}
          <div className="flex items-center h-12 px-5 border-b border-border-muted shrink-0">
            <Dialog.Title className="font-sans text-base font-semibold text-fg-primary">
              Edit Environment: {environment.name}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                className="ml-auto w-7 h-7 flex items-center justify-center rounded-sm text-fg-tertiary cursor-pointer transition-all duration-50 hover:bg-bg-hover hover:text-fg-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex flex-col gap-4">
              {/* Environment Name */}
              <div className="flex flex-col gap-2">
                <label className="font-sans text-[11px] font-semibold text-fg-secondary">
                  Environment Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError("");
                  }}
                  placeholder="e.g. Development"
                  className={`w-full h-[32px] px-3 bg-bg-input border rounded-md font-sans text-[13px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary ${
                    nameError ? "border-accent-danger" : "border-border-muted"
                  }`}
                />
                {nameError && (
                  <span className="text-[11px] text-accent-danger">{nameError}</span>
                )}
              </div>

              {/* Environment Type */}
              <div className="flex flex-col gap-2">
                <label className="font-sans text-[11px] font-semibold text-fg-secondary">
                  Environment Type
                </label>
                <div className="flex items-center gap-3">
                  {ENV_TYPES.map((type) => (
                    <label
                      key={type.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="envType"
                        checked={envType === type.id}
                        onChange={() => setEnvType(type.id)}
                        className="w-4 h-4 accent-brand cursor-pointer"
                      />
                      <span className="font-sans text-[13px] text-fg-primary">
                        {type.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Variables */}
              <div className="flex flex-col gap-2">
                <label className="font-sans text-[11px] font-semibold text-fg-secondary">
                  Variables
                </label>
                <div className="border border-border-muted rounded-md overflow-hidden h-[280px]">
                  <KeyValueEditor
                    items={variables}
                    onChange={handleVariablesChange}
                    placeholder={{ key: "Variable Name", value: "Value" }}
                    showDescription={false}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 h-14 px-5 border-t border-border-muted shrink-0">
            <button
              onClick={onClose}
              className="h-8 px-4 rounded-md font-sans text-[13px] font-medium text-fg-secondary hover:bg-bg-hover cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="h-8 px-4 rounded-md font-sans text-[13px] font-medium text-white bg-brand hover:bg-brand-hover cursor-pointer transition-colors"
            >
              Save Changes
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
