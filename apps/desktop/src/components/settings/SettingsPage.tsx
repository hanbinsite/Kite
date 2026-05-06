import { useState, useEffect, useCallback, Fragment } from "react";
import { X, Settings, Globe, Type, Database, Info, Server, Cookie, Trash2, Leaf } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "@api-client/core";
import type { Theme } from "@api-client/core";
import { useSettingsStore } from "../../stores/settings-store";
import { useCookieStore } from "../../stores/cookie-store";
import { useEnvironmentStore } from "../../stores/environment-store";
import { clearHistory as clearHistoryIpc } from "@api-client/core/http";
import type { CookieEntry } from "@api-client/core/cookie";
import { EnvironmentEditor } from "../environment";
import { KeyValueEditor, type KeyValue } from "../request/KeyValueEditor";
import type { Variable } from "@api-client/types";

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
  { id: "general", labelKey: "settings.categories.general", icon: Settings },
  { id: "environments", labelKey: "settings.categories.environments", icon: Leaf },
  { id: "proxy", labelKey: "settings.categories.proxy", icon: Globe },
  { id: "mock", labelKey: "settings.categories.mock", icon: Server },
  { id: "cookies", labelKey: "settings.categories.cookies", icon: Cookie },
  { id: "fonts", labelKey: "settings.categories.fonts", icon: Type },
  { id: "data", labelKey: "settings.categories.data", icon: Database },
  { id: "about", labelKey: "settings.categories.about", icon: Info },
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
  const { t } = useTranslation();
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const settingsCategory = useUIStore((s) => s.settingsCategory);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const [category, setCategory] = useState<CategoryId>("general");
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);

  useEffect(() => {
    if (settingsCategory) {
      setCategory(settingsCategory as CategoryId);
    }
  }, [settingsCategory]);

  const handleCloseSettings = useCallback(() => {
    if (editingEnvId) {
      setEditingEnvId(null);
      return;
    }
    closeSettings();
  }, [editingEnvId, closeSettings]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseSettings();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [settingsOpen, handleCloseSettings]);

  useEffect(() => {
    if (!settingsOpen) setCategory("general");
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  return (
    <Fragment>
      <div className="fixed inset-0 z-modal flex items-center justify-center animate-fade-in" onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseSettings();
      }}>
        <div className="absolute inset-0 bg-bg-overlay backdrop-blur-[4px]" />
        <div
          className="relative w-[680px] h-[560px] bg-bg-surface border border-border-default rounded-xl shadow-lg flex flex-col overflow-hidden animate-fade-in-up"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center h-12 px-5 border-b border-border-muted shrink-0">
          <span className="font-sans text-lg font-semibold text-fg-primary">{t("settings.title")}</span>
          <button
            onClick={handleCloseSettings}
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
                {t(cat.labelKey)}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto py-5 px-6">
            {category === "general" && <GeneralSection />}
            {category === "environments" && <EnvironmentsSection onEditEnvironment={setEditingEnvId} />}
            {category === "proxy" && <ProxySection />}
            {category === "mock" && <MockSection />}
            {category === "cookies" && <CookiesSection />}
            {category === "fonts" && <FontsSection />}
            {category === "data" && <DataSection />}
            {category === "about" && <AboutSection />}
          </div>
        </div>
      </div>
      </div>

      {/* Environment Editor Dialog — rendered outside the Settings backdrop so clicks don't bubble */}
      {editingEnvId && (
        <EnvironmentEditor
          environmentId={editingEnvId}
          isOpen={!!editingEnvId}
          onClose={() => setEditingEnvId(null)}
        />
      )}
    </Fragment>
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
  const { t } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const language = useUIStore((s) => s.language);
  const setLanguage = useUIStore((s) => s.setLanguage);
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
        <Field label={t("settings.general.theme")} desc={t("settings.general.themeDesc")}>
          <SettingsSelect value={theme} onChange={(v) => setTheme(v as Theme)} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System" }]} />
        </Field>
        <Field label={t("settings.general.language")} desc={t("settings.general.languageDesc")}>
          <SettingsSelect
            value={language}
            onChange={(v) => {
              const next = v as "en" | "zh-CN";
              setLanguage(next);
            }}
            options={[
              { value: "zh-CN", label: t("settings.languageOptions.zhCN") },
              { value: "en", label: t("settings.languageOptions.en") },
            ]}
          />
        </Field>
        <Field label={t("settings.general.fontSize")} desc={t("settings.general.fontSizeDesc")}>
          <SettingsSelect value={fontSize} onChange={(v) => updateSetting("fontSize", v)} options={FONT_SIZE_OPTIONS} />
        </Field>
        <Field label={t("settings.general.defaultEnvironment")} desc={t("settings.general.defaultEnvironmentDesc")}>
          <SettingsSelect value={defaultEnv} onChange={(v) => updateSetting("defaultEnv", v)} options={[{ value: "development", label: "Development" }, { value: "staging", label: "Staging" }, { value: "production", label: "Production" }]} />
        </Field>
        <Field label={t("settings.general.autoSave")} desc={t("settings.general.autoSaveDesc")}>
          <SettingsToggle active={autoSave} onChange={(v) => updateSetting("autoSave", v)} />
        </Field>
        <Field label={t("settings.general.requestTimeout")} desc={t("settings.general.requestTimeoutDesc")}>
          <SettingsInput value={timeout} onChange={(v) => updateSetting("timeout", v)} placeholder="30000" mono />
        </Field>
        <Field label={t("settings.general.sslVerification")} desc={t("settings.general.sslVerificationDesc")}>
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
  const [clearConfirm, setClearConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const handleClearHistory = async () => {
    if (!clearConfirm) { setClearConfirm(true); return; }
    try { await clearHistoryIpc(); } catch (e) { console.error("Failed to clear history:", e); }
    setClearConfirm(false);
  };

  const handleResetSettings = () => {
    if (!resetConfirm) { setResetConfirm(true); return; }
    localStorage.removeItem("api-client-settings");
    window.location.reload();
  };

  return (
    <div className="mb-6">
      <SectionTitle>Data Management</SectionTitle>
      <div className="flex flex-col gap-3">
        <Field label="Export Data" desc="Export all collections, environments, and settings">
          <button
            onClick={() => { const data = localStorage.getItem("api-client-settings") ?? "{}"; const blob = new Blob([data], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "api-client-settings.json"; a.click(); URL.revokeObjectURL(url); }}
            className="h-8 px-4 rounded-md bg-bg-elevated border border-border-muted font-sans text-[13px] font-medium text-fg-primary cursor-pointer transition-all duration-[100ms] shrink-0 hover:bg-bg-hover"
          >
            Export
          </button>
        </Field>
        <Field label="Import Data" desc="Import collections and settings from a file">
          <button
            onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = ".json"; input.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => { try { JSON.parse(reader.result as string); localStorage.setItem("api-client-settings", reader.result as string); window.location.reload(); } catch { console.error("Invalid JSON file"); } }; reader.readAsText(file); } }; input.click(); }}
            className="h-8 px-4 rounded-md bg-bg-elevated border border-border-muted font-sans text-[13px] font-medium text-fg-primary cursor-pointer transition-all duration-[100ms] shrink-0 hover:bg-bg-hover"
          >
            Import
          </button>
        </Field>
        <Field label="Clear History" desc="Remove all request history entries">
          <button
            onClick={handleClearHistory}
            onBlur={() => setClearConfirm(false)}
            className={`h-8 px-4 rounded-md border font-sans text-[13px] font-medium cursor-pointer transition-all duration-[100ms] shrink-0 ${clearConfirm ? "bg-accent-danger text-white border-accent-danger" : "bg-transparent border-accent-danger/30 text-accent-danger hover:bg-accent-danger/12 hover:border-accent-danger"}`}
          >
            {clearConfirm ? "Confirm" : "Clear"}
          </button>
        </Field>
        <Field label="Reset Settings" desc="Reset all settings to defaults">
          <button
            onClick={handleResetSettings}
            onBlur={() => setResetConfirm(false)}
            className={`h-8 px-4 rounded-md border font-sans text-[13px] font-medium cursor-pointer transition-all duration-[100ms] shrink-0 ${resetConfirm ? "bg-accent-danger text-white border-accent-danger" : "bg-transparent border-accent-danger/30 text-accent-danger hover:bg-accent-danger/12 hover:border-accent-danger"}`}
          >
            {resetConfirm ? "Confirm" : "Reset"}
          </button>
        </Field>
      </div>
    </div>
  );
}

function EnvironmentsSection({ onEditEnvironment }: { onEditEnvironment: (id: string) => void }) {
  const environments = useEnvironmentStore((s) => s.environments);
  const addEnvironment = useEnvironmentStore((s) => s.addEnvironment);
  const deleteEnvironment = useEnvironmentStore((s) => s.deleteEnvironment);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const globals = useEnvironmentStore((s) => s.globals);
  const setGlobalVariable = useEnvironmentStore((s) => s.setGlobalVariable);

  const [globalVars, setGlobalVars] = useState<KeyValue[]>([]);

  useEffect(() => {
    setGlobalVars(ensureEmptyRow(variablesToKv(globals)));
  }, [globals]);

  const handleAddEnvironment = () => {
    const id = `env-${Date.now()}`;
    addEnvironment({
      id,
      name: "New Environment",
      variables: [],
      isActive: false,
    });
    onEditEnvironment(id);
  };

  const handleDeleteEnvironment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this environment?")) {
      deleteEnvironment(id);
    }
  };

  const handleGlobalVarsChange = (newItems: KeyValue[]) => {
    setGlobalVars(ensureEmptyRow(newItems));
    const variables = kvToVariables(newItems);
    // 更新全���变量
    variables.forEach((v) => {
      setGlobalVariable(v.key, v.value);
    });
  };

  const getEnvTypeColor = (envType?: string) => {
    switch (envType) {
      case "dev":
        return "text-accent-success";
      case "staging":
        return "text-accent-warning";
      case "production":
        return "text-accent-danger";
      default:
        return "text-fg-tertiary";
    }
  };

  return (
    <div className="mb-6">
      <SectionTitle>Environments</SectionTitle>

      <div className="flex flex-col gap-2 mb-4">
        {environments.map((env) => (
          <div
            key={env.id}
            className={`flex items-center gap-3 h-10 px-3 rounded-md border transition-colors cursor-pointer group ${
              env.id === activeEnvironmentId
                ? "border-brand bg-brand-muted"
                : "border-border-muted hover:bg-bg-hover"
            }`}
            onClick={() => onEditEnvironment(env.id)}
          >
            <span className={`w-2 h-2 rounded-full ${getEnvTypeColor(env.envType)} bg-current shrink-0`} />
            <span className="flex-1 font-sans text-[13px] text-fg-primary">{env.name}</span>
            <span className="font-sans text-[11px] text-fg-tertiary">
              {env.variables.length} variable{env.variables.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={(e) => handleDeleteEnvironment(env.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-accent-danger transition-all"
              title="Delete environment"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleAddEnvironment}
        className="w-full h-9 flex items-center justify-center gap-2 rounded-md border border-dashed border-border-muted text-fg-secondary hover:border-brand hover:text-brand hover:bg-brand-muted transition-colors cursor-pointer"
      >
        <span className="text-lg leading-none">+</span>
        <span className="font-sans text-[13px] font-medium">Add Environment</span>
      </button>

      {/* Global Variables Section */}
      <div className="mt-8">
        <h4 className="font-sans text-[13px] font-semibold text-fg-primary mb-3">Global Variables</h4>
        <div className="text-[11px] text-fg-tertiary mb-3">
          Global variables are available across all environments and collections.
        </div>
        <div className="border border-border-muted rounded-md overflow-hidden h-[200px]">
          <KeyValueEditor
            items={globalVars}
            onChange={handleGlobalVarsChange}
            placeholder={{ key: "Variable Name", value: "Value" }}
            showDescription={false}
          />
        </div>
      </div>
    </div>
  );
}

// Helper functions for global variables
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

function MockSection() {
  const [port, setPort] = useState("4010");

  return (
    <div className="mb-6">
      <SectionTitle>Mock Server</SectionTitle>
      <div className="flex flex-col gap-3">
        <Field label="Server Port" desc="Port for the mock HTTP server">
          <SettingsInput value={port} onChange={setPort} placeholder="4010" mono />
        </Field>
        <div className="text-fg-secondary text-[12px] font-sans">
          Configure mock routes in the Mock Server panel. Start/stop the server from the protocol tab.
        </div>
      </div>
    </div>
  );
}

function CookiesSection() {
  const cookies = useCookieStore((s) => s.cookies);
  const loadCookies = useCookieStore((s) => s.loadCookies);
  const removeCookie = useCookieStore((s) => s.removeCookie);
  const clearAllCookies = useCookieStore((s) => s.clearAllCookies);
  const [filterDomain, setFilterDomain] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    loadCookies();
  }, [loadCookies]);

  const handleFilter = () => {
    loadCookies(filterDomain || undefined);
  };

  const handleClear = async () => {
    if (!clearConfirm) { setClearConfirm(true); return; }
    await clearAllCookies();
    setClearConfirm(false);
  };

  const isExpired = (expires?: string) => {
    if (!expires) return false;
    return new Date(expires).getTime() < Date.now();
  };

  return (
    <div className="mb-6">
      <SectionTitle>Cookie Jar</SectionTitle>
      <div className="flex flex-col gap-3">
        <Field label="Filter by Domain" desc="Show cookies for a specific domain">
          <div className="flex items-center gap-1">
            <input
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              placeholder="example.com"
              className="w-[140px] h-8 px-[10px] bg-bg-input border border-border-muted rounded-md text-fg-primary outline-none focus:border-border-focus font-mono text-[12px] placeholder:text-fg-tertiary"
              onKeyDown={(e) => e.key === "Enter" && handleFilter()}
            />
            <button
              onClick={handleFilter}
              className="h-8 px-3 rounded-md bg-brand text-white text-[12px] font-semibold cursor-pointer hover:bg-brand-hover transition-colors"
            >
              Filter
            </button>
          </div>
        </Field>
        <div className="max-h-[240px] overflow-y-auto border border-border-muted rounded-md">
          {cookies.length === 0 ? (
            <div className="flex items-center justify-center h-[60px] text-fg-tertiary text-[12px]">
              No cookies found
            </div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-bg-elevated text-fg-tertiary">
                  <th className="text-left px-2 py-1 font-semibold">Domain</th>
                  <th className="text-left px-2 py-1 font-semibold">Name</th>
                  <th className="text-left px-2 py-1 font-semibold">Value</th>
                  <th className="text-left px-2 py-1 font-semibold">Path</th>
                  <th className="text-left px-2 py-1 font-semibold">Expires</th>
                  <th className="w-[30px]"></th>
                </tr>
              </thead>
              <tbody>
                {cookies.map((c: CookieEntry) => {
                  const expired = isExpired(c.expires);
                  return (
                    <tr key={c.id} className={`border-t border-border-muted ${expired ? "opacity-50 line-through" : ""}`}>
                      <td className="px-2 py-1 font-mono text-fg-primary truncate max-w-[80px]">{c.domain}</td>
                      <td className="px-2 py-1 font-mono text-fg-primary truncate max-w-[80px]">{c.name}</td>
                      <td className="px-2 py-1 font-mono text-fg-secondary truncate max-w-[100px]">{c.value}</td>
                      <td className="px-2 py-1 font-mono text-fg-tertiary">{c.path}</td>
                      <td className="px-2 py-1 font-mono text-fg-tertiary">{c.expires ? new Date(c.expires).toLocaleDateString() : "Session"}</td>
                      <td className="px-2 py-1">
                        <button
                          onClick={() => c.id != null && removeCookie(c.id)}
                          className="p-0.5 rounded hover:bg-bg-hover text-fg-tertiary hover:text-accent-danger cursor-pointer transition-colors"
                        >
                          <Trash2 size={10} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <Field label="Clear All Cookies" desc="Remove all stored cookies">
          <button
            onClick={handleClear}
            onBlur={() => setClearConfirm(false)}
            className={`h-8 px-4 rounded-md border font-sans text-[13px] font-medium cursor-pointer transition-all duration-[100ms] shrink-0 ${clearConfirm ? "bg-accent-danger text-white border-accent-danger" : "bg-transparent border-accent-danger/30 text-accent-danger hover:bg-accent-danger/12 hover:border-accent-danger"}`}
          >
            {clearConfirm ? "Confirm" : "Clear All"}
          </button>
        </Field>
      </div>
    </div>
  );
}