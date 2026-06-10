import { useState } from "react";
import { useCollectionStore } from "../../stores/collection-store";
import type { AuthConfig, CollectionConfig, FolderConfig } from "@api-client/types";
import { findFolderConfig } from "./findFolderConfig";

const AUTH_TYPES = [
  { value: "none", label: "No Auth" },
  { value: "inherit", label: "Inherit from parent" },
  { value: "bearer", label: "Bearer Token" },
  { value: "basic", label: "Basic Auth" },
  { value: "apikey", label: "API Key" },
  { value: "jwt", label: "JWT" },
  { value: "oauth1", label: "OAuth 1.0" },
  { value: "oauth2", label: "OAuth 2.0" },
  { value: "awsv4", label: "AWS v4" },
];

interface ConfigAuthTabProps {
  collectionId: string;
  folderId?: string;
  auth?: AuthConfig;
}

export function ConfigAuthTab({ collectionId, folderId, auth }: ConfigAuthTabProps) {
  const effectiveAuth = auth ?? { type: "none" as const, config: {} };
  const [authType, setAuthType] = useState<string>(effectiveAuth.type);
  const updateCollectionConfig = useCollectionStore((s) => s.updateCollectionConfig);
  const updateFolderConfig = useCollectionStore((s) => s.updateFolderConfig);
  const collections = useCollectionStore((s) => s.collections);

  const getCurrentConfig = (): CollectionConfig | FolderConfig | undefined => {
    const col = collections.find((c) => c.id === collectionId);
    if (!col) return undefined;
    if (folderId) {
      return findFolderConfig(col.items, folderId);
    }
    return col.config;
  };

  const persist = (newAuth: AuthConfig | undefined) => {
    const currentConfig = getCurrentConfig() ?? {};
    const updated = { ...currentConfig, auth: newAuth };
    if (folderId) {
      updateFolderConfig(collectionId, folderId, updated as FolderConfig);
    } else {
      updateCollectionConfig(collectionId, updated as CollectionConfig);
    }
  };

  const handleTypeChange = (newType: string) => {
    setAuthType(newType);
    if (newType === "inherit" || newType === "none") {
      persist(newType === "none" ? { type: "none", config: {} } : undefined);
      return;
    }
    persist({ type: newType as AuthConfig["type"], config: {} as never });
  };

  return (
    <div className="max-w-[500px]">
      <div className="mb-4">
        <label className="block text-[12px] text-fg-secondary mb-1">Authentication Type</label>
        <select
          value={authType}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        >
          {AUTH_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {folderId && authType === "inherit" && (
        <div className="bg-bg-elevated rounded p-3 text-[12px] text-fg-secondary">
          This folder will inherit authentication from its parent collection or folder.
        </div>
      )}

      {authType === "bearer" && <BearerFields auth={effectiveAuth} persist={persist} />}
      {authType === "basic" && <BasicFields auth={effectiveAuth} persist={persist} />}
      {authType === "apikey" && <ApiKeyFields auth={effectiveAuth} persist={persist} />}
      {authType === "jwt" && <JwtFields auth={effectiveAuth} persist={persist} />}
      {authType === "oauth2" && <OAuth2Fields auth={effectiveAuth} persist={persist} />}
      {authType === "awsv4" && <AwsV4Fields auth={effectiveAuth} persist={persist} />}

      {authType === "none" && (
        <div className="bg-bg-elevated rounded p-3 text-[12px] text-fg-secondary">
          No authentication will be used. Requests with &quot;Inherit from parent&quot; will skip this level.
        </div>
      )}
    </div>
  );
}

function BearerFields({ auth, persist }: { auth: AuthConfig; persist: (a: AuthConfig) => void }) {
  const config = auth.type === "bearer" ? auth.config : { token: "", prefix: "Bearer" };
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">Token</label>
        <input
          type="text"
          value={config.token ?? ""}
          onChange={(e) => persist({ type: "bearer", config: { ...config, token: e.target.value } })}
          placeholder="Enter token"
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">Prefix</label>
        <input
          type="text"
          value={config.prefix ?? "Bearer"}
          onChange={(e) => persist({ type: "bearer", config: { ...config, prefix: e.target.value } })}
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        />
      </div>
    </div>
  );
}

function BasicFields({ auth, persist }: { auth: AuthConfig; persist: (a: AuthConfig) => void }) {
  const config = auth.type === "basic" ? auth.config : { username: "", password: "" };
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">Username</label>
        <input
          type="text"
          value={config.username ?? ""}
          onChange={(e) => persist({ type: "basic", config: { ...config, username: e.target.value } })}
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">Password</label>
        <input
          type="password"
          value={config.password ?? ""}
          onChange={(e) => persist({ type: "basic", config: { ...config, password: e.target.value } })}
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        />
      </div>
    </div>
  );
}

function ApiKeyFields({ auth, persist }: { auth: AuthConfig; persist: (a: AuthConfig) => void }) {
  const config = auth.type === "apikey" ? auth.config : { key: "", value: "", addTo: "header" as const };
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">Key</label>
        <input
          type="text"
          value={config.key ?? ""}
          onChange={(e) => persist({ type: "apikey", config: { ...config, key: e.target.value } })}
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">Value</label>
        <input
          type="text"
          value={config.value ?? ""}
          onChange={(e) => persist({ type: "apikey", config: { ...config, value: e.target.value } })}
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">Add to</label>
        <select
          value={config.addTo ?? "header"}
          onChange={(e) => persist({ type: "apikey", config: { ...config, addTo: e.target.value as "header" | "query" } })}
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        >
          <option value="header">Header</option>
          <option value="query">Query</option>
        </select>
      </div>
    </div>
  );
}

function JwtFields({ auth, persist }: { auth: AuthConfig; persist: (a: AuthConfig) => void }) {
  const config = auth.type === "jwt" ? auth.config : { token: "" };
  return (
    <div>
      <label className="block text-[12px] text-fg-secondary mb-1">Token</label>
      <input
        type="text"
        value={config.token ?? ""}
        onChange={(e) => persist({ type: "jwt", config: { ...config, token: e.target.value } })}
        className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
      />
    </div>
  );
}

function OAuth2Fields({ auth, persist }: { auth: AuthConfig; persist: (a: AuthConfig) => void }) {
  const config = auth.type === "oauth2" ? auth.config : { accessToken: "" };
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">Access Token</label>
        <input
          type="text"
          value={config.accessToken ?? ""}
          onChange={(e) => persist({ type: "oauth2", config: { ...config, accessToken: e.target.value } })}
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">Token Type</label>
        <input
          type="text"
          value={config.tokenType ?? ""}
          onChange={(e) => persist({ type: "oauth2", config: { ...config, tokenType: e.target.value } })}
          placeholder="Bearer"
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        />
      </div>
    </div>
  );
}

function AwsV4Fields({ auth, persist }: { auth: AuthConfig; persist: (a: AuthConfig) => void }) {
  const config = auth.type === "awsv4" ? auth.config : { accessKeyId: "", secretAccessKey: "", service: "", region: "" };
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">Access Key ID</label>
        <input
          type="text"
          value={config.accessKeyId ?? ""}
          onChange={(e) => persist({ type: "awsv4", config: { ...config, accessKeyId: e.target.value } })}
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">Secret Access Key</label>
        <input
          type="password"
          value={config.secretAccessKey ?? ""}
          onChange={(e) => persist({ type: "awsv4", config: { ...config, secretAccessKey: e.target.value } })}
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">Service</label>
        <input
          type="text"
          value={config.service ?? ""}
          onChange={(e) => persist({ type: "awsv4", config: { ...config, service: e.target.value } })}
          placeholder="execute-api"
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[12px] text-fg-secondary mb-1">Region</label>
        <input
          type="text"
          value={config.region ?? ""}
          onChange={(e) => persist({ type: "awsv4", config: { ...config, region: e.target.value } })}
          placeholder="us-east-1"
          className="w-full bg-bg-elevated text-fg-primary text-[13px] px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none"
        />
      </div>
    </div>
  );
}
