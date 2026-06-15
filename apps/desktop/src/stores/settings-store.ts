import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

const SETTINGS_KEY = "api-client-settings";

export interface AppSettings {
  fontSize: string;
  timeout: string;
  followRedirects: boolean;
  maxRedirects: string;
  verifySSL: boolean;
  proxyUrl: string;
  bypassList: string;
  codeFont: string;
  codeFontSize: string;
  uiFontSize: string;
  defaultEnv: string;
  autoSave: boolean;
}

const defaults: AppSettings = {
  fontSize: "15",
  timeout: "30000",
  followRedirects: true,
  maxRedirects: "10",
  verifySSL: true,
  proxyUrl: "",
  bypassList: "",
  codeFont: "JetBrains Mono",
  codeFontSize: "14",
  uiFontSize: "15",
  defaultEnv: "development",
  autoSave: true,
};

async function loadSettings(): Promise<AppSettings> {
  try {
    const saved = await invoke<string | null>("load_app_settings");
    if (saved) return { ...defaults, ...JSON.parse(saved) };
  } catch {}
  try {
    const fallback = localStorage.getItem(SETTINGS_KEY);
    if (fallback) return { ...defaults, ...JSON.parse(fallback) };
  } catch {}
  return defaults;
}

function persistSettings(settings: AppSettings) {
  invoke("save_app_settings", { settings: JSON.stringify(settings) }).catch((e) => console.error("Failed to persist settings:", e));
}

function applyFontSize(size: string) {
  document.documentElement.style.fontSize = `${size}px`;
}

function applyCodeFont(font: string, size: string) {
  document.documentElement.style.setProperty("--code-font", font);
  document.documentElement.style.setProperty("--code-font-size", `${size}px`);
}

export const useSettingsStore = create<AppSettings & { updateSetting: (key: keyof AppSettings, value: string | boolean) => void }>()((set) => ({
  ...defaults,
  updateSetting: (key, value) => {
    set((state) => {
      const newState = { ...state, [key]: value };
      persistSettings(newState);
      if (key === "fontSize" || key === "uiFontSize") {
        applyFontSize(typeof value === "string" ? value : state.fontSize);
      }
      if (key === "codeFont" || key === "codeFontSize") {
        const font = key === "codeFont" ? (value as string) : state.codeFont;
        const fontsize = key === "codeFontSize" ? (value as string) : state.codeFontSize;
        applyCodeFont(font, fontsize);
      }
      return newState;
    });
  },
}));

loadSettings().then((loaded) => {
  useSettingsStore.setState(loaded);
  applyFontSize(loaded.fontSize);
  applyCodeFont(loaded.codeFont, loaded.codeFontSize);
});

applyFontSize(defaults.fontSize);
applyCodeFont(defaults.codeFont, defaults.codeFontSize);