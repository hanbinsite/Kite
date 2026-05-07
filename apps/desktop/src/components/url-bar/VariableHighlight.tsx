import { useState, useEffect, useCallback } from "react";
import { useEnvironmentStore } from "../../stores/environment-store";
import { useCollectionStore } from "../../stores/collection-store";
import { useTabStore } from "@api-client/core";

interface VariableAutocompleteProps {
	url: string;
	cursorPosition: number;
	onSelect: (variableName: string) => void;
	onClose: () => void;
}

export function VariableAutocomplete({ url, cursorPosition, onSelect, onClose }: VariableAutocompleteProps) {
	const textBeforeCursor = url.slice(0, cursorPosition);
	const openBraceIndex = textBeforeCursor.lastIndexOf("{{");
	const closeBraceIndex = textBeforeCursor.lastIndexOf("}}");

	const isInsideVariable = openBraceIndex !== -1 && openBraceIndex > closeBraceIndex;
	const partialName = isInsideVariable ? textBeforeCursor.slice(openBraceIndex + 2).trimStart() : "";

	const environments = useEnvironmentStore((s) => s.environments);
	const activeEnvId = useEnvironmentStore((s) => s.activeEnvironmentId);
	const activeEnv = environments.find((e) => e.id === activeEnvId);
	const globals = useEnvironmentStore((s) => s.globals);
	const activeTabId = useTabStore((s) => s.activeTabId);
	const tabs = useTabStore((s) => s.tabs);

	const activeTab = tabs.find((t) => t.id === activeTabId);
	const requestId = activeTab?.requestId;

	const collectionVars: { name: string; value: string; source: "collection" | "folder" }[] = [];
	if (requestId) {
		const hierarchy = useCollectionStore.getState().resolveRequestHierarchy(requestId);
		if (hierarchy) {
			if (hierarchy.collectionConfig?.variables) {
				for (const v of hierarchy.collectionConfig.variables) {
					if (v.enabled && v.key) collectionVars.push({ name: v.key, value: v.value, source: "collection" });
				}
			}
			for (const folder of hierarchy.folderPath) {
				if (folder.config?.variables) {
					for (const v of folder.config.variables) {
						if (v.enabled && v.key) collectionVars.push({ name: v.key, value: v.value, source: "folder" });
					}
				}
			}
		}
	}

	const availableVars = [
		...globals.map((v) => ({ name: v.key, value: v.value, source: "global" as const })),
		...(activeEnv?.variables.map((v) => ({ name: v.key, value: v.value, source: "env" as const })) || []),
		...collectionVars,
	];

	const filtered = availableVars.filter((v) => v.name.toLowerCase().includes(partialName.toLowerCase()));
	const [selectedIndex, setSelectedIndex] = useState(0);

	useEffect(() => {
		setSelectedIndex(0);
	}, [partialName]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!isInsideVariable || filtered.length === 0) return;

			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((i) => (i + 1) % filtered.length);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
			} else if (e.key === "Enter" && filtered[selectedIndex]) {
				e.preventDefault();
				onSelect(filtered[selectedIndex].name);
			} else if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		},
		[isInsideVariable, filtered, selectedIndex, onSelect, onClose],
	);

	useEffect(() => {
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	if (!isInsideVariable || filtered.length === 0) return null;

	const sourceLabel: Record<string, string> = { global: "G", env: "E", collection: "C", folder: "F" };

	return (
		<div className="absolute left-0 top-full mt-1 z-[9999] bg-bg-elevated border border-border-muted rounded-lg shadow-lg py-1 w-56 max-h-48 overflow-y-auto">
			{filtered.map((v, i) => (
				<button
					key={`${v.source}-${v.name}`}
					className={`flex items-center gap-2 w-full h-7 px-3 text-xs ${
						i === selectedIndex ? "bg-brand-muted text-brand" : "hover:bg-bg-hover"
					}`}
					onClick={() => onSelect(v.name)}
					onMouseEnter={() => setSelectedIndex(i)}
				>
					<span className="w-4 text-[10px] text-fg-tertiary shrink-0 text-center">{sourceLabel[v.source] ?? ""}</span>
					<span className="font-mono text-fg-primary flex-1 text-left">{"{{"}{v.name}{"}}"}</span>
					<span className="text-fg-tertiary text-[10px] truncate max-w-20">{v.value}</span>
				</button>
			))}
		</div>
	);
}

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

export function VariableHighlightOverlay({ text }: { text: string }) {
	const getVariable = useEnvironmentStore((s) => s.getVariable);

	if (!text.includes("{{")) return <>{text}</>;

	const parts: React.ReactNode[] = [];
	let lastIndex = 0;
	VARIABLE_PATTERN.lastIndex = 0;
	let match: RegExpExecArray | null;
	let key = 0;

	while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
		if (match.index > lastIndex) {
			parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
		}
		const varName = match[1] ?? "";
		const value = getVariable(varName);
		const isUndefined = value === undefined;
		parts.push(
			<span
				key={key++}
				className={isUndefined ? "variable-highlight text-accent-danger bg-accent-danger/10" : "variable-highlight"}
				title={value !== undefined ? value : `Undefined: ${varName}`}
			>
				{match[0]}
			</span>,
		);
		lastIndex = VARIABLE_PATTERN.lastIndex;
	}

	if (lastIndex < text.length) {
		parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
	}

	return <>{parts}</>;
}
