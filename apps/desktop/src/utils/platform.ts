const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const modKey = isMac ? "⌘" : "Ctrl";
export const modKeyLabel = isMac ? "Cmd" : "Ctrl";

export function formatShortcut(shortcut: string): string {
  return shortcut.replace(/^Cmd/, modKeyLabel);
}
