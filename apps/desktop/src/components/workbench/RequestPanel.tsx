import { useState, useRef, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { KeyValueEditor, type KeyValue } from "../request/KeyValueEditor";
import { FormDataEditor } from "../request/FormDataEditor";
import { InlineEditor } from "../editor/InlineEditor";
import { ScriptEditor } from "../editor/ScriptEditor";
import { AUTH_TYPES } from "./AuthForm";
import { createAuthConfig } from "../../utils/auth";
import { useRequestStore } from "../../stores";
import type { BodyConfig, AuthConfig, BodyMode, RawLanguage, Header, QueryParam, FormDataParam } from "@api-client/types";

const REQUEST_TABS = [
    { id: "params", labelKey: "request.params" },
    { id: "headers", labelKey: "request.headers" },
    { id: "body", labelKey: "request.body" },
    { id: "auth", labelKey: "request.auth" },
    { id: "scripts", labelKey: "request.scripts" },
    { id: "settings", labelKey: "request.settings" },
] as const;

type RequestTabId = (typeof REQUEST_TABS)[number]["id"];

const BODY_TYPES: { id: BodyMode; labelKey: string }[] = [
    { id: "none", labelKey: "body.none" },
    { id: "formdata", labelKey: "body.formdata" },
    { id: "urlencoded", labelKey: "body.urlencoded" },
    { id: "raw", labelKey: "body.raw" },
    { id: "binary", labelKey: "body.binary" },
    { id: "graphql", labelKey: "body.graphql" },
];

const RAW_LANGUAGES: { id: RawLanguage; label: string }[] = [
    { id: "json", label: "JSON" },
    { id: "javascript", label: "JavaScript" },
    { id: "text", label: "Text" },
    { id: "html", label: "HTML" },
    { id: "xml", label: "XML" },
    { id: "yaml", label: "YAML" },
];

function kvToHeaders(kvs: KeyValue[]): Header[] {
    return kvs.map((kv) => ({
        key: kv.key,
        value: kv.value,
        disabled: !kv.enabled,
        description: kv.description,
    }));
}

function kvToParams(kvs: KeyValue[]): QueryParam[] {
    return kvs.map((kv) => ({
        key: kv.key,
        value: kv.value,
        disabled: !kv.enabled,
        description: kv.description,
    }));
}

function headersToKv(headers: Header[]): KeyValue[] {
    return headers.map((h, i) => ({
        id: `hdr-${i}`,
        key: h.key,
        value: h.value,
        enabled: !h.disabled,
        description: h.description ?? "",
    }));
}

function paramsToKv(params: QueryParam[]): KeyValue[] {
    return params.map((p, i) => ({
        id: `prm-${i}`,
        key: p.key,
        value: p.value,
        enabled: !p.disabled,
        description: p.description ?? "",
    }));
}

function formdataToKv(items: FormDataParam[]): KeyValue[] {
    return items.map((item, i) => ({
        id: `fd-${i}`,
        key: item.key,
        value: item.value,
        enabled: !item.disabled,
        description: item.type === "file" ? "[file]" : "",
    }));
}

function kvToFormdata(kvs: KeyValue[]): FormDataParam[] {
    return kvs
        .filter((kv) => kv.key)
        .map((kv) => ({
            key: kv.key,
            value: kv.value,
            type: (kv.description === "[file]" ? "file" : "text") as "text" | "file",
            disabled: !kv.enabled,
        }));
}

function kvToUrlencoded(kvs: KeyValue[]): QueryParam[] {
    return kvs
        .filter((kv) => kv.key)
        .map((kv) => ({
            key: kv.key,
            value: kv.value,
            disabled: !kv.enabled,
        }));
}

function ensureEmptyRow(items: KeyValue[]): KeyValue[] {
    const last = items[items.length - 1];
    if (!last || last.key || last.value) {
        return [...items, { id: crypto.randomUUID(), key: "", value: "", enabled: true, description: "" }];
    }
    if (items.length === 0) {
        return [{ id: crypto.randomUUID(), key: "", value: "", enabled: true, description: "" }];
    }
    return items;
}

export function RequestPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<RequestTabId>("params");
  const [scriptTab, setScriptTab] = useState<"pre" | "post">("pre");

  const currentTabId = useRequestStore((s) => s.currentTabId);
  const requestData = useRequestStore((s) => currentTabId ? s.requestDataMap[currentTabId] : undefined);
  const storeHeaders = requestData?.headers ?? [];
  const storeParams = requestData?.params ?? [];
  const storeBody = requestData?.body ?? null;
  const storeAuth = requestData?.auth ?? { type: "none", config: {} };
  const storeSettings = requestData?.settings ?? { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, verifySsl: true };
  const setRequestHeaders = useRequestStore((s) => s.setRequestHeaders);
  const setRequestParams = useRequestStore((s) => s.setRequestParams);
  const setRequestBody = useRequestStore((s) => s.setRequestBody);
  const setRequestAuth = useRequestStore((s) => s.setRequestAuth);
  const setRequestSettings = useRequestStore((s) => s.setRequestSettings);
  const setRequestScripts = useRequestStore((s) => s.setRequestScripts);

  const storeScripts = requestData?.scripts ?? { preRequest: undefined, postResponse: undefined };

  const [params, setParams] = useState<KeyValue[]>(() => ensureEmptyRow(paramsToKv(storeParams)));
  const [headers, setHeaders] = useState<KeyValue[]>(() => ensureEmptyRow(headersToKv(storeHeaders)));
  const [bodyConfig, setBodyConfig] = useState<BodyConfig>(() => storeBody ?? { mode: "none" });
  const [rawLanguage, setRawLanguage] = useState<RawLanguage>(() => storeBody?.raw?.language ?? "json");
  const [rawContent, setRawContent] = useState(() => storeBody?.raw?.content ?? "");
  const [formdataKvs, setFormdataKvs] = useState<KeyValue[]>(() => ensureEmptyRow(formdataToKv(storeBody?.formdata ?? [])));
  const [urlencodedKvs, setUrlencodedKvs] = useState<KeyValue[]>(() => ensureEmptyRow(paramsToKv(storeBody?.urlencoded ?? [])));
  const [graphqlQuery, setGraphqlQuery] = useState(() => storeBody?.graphql?.query ?? "");
  const [graphqlVariables, setGraphqlVariables] = useState(() => storeBody?.graphql?.variables ?? "");
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  useEffect(() => {
    const tabId = useRequestStore.getState().currentTabId;
    if (tabId) {
      const data = useRequestStore.getState().requestDataMap[tabId];
      const storeHeaders = data?.headers ?? [];
      const storeParams = data?.params ?? [];
      const storeBody = data?.body ?? null;
      setParams(ensureEmptyRow(paramsToKv(storeParams)));
      setHeaders(ensureEmptyRow(headersToKv(storeHeaders)));
      setBodyConfig(storeBody ?? { mode: "none" });
      setRawLanguage(storeBody?.raw?.language ?? "json");
      setRawContent(storeBody?.raw?.content ?? "");
      setFormdataKvs(ensureEmptyRow(formdataToKv(storeBody?.formdata ?? [])));
      setUrlencodedKvs(ensureEmptyRow(paramsToKv(storeBody?.urlencoded ?? [])));
      setGraphqlQuery(storeBody?.graphql?.query ?? "");
      setGraphqlVariables(storeBody?.graphql?.variables ?? "");
    }
  }, [currentTabId]);

    const handleParamsChange = (newItems: KeyValue[]) => {
        setParams(newItems);
        setRequestParams(kvToParams(newItems));
    };

    const handleHeadersChange = (newItems: KeyValue[]) => {
        setHeaders(newItems);
        setRequestHeaders(kvToHeaders(newItems));
    };

    const handleBodyConfigChange = (newConfig: BodyConfig) => {
        setBodyConfig(newConfig);
        setRequestBody(newConfig.mode === "none" ? null : newConfig);
    };

    const handleRawContentChange = (content: string) => {
        setRawContent(content);
        const updated: BodyConfig = {
            mode: "raw",
            raw: { language: rawLanguage, content },
        };
        setRequestBody(updated);
    };

    const handleRawLanguageChange = (lang: RawLanguage) => {
        setRawLanguage(lang);
        setLangDropdownOpen(false);
        const updated: BodyConfig = {
            mode: "raw",
            raw: { language: lang, content: rawContent },
        };
        setRequestBody(updated);
    };

    const handleUrlencodedChange = (newItems: KeyValue[]) => {
        setUrlencodedKvs(newItems);
        const urlencoded = kvToUrlencoded(newItems);
        handleBodyConfigChange({ mode: "urlencoded", urlencoded });
    };

    const handleGraphqlQueryChange = (query: string) => {
        setGraphqlQuery(query);
        handleBodyConfigChange({
            mode: "graphql",
            graphql: { query, variables: graphqlVariables },
        });
    };

    const handleGraphqlVariablesChange = (variables: string) => {
        setGraphqlVariables(variables);
        handleBodyConfigChange({
            mode: "graphql",
            graphql: { query: graphqlQuery, variables },
        });
    };

    const handleAuthChange = (auth: AuthConfig) => {
        setRequestAuth(auth);
    };

    const tabRefs = useRef<Partial<Record<RequestTabId, HTMLButtonElement | null>>>({});
    const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const updateIndicator = () => {
      const el = tabRefs.current[activeTab];
      if (el) {
        const parent = el.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          setIndicatorStyle({
            left: elRect.left - parentRect.left,
            width: elRect.width,
          });
        }
      }
    };

    updateIndicator();

    const observer = new ResizeObserver(updateIndicator);
    const parent = tabRefs.current[activeTab]?.parentElement;
    if (parent) observer.observe(parent);
    return () => observer.disconnect();
  }, [activeTab]);

    const enabledParamsCount = params.filter((p) => p.enabled && p.key).length;
    const enabledHeadersCount = headers.filter((h) => h.enabled && h.key).length;
    const authBadge = storeAuth.type !== "none" ? "1" : null;

    const getBadge = (tabId: RequestTabId) => {
        if (tabId === "params" && enabledParamsCount > 0) return enabledParamsCount;
        if (tabId === "headers" && enabledHeadersCount > 0) return enabledHeadersCount;
        if (tabId === "auth" && authBadge) return authBadge;
        return null;
    };

    const renderAuthFields = () => {
        const auth = storeAuth;
        switch (auth.type) {
            case "none":
                return (
                    <div className="auth-hint font-sans text-[11px] text-fg-tertiary leading-[16px] p-2 bg-bg-elevated rounded-md border-l-[2px] border-accent-info">
                        {t("auth.noAuthHint")}
                    </div>
                );
            case "bearer": {
                const config = auth.config as { token: string; prefix: string };
                return (
                    <div className="auth-field flex flex-col gap-[6px]">
                        <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.token")}</label>
                        <input
                            type="text"
                            value={config.token ?? ""}
                            onChange={(e) => handleAuthChange({ type: "bearer", config: { ...config, token: e.target.value } })}
                            placeholder={t("auth.bearerTokenPlaceholder")}
                            className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)] placeholder:text-fg-tertiary placeholder:font-sans"
                        />
                        <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.prefix")}</label>
                        <input
                            type="text"
                            value={config.prefix ?? "Bearer"}
                            onChange={(e) => handleAuthChange({ type: "bearer", config: { ...config, prefix: e.target.value } })}
                            placeholder={t("auth.prefixPlaceholder")}
                            className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans"
                        />
                    </div>
                );
            }
            case "basic": {
                const config = auth.config as { username: string; password: string };
                return (
                    <>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.username")}</label>
                            <input
                                type="text"
                                value={config.username ?? ""}
                                onChange={(e) => handleAuthChange({ type: "basic", config: { ...config, username: e.target.value } })}
                                placeholder={t("auth.username")}
                                className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans"
                            />
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.password")}</label>
                            <input
                                type="password"
                                value={config.password ?? ""}
                                onChange={(e) => handleAuthChange({ type: "basic", config: { ...config, password: e.target.value } })}
                                placeholder={t("auth.passwordPlaceholder")}
                                className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
                            />
                        </div>
                    </>
                );
            }
            case "apikey": {
                const config = auth.config as { key: string; value: string; addTo: "header" | "query" };
                return (
                    <>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.keyLabel")}</label>
                            <input
                                type="text"
                                value={config.key ?? ""}
                                onChange={(e) => handleAuthChange({ type: "apikey", config: { ...config, key: e.target.value } })}
                                placeholder={t("auth.keyPlaceholder")}
                                className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans"
                            />
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("common.value")}</label>
                            <input
                                type="password"
                                value={config.value ?? ""}
                                onChange={(e) => handleAuthChange({ type: "apikey", config: { ...config, value: e.target.value } })}
                                placeholder={t("auth.apiKeyValuePlaceholder")}
                                className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
                            />
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.addTo")}</label>
                            <select
                                value={config.addTo ?? "header"}
                                onChange={(e) => handleAuthChange({ type: "apikey", config: { ...config, addTo: e.target.value as "header" | "query" } })}
                                className="auth-type-select w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-sans text-[13px] text-fg-primary cursor-pointer outline-none focus:border-border-focus"
                            >
                                <option value="header">{t("auth.headerOption")}</option>
                                <option value="query">{t("auth.queryOption")}</option>
                            </select>
                        </div>
                    </>
                );
            }
            case "oauth2": {
                const config = auth.config as { accessToken: string; tokenType: string };
                return (
                    <>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.accessToken")}</label>
                            <input
                                type="password"
                                value={config.accessToken ?? ""}
                                onChange={(e) => handleAuthChange({ type: "oauth2", config: { ...config, accessToken: e.target.value } })}
                                placeholder={t("auth.accessTokenPlaceholder")}
                                className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
                            />
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.tokenType")}</label>
                            <input
                                type="text"
                                value={config.tokenType ?? "Bearer"}
                                onChange={(e) => handleAuthChange({ type: "oauth2", config: { ...config, tokenType: e.target.value } })}
placeholder={t("auth.tokenTypePlaceholder")}
                                className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans"
                            />
                        </div>
                    </>
                );
            }
            case "jwt": {
                const config = auth.config as { token: string };
                return (
                    <div className="auth-field flex flex-col gap-[6px]">
                        <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.token")}</label>
                        <input
                            type="password"
                            value={config.token ?? ""}
                            onChange={(e) => handleAuthChange({ type: "jwt", config: { token: e.target.value } })}
                            placeholder={t("auth.jwtTokenPlaceholder")}
                            className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
                        />
                    </div>
                );
            }
            case "oauth1": {
                const config = auth.config as { consumerKey: string; consumerSecret: string; token: string; tokenSecret: string; signatureMethod: string };
                return (
                    <>
                        <div className="auth-hint font-sans text-[11px] text-accent-warning leading-[16px] p-2 bg-accent-warning/8 rounded-md border-l-[2px] border-accent-warning">
                            {t("auth.notImplementedOauth1")}
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.consumerKey")}</label>
                            <input
                                type="text"
                                value={config.consumerKey ?? ""}
                                onChange={(e) => handleAuthChange({ type: "oauth1", config: { ...config, consumerKey: e.target.value } })}
                                placeholder={t("auth.consumerKey")}
                                className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)] placeholder:text-fg-tertiary placeholder:font-sans"
                            />
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.consumerSecret")}</label>
                            <input
                                type="password"
                                value={config.consumerSecret ?? ""}
                                onChange={(e) => handleAuthChange({ type: "oauth1", config: { ...config, consumerSecret: e.target.value } })}
                                placeholder={t("auth.consumerSecret")}
                                className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
                            />
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
<label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.token")}</label>
                            <input
                                type="text"
                                value={config.token ?? ""}
                                onChange={(e) => handleAuthChange({ type: "oauth1", config: { ...config, token: e.target.value } })}
                                placeholder={t("auth.token")}
                                className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans"
                            />
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.tokenSecret")}</label>
                            <input
                                type="password"
                                value={config.tokenSecret ?? ""}
                                onChange={(e) => handleAuthChange({ type: "oauth1", config: { ...config, tokenSecret: e.target.value } })}
                                placeholder={t("auth.tokenSecret")}
                                className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
                            />
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.signatureMethod")}</label>
                            <select
                                value={config.signatureMethod ?? "HMAC-SHA1"}
                                onChange={(e) => handleAuthChange({ type: "oauth1", config: { ...config, signatureMethod: e.target.value } })}
                                className="auth-type-select w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-sans text-[13px] text-fg-primary cursor-pointer outline-none focus:border-border-focus"
                            >
                                <option value="HMAC-SHA1">HMAC-SHA1</option>
                                <option value="HMAC-SHA256">HMAC-SHA256</option>
                                <option value="RSA-SHA1">RSA-SHA1</option>
                                <option value="RSA-SHA256">RSA-SHA256</option>
                            </select>
                        </div>
                    </>
                );
            }
            case "awsv4": {
                const config = auth.config as { accessKeyId: string; secretAccessKey: string; sessionToken: string; service: string; region: string };
                return (
                    <>
                        <div className="auth-hint font-sans text-[11px] text-accent-warning leading-[16px] p-2 bg-accent-warning/8 rounded-md border-l-[2px] border-accent-warning">
                            {t("auth.notImplementedAwsV4")}
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.accessKeyId")}</label>
                            <input
                                type="text"
                                value={config.accessKeyId ?? ""}
                                onChange={(e) => handleAuthChange({ type: "awsv4", config: { ...config, accessKeyId: e.target.value } })}
                                placeholder="AKIAIOSFODNN7EXAMPLE"
                                className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)] placeholder:text-fg-tertiary placeholder:font-sans"
                            />
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.secretAccessKey")}</label>
                            <input
                                type="password"
                                value={config.secretAccessKey ?? ""}
                                onChange={(e) => handleAuthChange({ type: "awsv4", config: { ...config, secretAccessKey: e.target.value } })}
                                placeholder={t("auth.secretAccessKeyPlaceholder")}
                                className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
                            />
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.sessionToken")}</label>
                            <input
                                type="password"
                                value={config.sessionToken ?? ""}
                                onChange={(e) => handleAuthChange({ type: "awsv4", config: { ...config, sessionToken: e.target.value } })}
                                placeholder={t("auth.optionalPlaceholder")}
                                className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
                            />
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.service")}</label>
                            <input
                                type="text"
                                value={config.service ?? ""}
                                onChange={(e) => handleAuthChange({ type: "awsv4", config: { ...config, service: e.target.value } })}
                                placeholder={t("auth.servicePlaceholder")}
                                className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans"
                            />
                        </div>
                        <div className="auth-field flex flex-col gap-[6px]">
                            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.region")}</label>
                            <input
                                type="text"
                                value={config.region ?? ""}
                                onChange={(e) => handleAuthChange({ type: "awsv4", config: { ...config, region: e.target.value } })}
                                placeholder={t("auth.regionPlaceholder")}
                                className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans"
                            />
                        </div>
                    </>
                );
            }
            default:
                return (
                    <div className="auth-hint font-sans text-[11px] text-fg-tertiary leading-[16px] p-2 bg-bg-elevated rounded-md border-l-[2px] border-accent-info">
                        {t("auth.noAuthHint")}
                    </div>
                );
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-bg-surface">
            <div className="request-tabs flex items-center h-tab-bar bg-bg-surface border-b border-border-muted px-3 gap-0 relative shrink-0">
                {REQUEST_TABS.map((tab) => {
                    const badge = getBadge(tab.id);
                    return (
                        <button
                            key={tab.id}
                            ref={(el) => { tabRefs.current[tab.id] = el; }}
                            onClick={() => setActiveTab(tab.id)}
                            className={`request-tab h-tab-bar px-[14px] flex items-center gap-[6px] font-sans text-sm font-medium cursor-pointer whitespace-nowrap relative transition-colors duration-50 ${
                                activeTab === tab.id ? "active text-fg-primary" : "text-fg-secondary hover:text-fg-primary"
                            }`}
                        >
                            {t(tab.labelKey)}
                            {badge !== null && (
                                <span
                                    className={`request-tab-badge font-sans text-2xs font-semibold min-w-[16px] h-[16px] px-[4px] flex items-center justify-center rounded-full ${
                                        activeTab === tab.id
                                            ? "text-brand bg-brand-muted"
                                            : "text-fg-tertiary bg-bg-active"
                                    }`}
                                >
                                    {badge}
                                </span>
                            )}
                        </button>
                    );
                })}
                <div
                    className="request-tab-indicator absolute bottom-0 h-[2px] bg-brand rounded-[1px] transition-left duration-[180ms] transition-width duration-[180ms]"
                    style={{
                        left: `${indicatorStyle.left}px`,
                        width: `${indicatorStyle.width}px`,
                        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                />
            </div>

            <div className="h-0 flex-1 overflow-hidden">
                {activeTab === "params" && (
                    <KeyValueEditor
                        items={params}
                        onChange={handleParamsChange}
                        placeholder={{ key: t("request.parameter"), value: t("common.value") }}
                    />
                )}

                {activeTab === "headers" && (
                    <KeyValueEditor
                        items={headers}
                        onChange={handleHeadersChange}
                        placeholder={{ key: t("request.header"), value: t("common.value") }}
                    />
                )}

                {activeTab === "body" && (
                    <div className="body-editor flex flex-col h-full">
                        <div className="body-type-row flex items-center gap-[8px] h-[36px] px-3 border-b border-border-muted">
                            {BODY_TYPES.map((bt) => (
                                <div
                                    key={bt.id}
                                    onClick={() => {
                                        const newConfig: BodyConfig = { mode: bt.id };
                                        if (bt.id === "raw") {
                                            newConfig.raw = { language: rawLanguage, content: rawContent };
                                        } else if (bt.id === "formdata") {
                                            newConfig.formdata = kvToFormdata(formdataKvs);
                                        } else if (bt.id === "urlencoded") {
                                            newConfig.urlencoded = kvToUrlencoded(urlencodedKvs);
                                        } else if (bt.id === "graphql") {
                                            newConfig.graphql = { query: graphqlQuery, variables: graphqlVariables };
                                        }
                                        handleBodyConfigChange(newConfig);
                                    }}
                                    className={`body-type-radio flex items-center gap-[6px] h-[24px] px-[10px] rounded-[4px] font-sans text-[12px] font-medium cursor-pointer transition-all duration-50 ${
                                        bodyConfig.mode === bt.id
                                            ? "active text-brand bg-brand-muted"
                                            : "text-fg-secondary hover:bg-bg-hover hover:text-fg-primary"
                                    }`}
                                >
                                    <div
                                        className={`body-type-dot w-[10px] h-[10px] rounded-full border-[1.5px] transition-all duration-100 ${
                                            bodyConfig.mode === bt.id
                                                ? "border-brand bg-brand shadow-[inset_0_0_0_2px_var(--color-bg-surface)]"
                                                : "border-border-default"
                                        }`}
                                    />
                                    {t(bt.labelKey)}
                                </div>
                            ))}
                            {bodyConfig.mode === "raw" && (
                                <>
                                    <div className="body-type-separator w-[1px] h-[16px] bg-border-muted" />
                                    <div className="relative">
                                        <div
                                            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                                            className="raw-type-selector flex items-center h-[24px] px-2 rounded-[4px] font-sans text-[11px] font-medium text-fg-secondary cursor-pointer gap-[4px] hover:bg-bg-hover"
                                        >
                                            {RAW_LANGUAGES.find((l) => l.id === rawLanguage)?.label ?? "JSON"}
                                            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </div>
                                        {langDropdownOpen && (
                                            <div className="absolute top-full left-0 mt-1 bg-bg-elevated border border-border-muted rounded-md shadow-lg z-50 py-1 min-w-[120px]">
                                                {RAW_LANGUAGES.map((lang) => (
                                                    <div
                                                        key={lang.id}
                                                        onClick={() => handleRawLanguageChange(lang.id)}
                                                        className={`px-3 py-1.5 font-sans text-[12px] cursor-pointer hover:bg-bg-hover ${
                                                            rawLanguage === lang.id ? "text-brand font-medium" : "text-fg-secondary"
                                                        }`}
                                                    >
                                                        {lang.label}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex-1 overflow-hidden">
                            {bodyConfig.mode === "none" && (
                                <div className="flex items-center justify-center h-full text-fg-tertiary text-[12px]">
                                    {t("body.noBody")}
                                </div>
                            )}

                            {bodyConfig.mode === "raw" && (
                                <div className="flex-1 overflow-hidden">
                                    <InlineEditor
                                        value={rawContent}
                                        language={rawLanguage}
                                        onChange={handleRawContentChange}
                                        placeholder={t("body.requestBody")}
                                    />
                                </div>
                            )}

                            {bodyConfig.mode === "formdata" && (
                                <FormDataEditor
                                    items={storeBody?.formdata ?? []}
                                    onChange={(formdata) => {
                                        setFormdataKvs(formdataToKv(formdata));
                                        handleBodyConfigChange({ mode: "formdata", formdata });
                                    }}
                                />
                            )}

                            {bodyConfig.mode === "urlencoded" && (
                                <KeyValueEditor
                                    items={urlencodedKvs}
                                    onChange={handleUrlencodedChange}
                                    placeholder={{ key: t("request.key"), value: t("common.value") }}
                                />
                            )}

        {bodyConfig.mode === "binary" && (
          <div className="flex items-center justify-center h-full">
            <div
              className="binary-upload-zone w-[280px] h-[160px] border-[1.5px] border-dashed border-border-default rounded-lg flex flex-col items-center justify-center gap-[8px] cursor-pointer transition-all duration-[180ms] hover:border-brand hover:bg-brand-muted"
              onClick={async () => {
                try {
                  const selected = await open({ multiple: false, directory: false });
                  if (selected) {
                    handleBodyConfigChange({ mode: "binary", binary: selected });
                  }
                } catch {}
              }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file) {
                  handleBodyConfigChange({ mode: "binary", binary: file.name });
                }
              }}
            >
              {bodyConfig.binary ? (
                <>
                  <span className="font-mono text-[12px] text-fg-primary truncate max-w-[200px]">{bodyConfig.binary.split(/[\\/]/).pop()}</span>
                  <span className="text-fg-tertiary text-[11px]">{t("body.clickToChangeFile")}</span>
                </>
              ) : (
                <span className="text-fg-tertiary text-[12px]">{t("body.clickOrDrop")}</span>
              )}
            </div>
          </div>
        )}

                            {bodyConfig.mode === "graphql" && (
                                <div className="graphql-editor grid grid-cols-2 h-full">
                                    <div className="graphql-editor-query border-r border-border-muted overflow-hidden">
                                        <InlineEditor
                                            value={graphqlQuery}
                                            language="javascript"
                                            onChange={handleGraphqlQueryChange}
                                            placeholder={t("body.graphqlQuery")}
                                        />
                                    </div>
                                    <div className="overflow-hidden">
                                        <InlineEditor
                                            value={graphqlVariables}
                                            language="json"
                                            onChange={handleGraphqlVariablesChange}
                                            placeholder={t("body.graphqlVariables")}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "auth" && (
                    <div className="auth-editor flex flex-col h-full p-4 gap-3">
                        <select
                            value={storeAuth.type}
                            onChange={(e) => {
                                const type = e.target.value as AuthConfig["type"];
                                handleAuthChange(createAuthConfig(type));
                            }}
                            className="auth-type-select w-[220px] h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-sans text-[13px] text-fg-primary cursor-pointer outline-none focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)]"
                        >
                            {AUTH_TYPES.map((at) => (
                                <option key={at.id} value={at.id}>{t(at.labelKey)}</option>
                            ))}
                        </select>
                        {renderAuthFields()}
                    </div>
                )}

  {activeTab === "scripts" && (
  <div className="scripts-editor flex flex-col h-full">
    <div className="scripts-tabs flex h-[36px] border-b border-border-muted px-3 gap-0 relative">
      <button
        onClick={() => setScriptTab("pre")}
        className={`scripts-tab h-[36px] px-[14px] flex items-center font-sans text-[12px] font-medium cursor-pointer ${scriptTab === "pre" ? "text-fg-primary active" : "text-fg-secondary hover:text-fg-primary"}`}
      >
        {t("scripts.preRequest")}
      </button>
      <button
        onClick={() => setScriptTab("post")}
        className={`scripts-tab h-[36px] px-[14px] flex items-center font-sans text-[12px] font-medium cursor-pointer ${scriptTab === "post" ? "text-fg-primary active" : "text-fg-secondary hover:text-fg-primary"}`}
      >
        {t("scripts.postResponse")}
      </button>
    </div>
    <div className="flex-1 overflow-hidden">
      <ScriptEditor
        value={scriptTab === "pre" ? (storeScripts.preRequest ?? "") : (storeScripts.postResponse ?? "")}
        onChange={(v) => {
          if (scriptTab === "pre") { setRequestScripts({ ...storeScripts, preRequest: v || undefined }); }
          else { setRequestScripts({ ...storeScripts, postResponse: v || undefined }); }
        }}
        placeholder={scriptTab === "pre" ? t("scripts.prePlaceholder") : t("scripts.postPlaceholder")}
      />
    </div>
  </div>
)}

                {activeTab === "settings" && (
                    <div className="flex flex-col h-full p-4 gap-3">
                        <div className="flex items-center gap-3">
                            <label className="font-sans text-[11px] font-semibold text-fg-secondary w-[120px]">{t("request.timeoutLabel")}</label>
                            <input
                                type="number"
                                value={storeSettings.timeoutMs}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (val > 0) {
                                        setRequestSettings({ ...storeSettings, timeoutMs: val });
                                    }
                                }}
                                className="auth-field-input w-[120px] h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="font-sans text-[11px] font-semibold text-fg-secondary w-[120px]">{t("request.followRedirects")}</label>
                            <input
                                type="checkbox"
                                checked={storeSettings.followRedirects}
                                onChange={(e) => setRequestSettings({ ...storeSettings, followRedirects: e.target.checked })}
                                className="w-4 h-4 accent-brand cursor-pointer rounded"
                            />
                        </div>
                        {storeSettings.followRedirects && (
                            <div className="flex items-center gap-3">
                                <label className="font-sans text-[11px] font-semibold text-fg-secondary w-[120px]">{t("request.maxRedirects")}</label>
                                <input
                                    type="number"
                                    value={storeSettings.maxRedirects}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (val > 0) {
                                            setRequestSettings({ ...storeSettings, maxRedirects: val });
                                        }
                                    }}
                                    className="auth-field-input w-[120px] h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus"
                                />
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <label className="font-sans text-[11px] font-semibold text-fg-secondary w-[120px]">{t("request.verifySsl")}</label>
                            <input
                                type="checkbox"
                                checked={storeSettings.verifySsl}
                                onChange={(e) => setRequestSettings({ ...storeSettings, verifySsl: e.target.checked })}
                                className="w-4 h-4 accent-brand cursor-pointer rounded"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
