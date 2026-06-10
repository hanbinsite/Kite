import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCollectionStore } from "../../stores/collection-store";
import type { ScriptConfig, CollectionConfig, FolderConfig } from "@api-client/types";
import { findFolderConfig } from "./findFolderConfig";

interface ConfigScriptsTabProps {
  collectionId: string;
  folderId?: string;
  scripts?: ScriptConfig;
  isFolder: boolean;
}

const PRE_SNIPPETS = [
  { label: "Set variable", code: 'pm.variables.set("key", "value");' },
  { label: "Get variable", code: 'const val = pm.variables.get("key");' },
  { label: "Clear variable", code: 'pm.variables.unset("key");' },
  { label: "Log message", code: 'console.log("Pre-request executed");' },
  { label: "Set header", code: 'pm.request.headers.add({ key: "X-Custom", value: "value" });' },
];

const POST_SNIPPETS = [
  { label: "Status check", code: 'pm.test("Status is 200", () => {\n  pm.expect(pm.response.status).to.equal(200);\n});' },
  { label: "JSON body check", code: 'pm.test("Body has data", () => {\n  const json = JSON.parse(pm.response.body);\n  pm.expect(json.id).to.exist;\n});' },
  { label: "Response time", code: 'pm.test("Response time < 500ms", () => {\n  pm.expect(pm.response.time).to.be.below(500);\n});' },
  { label: "Save variable", code: 'const json = JSON.parse(pm.response.body);\npm.variables.set("token", json.token);' },
  { label: "Log response", code: 'console.log("Response:", pm.response.body);' },
];

export function ConfigScriptsTab({ collectionId, folderId, scripts, isFolder }: ConfigScriptsTabProps) {
  const { t } = useTranslation();
  const [activeScript, setActiveScript] = useState<"pre" | "post">("pre");
  const [preRequest, setPreRequest] = useState(scripts?.preRequest ?? "");
  const [postResponse, setPostResponse] = useState(scripts?.postResponse ?? "");
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

  const persist = (newScripts: ScriptConfig) => {
    const currentConfig = getCurrentConfig() ?? {};
    const updated = { ...currentConfig, scripts: newScripts };
    if (folderId) {
      updateFolderConfig(collectionId, folderId, updated as FolderConfig);
    } else {
      updateCollectionConfig(collectionId, updated as CollectionConfig);
    }
  };

  const handlePreChange = (value: string) => {
    setPreRequest(value);
    persist({ preRequest: value, postResponse });
  };

  const handlePostChange = (value: string) => {
    setPostResponse(value);
    persist({ preRequest, postResponse: value });
  };

  const snippets = activeScript === "pre" ? PRE_SNIPPETS : POST_SNIPPETS;
  const executionOrder = isFolder
    ? t("scripts.preExecutionOrderFolder")
    : t("scripts.preExecutionOrderCollection");

  return (
    <div className="max-w-[800px]">
      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={() => setActiveScript("pre")}
          className={`px-3 py-1.5 text-[12px] rounded transition-colors ${
            activeScript === "pre"
              ? "bg-brand text-white"
              : "bg-bg-elevated text-fg-secondary hover:text-fg-primary"
          }`}
        >
          {t("scripts.preRequest")}
        </button>
        <button
          onClick={() => setActiveScript("post")}
          className={`px-3 py-1.5 text-[12px] rounded transition-colors ${
            activeScript === "post"
              ? "bg-brand text-white"
              : "bg-bg-elevated text-fg-secondary hover:text-fg-primary"
          }`}
        >
          {t("scripts.postResponse")}
        </button>
      </div>

      <div className="mb-2 text-[11px] text-fg-secondary bg-bg-elevated rounded px-3 py-2">
        {activeScript === "pre"
          ? executionOrder
          : isFolder
            ? t("scripts.postExecutionOrderFolder")
            : t("scripts.postExecutionOrderCollection")}
      </div>

      <div className="flex gap-2 mb-2">
        {snippets.map((snippet) => (
          <button
            key={snippet.label}
            onClick={() => {
              if (activeScript === "pre") {
                handlePreChange(preRequest ? preRequest + "\n" + snippet.code : snippet.code);
              } else {
                handlePostChange(postResponse ? postResponse + "\n" + snippet.code : snippet.code);
              }
            }}
            className="text-[11px] px-2 py-1 rounded bg-bg-elevated text-fg-secondary hover:text-fg-primary transition-colors"
          >
            {snippet.label}
          </button>
        ))}
      </div>

      <textarea
        value={activeScript === "pre" ? preRequest : postResponse}
        onChange={(e) => {
          if (activeScript === "pre") {
            handlePreChange(e.target.value);
          } else {
            handlePostChange(e.target.value);
          }
        }}
        placeholder={activeScript === "pre" ? t("scripts.prePlaceholder") : t("scripts.postPlaceholder")}
        rows={16}
        className="w-full bg-bg-elevated text-fg-primary text-[13px] font-mono px-3 py-2 rounded border border-bg-elevated focus:border-brand focus:outline-none resize-y"
      />
    </div>
  );
}
