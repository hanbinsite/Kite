import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useEnvironmentStore } from "../../stores/environment-store";

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

function getEnvKey(id: string): string {
	const lower = id.toLowerCase();
	if (lower.includes("dev")) return "dev";
	if (lower.includes("staging")) return "staging";
	if (lower.includes("prod")) return "production";
	return "";
}

export function EnvSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);

  const activeEnv = environments.find((e) => e.id === activeEnvId);
  const envKey = activeEnvId ? getEnvKey(activeEnvId) : "";
  const style = ENV_STYLES[envKey] || DEFAULT_STYLE;

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) close();
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
      left: rect.right - 192,
    };
  })();

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
            className="w-48 bg-bg-elevated rounded-lg border border-border-muted shadow-lg py-1 z-dropdown animate-fade-in"
            style={dropdownStyle}
          >
            {environments.map((env) => {
              const envK = getEnvKey(env.id);
              const dotColor = ENV_STYLES[envK]?.text || "text-fg-tertiary";
              const isActive = env.id === activeEnvId;
              return (
                <button
                  key={env.id}
                  onClick={() => {
                    setActiveEnvironment(env.id);
                    close();
                  }}
                  className="flex items-center gap-2 w-full h-7 px-3 text-xs hover:bg-bg-hover"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor} bg-current`} />
                  <span className="flex-1 text-left text-fg-primary">{env.name}</span>
                  {isActive && <Check size={12} className="text-brand" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
