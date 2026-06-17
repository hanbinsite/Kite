import { useMemo } from "react";

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNum: number;
}

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  let i = 0;
  let j = 0;

  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: "unchanged", content: oldLines[i]!, lineNum: i + 1 });
      i++;
      j++;
    } else {
      const lookahead = newLines.slice(j).indexOf(oldLines[i]!);
      if (lookahead > 0 && lookahead <= 3) {
        for (let k = 0; k < lookahead; k++) {
          result.push({ type: "added", content: newLines[j + k]!, lineNum: j + k + 1 });
        }
        j += lookahead;
      } else {
        result.push({ type: "removed", content: oldLines[i]!, lineNum: i + 1 });
        result.push({ type: "added", content: newLines[j]!, lineNum: j + 1 });
        i++;
        j++;
      }
    }
  }

  while (i < oldLines.length) {
    result.push({ type: "removed", content: oldLines[i]!, lineNum: i + 1 });
    i++;
  }
  while (j < newLines.length) {
    result.push({ type: "added", content: newLines[j]!, lineNum: j + 1 });
    j++;
  }

  return result;
}

function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

interface DiffViewerProps {
  previous: string;
  current: string;
}

export function DiffViewer({ previous, current }: DiffViewerProps) {
  const prevFormatted = useMemo(() => formatJson(previous), [previous]);
  const currFormatted = useMemo(() => formatJson(current), [current]);
  const isBothJson = useMemo(() => {
    try { JSON.parse(previous); JSON.parse(current); return true; } catch { return false; }
  }, [previous, current]);

  if (!isBothJson) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto">
          <div className="p-3 font-mono text-[12px] leading-relaxed text-fg-secondary whitespace-pre-wrap">
            {prevFormatted}
          </div>
          <div className="border-t-2 border-brand/30" />
          <div className="p-3 font-mono text-[12px] leading-relaxed text-fg-primary whitespace-pre-wrap">
            {currFormatted}
          </div>
        </div>
      </div>
    );
  }

  const diff = useMemo(() => computeLineDiff(prevFormatted, currFormatted), [prevFormatted, currFormatted]);

  const addedCount = diff.filter((d) => d.type === "added").length;
  const removedCount = diff.filter((d) => d.type === "removed").length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 h-[28px] px-3 border-b border-border-muted shrink-0 text-[10px]">
        <span className="text-accent-success">+{addedCount} added</span>
        <span className="text-accent-danger">-{removedCount} removed</span>
      </div>
      <div className="flex-1 overflow-auto font-mono text-[11px] leading-[1.6]">
        {diff.map((line, i) => (
          <div
            key={i}
            className={`flex items-start px-3 min-h-[20px] ${
              line.type === "added"
                ? "bg-accent-success/8 text-accent-success"
                : line.type === "removed"
                  ? "bg-accent-danger/8 text-accent-danger"
                  : "text-fg-secondary"
            }`}
          >
            <span className="w-5 shrink-0 text-right mr-2 text-fg-tertiary text-[10px] select-none">
              {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
            </span>
            <span className="whitespace-pre">{line.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
