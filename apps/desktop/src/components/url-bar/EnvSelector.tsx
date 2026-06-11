import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus, Trash2, Settings as SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEnvironmentStore } from "../../stores/environment-store";
import { useUIStore } from "@api-client/core";
import { EnvironmentEditor } from "../environment";

const ENV_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  dev: {
    text: "text-accent-success",
    bg: "bg-accent-success/10",
    border: "border-accent-success/20",
  },
  staging: {
    text: "text-accent-warning",
    bg: "bg-accent-warning/10",
    border: "border-accent-warning/20",
  },
  production: {
    text: "text-accent-danger",
    bg: "bg-accent-danger/10",
    border: "border-accent-danger/20",
  },
};

const DEFAULT_STYLE = {
  text: "text-fg-secondary",
  bg: "bg-bg-elevated",
  border: "border-border-muted",
};

function getEnvKey(env?: { id: string; envType?: string }): string {
  if (env?.envType) return env.envType;
  const lower = env?.id?.toLowerCase() ?? "";
  if (lower.includes("dev")) return "dev";
  if (lower.includes("staging")) return "staging";
  if (lower.includes("prod")) return "production";
  return "";
}

export function EnvSelector() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
  const addEnvironment = useEnvironmentStore((s) => s.addEnvironment);
  const deleteEnvironment = useEnvironmentStore((s) => s.deleteEnvironment);
  const openSettings = useUIStore((s) => s.openSettings);

  const activeEnv = environments.find((e) => e.id === activeEnvId);
  const envKey = getEnvKey(activeEnv);
  const style = ENV_STYLES[envKey] || DEFAULT_STYLE;

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, close]);

  const dropdownStyle = (() => {
    if (!triggerRef.current) return { position: "fixed" as const, top: 0, right: 0 };
    const rect = triggerRef.current.getBoundingClientRect();
    return {
      position: "fixed" as const,
      top: rect.bottom + 4,
      left: rect.right - 220,
    };
  })();

  const handleAddEnv = () => {
    const id = `env-${Date.now()}`;
    addEnvironment({ id, name: "New Environment", variables: [], isActive: false });
    setActiveEnvironment(id);
    close();
  };

  const handleEditEnv = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEnvId(id);
    close();
  };

  const handleManageEnvs = () => {
    close();
    openSettings("environments");
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 h-[22px] px-2.5 rounded-full text-2xs font-medium border ${style.text} ${style.bg} ${style.border}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {activeEnv?.name || "No Env"}
        <ChevronDown size={10} className="opacity-50" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            data-env-dropdown
            className="w-[220px] bg-bg-elevated rounded-lg border border-border-muted shadow-lg py-1 animate-fade-in"
            style={{ ...dropdownStyle, zIndex: 200 }}
          >
    {environments.map((env) => {
      const envK = getEnvKey(env);
      const dotColor = ENV_STYLES[envK]?.text || "text-fg-tertiary";
              const isActive = env.id === activeEnvId;
              return (
                <div
                  key={env.id}
                  className="flex items-center group"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveEnvironment(env.id);
                      close();
                    }}
                    className="flex items-center gap-2 flex-1 h-7 px-3 text-xs hover:bg-bg-hover"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor} bg-current`} />
                    <span className="flex-1 text-left text-fg-primary">{env.name}</span>
                    {isActive && <Check size={12} className="text-brand" />}
                  </button>
                  <button
                    onClick={(e) => handleEditEnv(env.id, e)}
                    className="p-1 mr-1 opacity-0 group-hover:opacity-100 hover:bg-bg-hover rounded"
                    title="Edit environment"
                  >
                    <SettingsIcon className="w-3 h-3 text-fg-tertiary" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (deleteConfirmId === env.id) {
                        deleteEnvironment(env.id);
                        setDeleteConfirmId(null);
                      } else {
                        setDeleteConfirmId(env.id);
                      }
                    }}
                    onMouseLeave={() => { if (deleteConfirmId === env.id) setDeleteConfirmId(null); }}
                    className={`p-1 mr-1 opacity-0 group-hover:opacity-100 hover:bg-bg-hover rounded ${deleteConfirmId === env.id ? "text-accent-danger bg-accent-danger/10" : "text-fg-tertiary"}`}
                    title={t("sidebar.deleteCollection")}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            <div className="border-t border-border-muted mt-1 pt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddEnv();
                }}
                className="flex items-center gap-2 w-full h-7 px-3 text-xs text-fg-secondary hover:bg-bg-hover"
              >
                <Plus className="w-3 h-3" />
                <span>Add Environment</span>
              </button>
              <button
                onClick={handleManageEnvs}
                className="flex items-center gap-2 w-full h-7 px-3 text-xs text-fg-secondary hover:bg-bg-hover"
              >
                <SettingsIcon className="w-3 h-3" />
                <span>Manage Environments</span>
              </button>
            </div>
          </div>,
          document.body,
        )}

      {/* Environment Editor Dialog */}
      {editingEnvId && (
        <EnvironmentEditor
          environmentId={editingEnvId}
          isOpen={!!editingEnvId}
          onClose={() => setEditingEnvId(null)}
        />
      )}
    </>
  );
}
