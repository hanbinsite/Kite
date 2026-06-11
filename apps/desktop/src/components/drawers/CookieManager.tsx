import { useState, useEffect, useCallback } from "react";
import { useCookieStore } from "../../stores/cookie-store";
import { useTranslation } from "react-i18next";
import type { CookieEntry } from "@api-client/core/cookie";
import { Trash2, Plus, Search, Cookie as CookieIcon, X } from "lucide-react";

const SAME_SITE_OPTIONS = ["Strict", "Lax", "None"];

function isExpired(expires?: string): boolean {
  if (!expires) return false;
  return new Date(expires).getTime() < Date.now();
}

function AddCookieForm({ onAdd, onCancel }: { onAdd: (c: Omit<CookieEntry, "id">) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [path, setPath] = useState("/");
  const [expires, setExpires] = useState("");
  const [secure, setSecure] = useState(false);
  const [httpOnly, setHttpOnly] = useState(false);
  const [sameSite, setSameSite] = useState("Lax");

  const handleSubmit = useCallback(() => {
    if (!domain.trim() || !name.trim()) return;
    onAdd({
      domain: domain.trim(),
      name: name.trim(),
      value,
      path: path || "/",
      expires: expires || undefined,
      secure,
      httpOnly,
      sameSite,
    });
  }, [domain, name, value, path, expires, secure, httpOnly, sameSite, onAdd]);

  return (
    <div className="flex flex-col gap-2 p-3 border border-border-muted rounded-md bg-bg-elevated">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[11px] font-semibold text-fg-primary">{t("cookies.addCookie")}</span>
        <button onClick={onCancel} className="p-1 rounded hover:bg-bg-hover text-fg-tertiary cursor-pointer">
          <X size={12} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder={t("cookies.domainPlaceholder")} className="h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none focus:border-border-focus font-mono placeholder:text-fg-tertiary" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("common.name")} className="h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none focus:border-border-focus font-mono placeholder:text-fg-tertiary" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={t("common.value")} className="h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none focus:border-border-focus font-mono placeholder:text-fg-tertiary" />
        <input value={path} onChange={(e) => setPath(e.target.value)} placeholder={t("common.path")} className="h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none focus:border-border-focus font-mono placeholder:text-fg-tertiary" />
        <input value={expires} onChange={(e) => setExpires(e.target.value)} placeholder={t("cookies.expiresPlaceholder")} className="h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none focus:border-border-focus font-mono placeholder:text-fg-tertiary" />
        <select value={sameSite} onChange={(e) => setSameSite(e.target.value)} className="h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none">
          {SAME_SITE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 font-sans text-[10px] text-fg-secondary cursor-pointer">
          <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} className="accent-brand" />
          Secure
        </label>
        <label className="flex items-center gap-1 font-sans text-[10px] text-fg-secondary cursor-pointer">
          <input type="checkbox" checked={httpOnly} onChange={(e) => setHttpOnly(e.target.checked)} className="accent-brand" />
          HttpOnly
        </label>
        <div className="flex-1" />
        <button
          onClick={handleSubmit}
          disabled={!domain.trim() || !name.trim()}
          className="h-[24px] px-3 rounded bg-brand text-white text-[10px] font-semibold cursor-pointer hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function CookieManager() {
  const { t } = useTranslation();
  const cookies = useCookieStore((s) => s.cookies);
  const loadCookies = useCookieStore((s) => s.loadCookies);
  const addCookie = useCookieStore((s) => s.addCookie);
  const removeCookie = useCookieStore((s) => s.removeCookie);
  const clearAllCookies = useCookieStore((s) => s.clearAllCookies);
  const [showAdd, setShowAdd] = useState(false);
  const [filterDomain, setFilterDomain] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    loadCookies();
  }, [loadCookies]);

  const handleFilter = useCallback(() => {
    loadCookies(filterDomain || undefined);
  }, [filterDomain, loadCookies]);

  const handleClear = useCallback(async () => {
    if (!clearConfirm) { setClearConfirm(true); return; }
    await clearAllCookies();
    setClearConfirm(false);
  }, [clearConfirm, clearAllCookies]);

  const handleAdd = useCallback(async (cookie: Omit<CookieEntry, "id">) => {
    await addCookie(cookie);
    setShowAdd(false);
  }, [addCookie]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 h-[44px] px-3 border-b border-border-muted shrink-0">
        <CookieIcon size={14} className="text-brand shrink-0" />
        <span className="font-sans text-[13px] font-semibold text-fg-primary">{t("cookies.cookieJar")}</span>
        <span className="font-sans text-[10px] text-fg-tertiary">({cookies.length})</span>
        <div className="flex-1" />
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 h-[24px] px-2 rounded bg-brand/10 text-brand text-[10px] font-semibold cursor-pointer hover:bg-brand/20 transition-colors"
        >
          <Plus size={10} />
          Add
        </button>
        <button
          onClick={handleClear}
          onBlur={() => setClearConfirm(false)}
          className={`h-[24px] px-2 rounded border text-[10px] font-semibold cursor-pointer transition-colors ${
            clearConfirm ? "bg-accent-danger text-white border-accent-danger" : "border-accent-danger/30 text-accent-danger hover:bg-accent-danger/12"
          }`}
        >
          {clearConfirm ? "Confirm" : "Clear All"}
        </button>
      </div>

      <div className="flex items-center gap-2 h-[32px] px-3 border-b border-border-muted shrink-0">
        <Search size={12} className="text-fg-tertiary shrink-0" />
        <input
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFilter()}
          placeholder="Filter by domain..."
          className="flex-1 h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary outline-none focus:border-border-focus font-mono placeholder:text-fg-tertiary"
        />
      </div>

      {showAdd && (
        <div className="px-3 pt-2 border-b border-border-muted shrink-0">
          <AddCookieForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {cookies.length === 0 ? (
          <div className="flex items-center justify-center h-full text-fg-tertiary text-[12px]">
            {t("cookies.noCookies")}
          </div>
        ) : (
          <div className="flex flex-col">
            {cookies.map((c) => {
              const expired = isExpired(c.expires);
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 px-3 py-1.5 border-b border-border-muted text-[11px] ${expired ? "opacity-40 line-through" : ""}`}
                >
                  <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand/10 text-brand shrink-0">
                    {c.domain}
                  </span>
                  <span className="font-mono text-fg-primary shrink-0 max-w-[100px] truncate">{c.name}</span>
                  <span className="font-mono text-fg-secondary flex-1 truncate">{c.value}</span>
                  <span className="font-mono text-fg-tertiary text-[10px] shrink-0">{c.path}</span>
                  {c.secure && <span className="font-sans text-[9px] text-accent-info shrink-0">Secure</span>}
                  {c.httpOnly && <span className="font-sans text-[9px] text-accent-warning shrink-0">HttpOnly</span>}
                  {expired && <span className="font-sans text-[9px] text-accent-danger shrink-0">Expired</span>}
                  <button
                    onClick={() => c.id != null && removeCookie(c.id)}
                    className="p-1 rounded hover:bg-bg-hover text-fg-tertiary hover:text-accent-danger cursor-pointer transition-colors shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
