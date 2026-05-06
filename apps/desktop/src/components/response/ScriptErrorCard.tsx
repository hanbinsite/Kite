interface ScriptErrorCardProps {
  phase: string;
  source: string;
  error: string;
  onEditScript?: () => void;
}

export function ScriptErrorCard({ phase, source, error, onEditScript }: ScriptErrorCardProps) {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="max-w-[480px] w-full bg-bg-elevated rounded-lg border border-accent-danger/30 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-accent-danger/15 flex items-center justify-center text-accent-danger text-[16px] font-bold">
            !
          </div>
          <div>
            <div className="text-[14px] font-semibold text-fg-primary">Script Error</div>
            <div className="text-[11px] text-fg-secondary">
              [{phase}][{source}]
            </div>
          </div>
        </div>
        <div className="bg-bg-base rounded p-3 mb-4">
          <pre className="text-[12px] text-accent-danger whitespace-pre-wrap break-words font-mono">
            {error}
          </pre>
        </div>
        {onEditScript && (
          <button
            onClick={onEditScript}
            className="text-[12px] px-3 py-1.5 rounded bg-brand text-white hover:bg-brand/80 transition-colors"
          >
            Edit Script
          </button>
        )}
      </div>
    </div>
  );
}
