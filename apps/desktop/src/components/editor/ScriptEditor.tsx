import { useState, lazy, Suspense, useCallback, useRef, useEffect } from "react";
import { Sparkles } from "lucide-react";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.default }))
);

const SCRIPT_SNIPPETS = [
  {
    label: "Set timestamp variable",
    code: `pm.variables.set('timestamp', new Date().toISOString());`,
  },
  {
    label: "Extract token from response",
    code: `const jsonData = pm.response.json();
pm.variables.set('token', jsonData.access_token);`,
  },
  {
    label: "Add custom header",
    code: `pm.request.addHeader('X-Request-ID', crypto.randomUUID());`,
  },
  {
    label: "Status code assertion",
    code: `pm.test('Status code is 200', () => {
  pm.expect(pm.response.status).to.eql(200);
});`,
  },
  {
    label: "Response body assertion",
    code: `pm.test('Has expected property', () => {
  const jsonData = pm.response.json();
  pm.expect(jsonData).to.have.property('id');
});`,
  },
  {
    label: "Response time assertion",
    code: `pm.test('Response time is less than 500ms', () => {
  pm.expect(pm.response.time).to.be.below(500);
});`,
  },
  {
    label: "Send additional request",
    code: `pm.sendRequest('https://api.example.com/health', function(err, res) {
  if (err) { console.error(err); return; }
  pm.test('Health check passes', () => {
    pm.expect(res.status).to.eql(200);
  });
});`,
  },
  {
    label: "Clear environment variable",
    code: `pm.environment.unset('tempVar');`,
  },
  {
    label: "Set multiple variables",
    code: `pm.environment.set('baseUrl', 'https://api.example.com');
pm.environment.set('apiKey', 'your-key-here');`,
  },
];

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function LoadingPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full text-fg-tertiary text-[12px] font-sans">
      Loading editor...
    </div>
  );
}

function SnippetMenu({
  onSelect,
  onClose,
}: {
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-3 top-[44px] z-50 w-[260px] bg-bg-elevated border border-border-muted rounded-lg shadow-xl py-1 max-h-[320px] overflow-y-auto"
    >
      <div className="px-3 py-1.5 font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em]">
        Snippets
      </div>
      {SCRIPT_SNIPPETS.map((snippet, i) => (
        <button
          key={i}
          onClick={() => {
            onSelect(snippet.code);
            onClose();
          }}
          className="w-full text-left px-3 py-2 hover:bg-bg-hover cursor-pointer transition-colors"
        >
          <span className="font-sans text-[12px] text-fg-primary">{snippet.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ScriptEditor({ value, onChange, placeholder }: ScriptEditorProps) {
  const [showSnippets, setShowSnippets] = useState(false);
  const editorRef = useRef<unknown>(null);

  const handleEditorMount = useCallback((editor: unknown) => {
    editorRef.current = editor;
  }, []);

  const handleSnippetSelect = useCallback(
    (code: string) => {
      const newValue = value ? value + "\n" + code : code;
      onChange(newValue);
    },
    [value, onChange]
  );

  return (
    <div className="script-editor relative flex flex-col h-full">
      <div className="script-editor-toolbar flex items-center justify-between h-[32px] px-3 border-b border-border-muted shrink-0">
        <span className="font-sans text-[11px] text-fg-tertiary">JavaScript</span>
        <div className="relative">
          <button
            onClick={() => setShowSnippets(!showSnippets)}
            className="flex items-center gap-1 h-[24px] px-2 rounded-[4px] font-sans text-[11px] font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-hover cursor-pointer transition-colors"
          >
            <Sparkles size={12} />
            Snippets
          </button>
          {showSnippets && (
            <SnippetMenu
              onSelect={handleSnippetSelect}
              onClose={() => setShowSnippets(false)}
            />
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<LoadingPlaceholder />}>
          <MonacoEditor
            height="100%"
            language="javascript"
            theme="vs-dark"
            value={value}
            onChange={(v) => onChange(v ?? "")}
            onMount={handleEditorMount}
            options={{
              fontSize: 12,
              fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              renderLineHighlight: "line",
              wordWrap: "on",
              automaticLayout: true,
              tabSize: 2,
              padding: { top: 8 },
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              placeholder: placeholder ?? "",
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
