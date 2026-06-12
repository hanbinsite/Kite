import { useState } from "react";
import { CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TestResult } from "@api-client/core/script";

interface TestsTabProps {
  results: TestResult[];
}

export function TestsTab({ results }: TestsTabProps) {
  const { t } = useTranslation();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-fg-tertiary">
        <span className="font-sans text-[12px]">{t("response.noTestsFound")}</span>
      </div>
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  return (
    <div className="tests-tab flex flex-col h-full overflow-hidden">
      <div className="tests-summary flex items-center gap-3 h-[32px] px-3 border-b border-border-muted shrink-0">
        <span className="font-sans text-[12px] font-semibold text-fg-primary">
          {passed}/{results.length} Passed
        </span>
        {failed > 0 && (
          <span className="font-sans text-[12px] font-medium text-accent-danger">
            {failed} failed
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {results.map((result, i) => (
          <div key={i} className="border-b border-border-muted">
            <button
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover cursor-pointer transition-colors"
            >
              {result.error ? (
                <ChevronDown
                  size={14}
                  className={`shrink-0 text-fg-tertiary transition-transform ${
                    expandedIdx === i ? "" : "-rotate-90"
                  }`}
                />
              ) : (
                <div className="w-[14px] shrink-0" />
              )}
              {result.passed ? (
                <CheckCircle2 size={14} className="shrink-0 text-accent-success" />
              ) : (
                <XCircle size={14} className="shrink-0 text-accent-danger" />
              )}
              <span
                className={`font-sans text-[12px] flex-1 text-left ${
                  result.passed ? "text-fg-primary" : "text-accent-danger"
                }`}
              >
                {result.name}
              </span>
              <span className="font-mono text-[10px] text-fg-tertiary tabular-nums">
                {result.durationMs}ms
              </span>
            </button>
            {expandedIdx === i && result.error && (
              <div className="px-3 pb-2 pl-[52px]">
                <pre className="font-mono text-[11px] text-accent-danger bg-accent-danger/5 rounded-md p-2 whitespace-pre-wrap">
                  {result.error}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
