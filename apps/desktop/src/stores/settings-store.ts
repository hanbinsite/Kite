import { create } from "zustand";

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

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return { ...defaults, ...JSON.parse(saved) };
  } catch {}
  return defaults;
}

function applyFontSize(size: string) {
  document.documentElement.style.fontSize = `${size}px`;
}

function applyCodeFont(font: string, size: string) {
  document.documentElement.style.setProperty("--code-font", font);
  document.documentElement.style.setProperty("--code-font-size", `${size}px`);
}

export const useSettingsStore = create<AppSettings & { updateSetting: (key: keyof AppSettings, value: string | boolean) => void }>()((set) => ({
  ...loadSettings(),
  updateSetting: (key, value) => {
    set((state) => {
      const newState = { ...state, [key]: value };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newState));
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

const initialSettings = loadSettings();
applyFontSize(initialSettings.fontSize);
applyCodeFont(initialSettings.codeFont, initialSettings.codeFontSize);