import { useState, useEffect } from "react";
import { X, Settings, Globe, Type, Database, Info } from "lucide-react";
import { useUIStore } from "@api-client/core";
import type { Theme } from "@api-client/core";
import { useSettingsStore } from "../../stores/settings-store";

const FONT_SIZE_OPTIONS = [
  { value: "14", label: "14px" },
  { value: "15", label: "15px" },
  { value: "16", label: "16px" },
  { value: "17", label: "17px" },
  { value: "18", label: "18px" },
  { value: "19", label: "19px" },
  { value: "20", label: "20px" },
];

const CATEGORIES = [
  { id: "general", label: "General", icon: Settings },
  { id: "proxy", label: "Proxy", icon: Globe },
  { id: "fonts", label: "Fonts", icon: Type },
  { id: "data", label: "Data", icon: Database },
  { id: "about", label: "About", icon: Info },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

function SettingsToggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      className={`relative w-9 h-5 rounded-[10px] cursor-pointer transition-[background] duration-[180ms] shrink-0 ${
        active ? "bg-brand" : "bg-bg-active"
      }`}
    >
      <span
        className={`absolute top-[2px] w-4 h-4 rounded-full transition-[left,background] duration-[180ms] ${
          active ? "left-[18px] bg-white" : "left-[2px] bg-fg-secondary"
        }`}
      />
    </button>
  );
}

export function SettingsPage() {
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const [category, setCategory] = useState<CategoryId>("general");

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [settingsOpen, closeSettings]);

  useEffect(() => {
    if (!settingsOpen) setCategory("general");
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center animate-fade-in" onClick={closeSettings}>
      <div className="absolute inset-0 bg-bg-overlay backdrop-blur-[4px]" />
      <div
        className="relative w-[680px] h-[560px] bg-bg-surface border border-border-default rounded-xl shadow-lg flex flex-col overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center h-12 px-5 border-b border-border-muted shrink-0">
          <span className="font-sans text-lg font-semibold text-fg-primary">Settings</span>
          <button
            onClick={closeSettings}
            className="ml-auto w-7 h-7 flex items-center justify-center rounded-sm text-fg-tertiary cursor-pointer transition-all duration-[50ms] hover:bg-bg-hover hover:text-fg-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-[160px] py-3 px-2 border-r border-border-muted shrink-0 overflow-y-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`w-full flex items-center gap-2 h-8 px-[10px] rounded-md font-sans text-[13px] cursor-pointer transition-all duration-[50ms] ${
                  category === cat.id
                    ? "bg-brand-muted text-brand font-medium"
                    : "text-fg-secondary font-normal hover:bg-bg-hover hover:text-fg-primary"
                }`}
              >
                <cat.icon className="w-4 h-4 shrink-0" />
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto py-5 px-6">
            {category === "general" && <GeneralSection />}
            {category === "proxy" && <ProxySection />}
            {category === "fonts" && <FontsSection />}
            {category === "data" && <DataSection />}
            {category === "about" && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between min-h-9 gap-4">
      <div className="flex-1">
        <div className="font-sans text-[13px] text-fg-primary">{label}</div>
        {desc && <div className="font-sans text-[11px] text-fg-tertiary mt-[2px]">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function SettingsSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-[180px] h-8 px-[10px] bg-bg-input border border-border-muted rounded-md font-sans text-[13px] text-fg-primary cursor-pointer outline-none transition-[border-color] duration-[100ms] shrink-0 focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function SettingsInput({ value, onChange, placeholder, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-[180px] h-8 px-[10px] bg-bg-input border border-border-muted rounded-md text-fg-primary outline-none transition-[border-color] duration-[100ms] shrink-0 focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)] placeholder:text-fg-tertiary ${
        mono ? "font-mono text-[12px]" : "font-sans text-[13px]"
      }`}
    />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-sans text-md font-semibold text-fg-primary mb-4">{children}</h3>;
}

function GeneralSection() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const defaultEnv = useSettingsStore((s) => s.defaultEnv);
  const autoSave = useSettingsStore((s) => s.autoSave);
  const timeout = useSettingsStore((s) => s.timeout);
  const verifySSL = useSettingsStore((s) => s.verifySSL);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  return (
    <div className="mb-6">
      <SectionTitle>General</SectionTitle>
      <div className="flex flex-col gap-3">
        <Field label="Theme" desc="Choose application color scheme">
          <SettingsSelect value={theme} onChange={(v) => setTheme(v as Theme)} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System" }]} />
        </Field>
        <Field label="Font Size" desc="Base UI font size">
          <SettingsSelect value={fontSize} onChange={(v) => updateSetting("fontSize", v)} options={FONT_SIZE_OPTIONS} />
        </Field>
        <Field label="Default Environment" desc="Environment used when none is selected">
          <SettingsSelect value={defaultEnv} onChange={(v) => updateSetting("defaultEnv", v)} options={[{ value: "development", label: "Development" }, { value: "staging", label: "Staging" }, { value: "production", label: "Production" }]} />
        </Field>
        <Field label="Auto Save" desc="Automatically save requests on change">
          <SettingsToggle active={autoSave} onChange={(v) => updateSetting("autoSave", v)} />
        </Field>
        <Field label="Request Timeout (ms)" desc="Maximum time for requests in milliseconds">
          <SettingsInput value={timeout} onChange={(v) => updateSetting("timeout", v)} placeholder="30000" mono />
        </Field>
        <Field label="SSL Verification" desc="Validate SSL certificates for HTTPS requests">
          <SettingsToggle active={verifySSL} onChange={(v) => updateSetting("verifySSL", v)} />
        </Field>
      </div>
    </div>
  );
}

function ProxySection() {
  const proxyUrl = useSettingsStore((s) => s.proxyUrl);
  const bypassList = useSettingsStore((s) => s.bypassList);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  return (
    <div className="mb-6">
      <SectionTitle>Proxy</SectionTitle>
      <div className="flex flex-col gap-3">
        <Field label="Proxy URL" desc="HTTP/HTTPS proxy server address">
          <SettingsInput value={proxyUrl} onChange={(v) => updateSetting("proxyUrl", v)} placeholder="http://proxy:8080" mono />
        </Field>
        <Field label="Proxy Bypass" desc="Hosts that bypass the proxy">
          <textarea
            value={bypassList}
            onChange={(e) => updateSetting("bypassList", e.target.value)}
            placeholder="localhost, 127.0.0.1"
            className="w-[180px] h-20 px-[10px] py-1 bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none transition-[border-color] duration-[100ms] shrink-0 resize-none placeholder:text-fg-tertiary focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)]"
          />
        </Field>
      </div>
    </div>
  );
}

function FontsSection() {
  const codeFont = useSettingsStore((s) => s.codeFont);
  const codeFontSize = useSettingsStore((s) => s.codeFontSize);
  const uiFontSize = useSettingsStore((s) => s.uiFontSize);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  return (
    <div className="mb-6">
      <SectionTitle>Fonts</SectionTitle>
      <div className="flex flex-col gap-3">
        <Field label="Code Font" desc="Font for Monaco Editor and code blocks">
          <SettingsSelect value={codeFont} onChange={(v) => updateSetting("codeFont", v)} options={[{ value: "JetBrains Mono", label: "JetBrains Mono" }, { value: "Fira Code", label: "Fira Code" }, { value: "Cascadia Code", label: "Cascadia Code" }, { value: "Source Code Pro", label: "Source Code Pro" }]} />
        </Field>
        <Field label="Code Font Size" desc="Editor font size in pixels">
          <SettingsSelect value={codeFontSize} onChange={(v) => updateSetting("codeFontSize", v)} options={FONT_SIZE_OPTIONS} />
        </Field>
        <Field label="UI Font Size" desc="Base UI font size in pixels">
          <SettingsSelect value={uiFontSize} onChange={(v) => updateSetting("uiFontSize", v)} options={FONT_SIZE_OPTIONS} />
        </Field>
      </div>
    </div>
  );
}

function DataSection() {
  return (
    <div className="mb-6">
      <SectionTitle>Data Management</SectionTitle>
      <div className="flex flex-col gap-3">
        <Field label="Export Data" desc="Export all collections, environments, and settings">
          <button className="h-8 px-4 rounded-md bg-bg-elevated border border-border-muted font-sans text-[13px] font-medium text-fg-primary cursor-pointer transition-all duration-[100ms] shrink-0 hover:bg-bg-hover">
            Export
          </button>
        </Field>
        <Field label="Import Data" desc="Import collections and settings from a file">
          <button className="h-8 px-4 rounded-md bg-bg-elevated border border-border-muted font-sans text-[13px] font-medium text-fg-primary cursor-pointer transition-all duration-[100ms] shrink-0 hover:bg-bg-hover">
            Import
          </button>
        </Field>
        <Field label="Clear History" desc="Remove all request history entries">
          <button className="h-8 px-4 rounded-md bg-transparent border border-accent-danger/30 font-sans text-[13px] font-medium text-accent-danger cursor-pointer transition-all duration-[100ms] shrink-0 hover:bg-accent-danger/12 hover:border-accent-danger">
            Clear
          </button>
        </Field>
        <Field label="Reset Settings" desc="Reset all settings to defaults">
          <button className="h-8 px-4 rounded-md bg-transparent border border-accent-danger/30 font-sans text-[13px] font-medium text-accent-danger cursor-pointer transition-all duration-[100ms] shrink-0 hover:bg-accent-danger/12 hover:border-accent-danger">
            Reset
          </button>
        </Field>
      </div>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="flex flex-col items-center py-6 gap-2 text-center">
      <Settings className="w-16 h-16 text-brand mb-2" />
      <div className="font-sans text-xl font-bold text-fg-primary">API Client</div>
      <div className="font-mono text-[12px] text-fg-tertiary">v0.1.0</div>
      <div className="font-sans text-[13px] text-fg-secondary max-w-[320px]">
        A modern, cross-platform API development toolkit built with Tauri 2.x + React 19
      </div>
      <div className="flex gap-4 mt-3">
        <a className="font-sans text-[12px] font-medium text-brand cursor-pointer transition-[color] duration-[100ms] hover:text-brand-hover">GitHub</a>
        <a className="font-sans text-[12px] font-medium text-brand cursor-pointer transition-[color] duration-[100ms] hover:text-brand-hover">Documentation</a>
        <a className="font-sans text-[12px] font-medium text-brand cursor-pointer transition-[color] duration-[100ms] hover:text-brand-hover">Changelog</a>
      </div>
    </div>
  );
}