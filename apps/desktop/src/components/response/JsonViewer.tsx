// TODO: Implement virtualization for large JSON using @tanstack/react-virtual
const MAX_RENDER_DEPTH = 8;

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";

interface JsonNodeProps {
  keyName: string | null;
  value: unknown;
  depth: number;
  defaultCollapsed: number;
  path: string;
  onPathClick: (path: string) => void;
  searchTerm: string;
}

function JsonNode({ keyName, value, depth, defaultCollapsed, path, onPathClick, searchTerm }: JsonNodeProps) {
  const [collapsed, setCollapsed] = useState(depth >= Math.min(defaultCollapsed, MAX_RENDER_DEPTH));
  const isObject = value !== null && typeof value === "object";
  const isArray = Array.isArray(value);

  const lowerSearch = searchTerm.toLowerCase();
  const matchesSearch = searchTerm && (
    (keyName !== null && keyName.toLowerCase().includes(lowerSearch)) ||
    (!isObject && String(value).toLowerCase().includes(lowerSearch))
  );

    const toggle = useCallback(() => {
        setCollapsed((c) => !c);
    }, []);

    const handlePathClick = useCallback(() => {
        onPathClick(path);
    }, [path, onPathClick]);

  if (!isObject) {
    return (
      <div className={`json-line flex items-start font-mono text-[12px] leading-[18px] pl-[calc(var(--depth)*16px)] ${matchesSearch ? "bg-accent-warning/15" : ""}`} style={{ "--depth": depth } as React.CSSProperties}>
        {keyName !== null && (
          <>
            <span className="json-key text-method-get cursor-pointer hover:underline" onClick={handlePathClick}>&quot;{keyName}&quot;</span>
            <span className="text-fg-secondary">: </span>
          </>
        )}
        <JsonValue value={value} />
      </div>
    );
  }

    const entries = isArray ? value.map((v: unknown, i: number) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>);
    const bracketOpen = isArray ? "[" : "{";
    const bracketClose = isArray ? "]" : "}";
    const count = entries.length;

  if (collapsed) {
    return (
      <div className={`json-line flex items-start font-mono text-[12px] leading-[18px] pl-[calc(var(--depth)*16px)] ${matchesSearch ? "bg-accent-warning/15" : ""}`} style={{ "--depth": depth } as React.CSSProperties}>
        <button onClick={toggle} className="json-toggle w-[16px] h-[18px] flex items-center justify-center text-fg-tertiary hover:text-fg-secondary shrink-0 cursor-pointer">▶</button>
        {keyName !== null && (
          <>
            <span className="json-key text-method-get cursor-pointer hover:underline" onClick={handlePathClick}>&quot;{keyName}&quot;</span>
            <span className="text-fg-secondary">: </span>
          </>
        )}
        <span className="text-fg-tertiary">{bracketOpen}</span>
        <span className="text-fg-tertiary ml-1">{count} {isArray ? "items" : "keys"}</span>
        <span className="text-fg-tertiary ml-1">{bracketClose}</span>
      </div>
    );
  }

    return (
        <div>
            <div className="json-line flex items-start font-mono text-[12px] leading-[18px] pl-[calc(var(--depth)*16px)]" style={{ "--depth": depth } as React.CSSProperties}>
                <button onClick={toggle} className="json-toggle w-[16px] h-[18px] flex items-center justify-center text-fg-tertiary hover:text-fg-secondary shrink-0 cursor-pointer">▼</button>
                {keyName !== null && (
                    <>
                        <span className="json-key text-method-get cursor-pointer hover:underline" onClick={handlePathClick}>&quot;{keyName}&quot;</span>
                        <span className="text-fg-secondary">: </span>
                    </>
                )}
                <span className="text-fg-tertiary">{bracketOpen}</span>
            </div>
    {entries.map(([k, v]) => (
      <JsonNode
        key={k}
        keyName={isArray ? null : k}
        value={v}
        depth={depth + 1}
        defaultCollapsed={defaultCollapsed}
        path={`${path}${isArray ? `[${k}]` : `.${k}`}`}
        onPathClick={onPathClick}
        searchTerm={searchTerm}
      />
    ))}
            <div className="json-line font-mono text-[12px] leading-[18px] pl-[calc(var(--depth)*16px)]" style={{ "--depth": depth } as React.CSSProperties}>
                <span className="ml-[16px] text-fg-tertiary">{bracketClose}</span>
            </div>
        </div>
    );
}

function JsonValue({ value }: { value: unknown }) {
    if (value === null) return <span className="json-null text-accent-danger">null</span>;
    if (typeof value === "boolean") return <span className="json-boolean text-accent-info">{String(value)}</span>;
    if (typeof value === "number") return <span className="json-number text-method-post">{String(value)}</span>;
    if (typeof value === "string") return <span className="json-string text-accent-success">&quot;{value}&quot;</span>;
    return <span className="text-fg-secondary">{String(value)}</span>;
}

interface JsonViewerProps {
    data: string;
    defaultCollapsed?: number;
}

export function JsonViewer({ data, defaultCollapsed = 4 }: JsonViewerProps) {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState("");
    const [copied, setCopied] = useState(false);
    const [jsonPath, setJsonPath] = useState("");

    const parsed = useMemo(() => {
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }, [data]);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
    }, [parsed]);

    const handlePathClick = useCallback((path: string) => {
        setJsonPath(path);
    }, []);

    if (parsed === null) {
        return (
            <div className="p-3 font-mono text-[12px] text-fg-secondary whitespace-pre-wrap break-all">
                {data}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 h-[32px] px-3 border-b border-border-muted shrink-0">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t("response.searchJson")}
                    className="flex-1 h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus"
                />
                <input
                    type="text"
                    value={jsonPath}
                    onChange={(e) => setJsonPath(e.target.value)}
                    placeholder="$.path..."
                    className="w-[160px] h-[24px] px-2 bg-bg-input border border-border-muted rounded text-[11px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus font-mono"
                />
                <button
                    onClick={handleCopy}
                    className="h-[24px] px-2 text-[11px] font-medium text-fg-secondary hover:text-fg-primary bg-bg-hover rounded cursor-pointer transition-colors"
                >
                    {copied ? t("common.copied") : t("common.copy")}
                </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
      <JsonNode
        keyName={null}
        value={parsed}
        depth={0}
        defaultCollapsed={defaultCollapsed}
        path="$"
        onPathClick={handlePathClick}
        searchTerm={searchTerm}
      />
            </div>
        </div>
    );
}
