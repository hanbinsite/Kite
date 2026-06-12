import { useTranslation } from "react-i18next";
import type { AuthConfig } from "@api-client/types";

interface AuthFormProps {
  authConfig: AuthConfig;
  onChange: (auth: AuthConfig) => void;
}

interface AuthType { id: string; labelKey: string; }

export const AUTH_TYPES: AuthType[] = [
  { id: "none", labelKey: "auth.noAuth" },
  { id: "apikey", labelKey: "auth.apikey" },
  { id: "bearer", labelKey: "auth.bearer" },
  { id: "basic", labelKey: "auth.basic" },
  { id: "jwt", labelKey: "auth.jwt" },
  { id: "oauth1", labelKey: "auth.oauth1" },
  { id: "oauth2", labelKey: "auth.oauth2" },
  { id: "awsv4", labelKey: "auth.awsv4" },
];

const DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  none: {},
  bearer: { token: "", prefix: "Bearer" },
  basic: { username: "", password: "" },
  apikey: { key: "", value: "", addTo: "header" },
  jwt: { token: "" },
  oauth1: { consumerKey: "", consumerSecret: "", token: "", tokenSecret: "", signatureMethod: "HMAC-SHA1" },
  oauth2: { accessToken: "", tokenType: "Bearer" },
  awsv4: { accessKeyId: "", secretAccessKey: "", service: "", region: "" },
};

function renderAuthFields(auth: AuthConfig, onChange: (auth: AuthConfig) => void, t: (key: string) => string) {
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
            onChange={(e) => onChange({ type: "bearer", config: { ...config, token: e.target.value } })}
            placeholder={t("auth.bearerTokenPlaceholder")}
            className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)] placeholder:text-fg-tertiary placeholder:font-sans"
          />
          <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.prefix")}</label>
          <input
            type="text"
            value={config.prefix ?? "Bearer"}
            onChange={(e) => onChange({ type: "bearer", config: { ...config, prefix: e.target.value } })}
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
              onChange={(e) => onChange({ type: "basic", config: { ...config, username: e.target.value } })}
              placeholder={t("auth.username")}
              className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans"
            />
          </div>
          <div className="auth-field flex flex-col gap-[6px]">
            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.password")}</label>
            <input
              type="password"
              value={config.password ?? ""}
              onChange={(e) => onChange({ type: "basic", config: { ...config, password: e.target.value } })}
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
              onChange={(e) => onChange({ type: "apikey", config: { ...config, key: e.target.value } })}
              placeholder={t("auth.keyPlaceholder")}
              className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans"
            />
          </div>
          <div className="auth-field flex flex-col gap-[6px]">
            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("common.value")}</label>
            <input
              type="password"
              value={config.value ?? ""}
              onChange={(e) => onChange({ type: "apikey", config: { ...config, value: e.target.value } })}
              placeholder={t("auth.apiKeyValuePlaceholder")}
              className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
            />
          </div>
          <div className="auth-field flex flex-col gap-[6px]">
            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.addTo")}</label>
            <select
              value={config.addTo ?? "header"}
              onChange={(e) => onChange({ type: "apikey", config: { ...config, addTo: e.target.value as "header" | "query" } })}
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
              onChange={(e) => onChange({ type: "oauth2", config: { ...config, accessToken: e.target.value } })}
              placeholder={t("auth.accessTokenPlaceholder")}
              className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
            />
          </div>
          <div className="auth-field flex flex-col gap-[6px]">
            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.tokenType")}</label>
            <input
              type="text"
              value={config.tokenType ?? "Bearer"}
              onChange={(e) => onChange({ type: "oauth2", config: { ...config, tokenType: e.target.value } })}
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
            onChange={(e) => onChange({ type: "jwt", config: { token: e.target.value } })}
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
              onChange={(e) => onChange({ type: "oauth1", config: { ...config, consumerKey: e.target.value } })}
              placeholder={t("auth.consumerKey")}
              className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)] placeholder:text-fg-tertiary placeholder:font-sans"
            />
          </div>
          <div className="auth-field flex flex-col gap-[6px]">
            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.consumerSecret")}</label>
            <input
              type="password"
              value={config.consumerSecret ?? ""}
              onChange={(e) => onChange({ type: "oauth1", config: { ...config, consumerSecret: e.target.value } })}
              placeholder={t("auth.consumerSecret")}
              className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
            />
          </div>
          <div className="auth-field flex flex-col gap-[6px]">
            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.token")}</label>
            <input
              type="text"
              value={config.token ?? ""}
              onChange={(e) => onChange({ type: "oauth1", config: { ...config, token: e.target.value } })}
              placeholder={t("auth.token")}
              className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans"
            />
          </div>
          <div className="auth-field flex flex-col gap-[6px]">
            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.tokenSecret")}</label>
            <input
              type="password"
              value={config.tokenSecret ?? ""}
              onChange={(e) => onChange({ type: "oauth1", config: { ...config, tokenSecret: e.target.value } })}
              placeholder={t("auth.tokenSecret")}
              className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
            />
          </div>
          <div className="auth-field flex flex-col gap-[6px]">
            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.signatureMethod")}</label>
            <select
              value={config.signatureMethod ?? "HMAC-SHA1"}
              onChange={(e) => onChange({ type: "oauth1", config: { ...config, signatureMethod: e.target.value } })}
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
              onChange={(e) => onChange({ type: "awsv4", config: { ...config, accessKeyId: e.target.value } })}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)] placeholder:text-fg-tertiary placeholder:font-sans"
            />
          </div>
          <div className="auth-field flex flex-col gap-[6px]">
            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.secretAccessKey")}</label>
            <input
              type="password"
              value={config.secretAccessKey ?? ""}
              onChange={(e) => onChange({ type: "awsv4", config: { ...config, secretAccessKey: e.target.value } })}
              placeholder={t("auth.secretAccessKeyPlaceholder")}
              className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
            />
          </div>
          <div className="auth-field flex flex-col gap-[6px]">
            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.sessionToken")}</label>
            <input
              type="password"
              value={config.sessionToken ?? ""}
              onChange={(e) => onChange({ type: "awsv4", config: { ...config, sessionToken: e.target.value } })}
              placeholder={t("auth.optionalPlaceholder")}
              className="auth-field-input password w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans pr-[36px]"
            />
          </div>
          <div className="auth-field flex flex-col gap-[6px]">
            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.service")}</label>
            <input
              type="text"
              value={config.service ?? ""}
              onChange={(e) => onChange({ type: "awsv4", config: { ...config, service: e.target.value } })}
              placeholder={t("auth.servicePlaceholder")}
              className="auth-field-input w-full h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-mono text-[12px] text-fg-primary outline-none focus:border-border-focus placeholder:text-fg-tertiary placeholder:font-sans"
            />
          </div>
          <div className="auth-field flex flex-col gap-[6px]">
            <label className="auth-field-label font-sans text-[11px] font-semibold text-fg-secondary">{t("auth.region")}</label>
            <input
              type="text"
              value={config.region ?? ""}
              onChange={(e) => onChange({ type: "awsv4", config: { ...config, region: e.target.value } })}
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
}

export function AuthForm({ authConfig, onChange }: AuthFormProps) {
  const { t } = useTranslation();

  return (
    <div className="auth-editor flex flex-col h-full p-4 gap-3">
      <select
        value={authConfig.type}
        onChange={(e) => {
          const type = e.target.value as AuthConfig["type"];
          onChange({ type, config: (DEFAULT_CONFIGS[type] ?? {}) as never } as AuthConfig);
        }}
        className="auth-type-select w-[220px] h-[32px] px-[10px] bg-bg-input border border-border-muted rounded-md font-sans text-[13px] text-fg-primary cursor-pointer outline-none focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-brand-muted)]"
      >
        {AUTH_TYPES.map((at) => (
          <option key={at.id} value={at.id}>{t(at.labelKey)}</option>
        ))}
      </select>
      {renderAuthFields(authConfig, onChange, t)}
    </div>
  );
}