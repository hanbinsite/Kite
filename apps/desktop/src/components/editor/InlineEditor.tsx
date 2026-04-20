import { useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, placeholder as cmPlaceholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap, indentOnInput } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { lintKeymap } from "@codemirror/lint";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { xml } from "@codemirror/lang-xml";
import { css } from "@codemirror/lang-css";
import { oneDark } from "@codemirror/theme-one-dark";
import type { Extension } from "@codemirror/state";
import type { RawLanguage } from "@api-client/types";

const languageExtensions: Record<string, () => unknown> = {
    json: json,
    javascript: javascript,
    html: html,
    xml: xml,
    css: css,
    text: () => [],
    yaml: () => [],
};

const baseExtensions = [
    lineNumbers(),
    highlightActiveLine(),
    drawSelection(),
    bracketMatching(),
    closeBrackets(),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle),
    foldGutter(),
    autocompletion(),
    highlightSelectionMatches(),
    history(),
    keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab,
    ]),
    oneDark,
    EditorView.lineWrapping,
    EditorView.theme({
        "&": {
            fontSize: "var(--font-size-code, 12px)",
            fontFamily: "var(--font-family-code, 'JetBrains Mono', monospace)",
            height: "100%",
        },
        ".cm-content": {
            caretColor: "var(--color-brand, #6C5CE7)",
        },
        ".cm-gutters": {
            background: "var(--color-bg-base, #0C0C12)",
            color: "var(--color-fg-tertiary)",
            borderRight: "1px solid var(--color-border-muted)",
        },
        ".cm-activeLineGutter": {
            background: "var(--color-bg-hover)",
        },
        ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
            background: "var(--color-brand-muted, rgba(108, 92, 231, 0.2))",
        },
        ".cm-cursor": {
            borderLeftColor: "var(--color-brand, #6C5CE7)",
        },
    }),
];

interface InlineEditorProps {
    value: string;
    language: RawLanguage;
    onChange: (value: string) => void;
    placeholder?: string;
    readOnly?: boolean;
}

export function InlineEditor({ value, language, onChange, placeholder, readOnly }: InlineEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const langExt = languageExtensions[language]?.() ?? [];
        const extensions: Extension[] = [
            ...baseExtensions,
            langExt as Extension,
            EditorView.updateListener.of((update) => {
                if (update.docChanged && !readOnly) {
                    onChange(update.state.doc.toString());
                }
            }),
        ];
        if (readOnly) extensions.push(EditorState.readOnly.of(true));
        if (placeholder) extensions.push(cmPlaceholder(placeholder));

        const state = EditorState.create({
            doc: value,
            extensions,
        });

        const view = new EditorView({
            state,
            parent: containerRef.current,
        });

        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, [language, readOnly, placeholder]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const currentDoc = view.state.doc.toString();
        if (currentDoc !== value) {
            view.dispatch({
                changes: { from: 0, to: currentDoc.length, insert: value },
            });
        }
    }, [value]);

    return (
        <div
            ref={containerRef}
            className="cm-editor-container w-full h-full overflow-auto rounded-md"
        />
    );
}