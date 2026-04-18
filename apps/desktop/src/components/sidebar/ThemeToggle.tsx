import { Moon, Sun, Monitor } from "lucide-react";
import { useUIStore, type Theme } from "@api-client/core";

const THEME_CYCLE: Theme[] = ["dark", "light", "system"];
const THEME_LABELS: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark") return <Moon className="w-4 h-4" />;
  if (theme === "light") return <Sun className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
}

export function ThemeToggle() {
  const theme = useUIStore((s) => s.theme);

  const cycleTheme = () => {
    const currentIdx = THEME_CYCLE.indexOf(theme);
    const next = THEME_CYCLE[(currentIdx + 1) % THEME_CYCLE.length] ?? "dark";
    useUIStore.getState().setTheme(next);
  };

  return (
    <button
      onClick={cycleTheme}
      className="flex items-center gap-1 px-2 py-1.5 hover:bg-bg-hover rounded transition-colors text-fg-tertiary hover:text-fg-secondary"
      title={`Theme: ${THEME_LABELS[theme]}. Click to switch.`}
    >
      <ThemeIcon theme={theme} />
      <span className="text-xs font-medium">{THEME_LABELS[theme]}</span>
    </button>
  );
}