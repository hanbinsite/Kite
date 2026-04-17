import { useState } from "react";

const TABS = ["Params", "Headers", "Body", "Auth", "Scripts", "Settings"];

interface KeyValueRow {
  key: string;
  value: string;
  enabled: boolean;
}

export function RequestPanel() {
  const [activeTab, setActiveTab] = useState("Params");
  const [rows, setRows] = useState<KeyValueRow[]>([{ key: "", value: "", enabled: true }]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-surface">
      <div className="h-9 flex items-center gap-4 px-4 border-b border-border-muted">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`h-9 px-3 text-sm font-medium transition-colors relative ${
              activeTab === tab ? "text-fg-primary" : "text-fg-secondary hover:text-fg-primary"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === "Params" && (
          <div className="space-y-1">
            <div className="grid grid-cols-[20px_1fr_1fr_28px] gap-2 px-3 py-2 text-xs font-medium text-fg-tertiary uppercase tracking-wider">
              <span></span>
              <span>Key</span>
              <span>Value</span>
              <span></span>
            </div>
            {rows.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-[20px_1fr_1fr_28px] gap-2 items-center px-3 py-1.5 rounded hover:bg-bg-hover ${
                  !row.enabled ? "opacity-50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => {
                    const newRows = [...rows];
                    newRows[i]!.enabled = e.target.checked;
                    setRows(newRows);
                  }}
                  className="w-4 h-4 rounded border-border-default bg-bg-input accent-brand"
                />
                <input
                  type="text"
                  value={row.key}
                  onChange={(e) => {
                    const newRows = [...rows];
                    newRows[i]!.key = e.target.value;
                    setRows(newRows);
                  }}
                  placeholder="Key"
                  className="h-7 px-2 bg-transparent border border-transparent rounded text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-border-focus"
                />
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => {
                    const newRows = [...rows];
                    newRows[i]!.value = e.target.value;
                    setRows(newRows);
                  }}
                  placeholder="Value"
                  className="h-7 px-2 bg-transparent border border-transparent rounded text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-border-focus"
                />
                <button
                  onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                  className="p-1 rounded hover:bg-bg-active text-fg-tertiary hover:text-fg-primary transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => setRows([...rows, { key: "", value: "", enabled: true }])}
              className="w-full py-2 text-sm text-fg-secondary hover:text-brand transition-colors"
            >
              + Add Row
            </button>
          </div>
        )}

        {activeTab === "Body" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {["none", "form-data", "urlencoded", "raw", "binary", "graphql"].map((mode) => (
                <button
                  key={mode}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    mode === "none"
                      ? "bg-bg-elevated text-fg-primary"
                      : "text-fg-secondary hover:text-fg-primary hover:bg-bg-hover"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Request body..."
              className="w-full h-64 p-3 bg-bg-input border border-border-default rounded-lg text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-border-focus font-mono resize-none"
            />
          </div>
        )}

        {activeTab !== "Params" && activeTab !== "Body" && (
          <div className="flex items-center justify-center h-full text-fg-tertiary text-sm">
            {activeTab} panel
          </div>
        )}
      </div>
    </div>
  );
}
