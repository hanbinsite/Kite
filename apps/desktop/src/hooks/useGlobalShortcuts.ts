import { useEffect, useCallback } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

interface ShortcutConfig {
  shortcut: string;
  handler: () => void;
}

export function useGlobalShortcuts(shortcuts: ShortcutConfig[], enabled = true) {
  const registerShortcuts = useCallback(async () => {
    for (const { shortcut, handler } of shortcuts) {
      try {
        await register(shortcut, handler);
      } catch (error) {
        console.warn(`Failed to register shortcut ${shortcut}:`, error);
      }
    }
  }, [shortcuts]);

  const unregisterShortcuts = useCallback(async () => {
    for (const { shortcut } of shortcuts) {
      try {
        await unregister(shortcut);
      } catch (error) {
        console.warn(`Failed to unregister shortcut ${shortcut}:`, error);
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    if (enabled) {
      registerShortcuts();
    }
    return () => {
      unregisterShortcuts();
    };
  }, [enabled, registerShortcuts, unregisterShortcuts]);
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const { shortcut, handler } of shortcuts) {
        const isMeta = e.metaKey || e.ctrlKey;
        const isShift = e.shiftKey;
        const isAlt = e.altKey;

        if (shortcut.includes("cmd") && !isMeta) continue;
        if (shortcut.includes("shift") && !isShift) continue;
        if (shortcut.includes("alt") && !isAlt) continue;

        const key = shortcut
          .toLowerCase()
          .replace(/cmd\+/, "")
          .replace(/shift\+/, "")
          .replace(/alt\+/, "");

        if (e.key.toLowerCase() === key && isMeta) {
          e.preventDefault();
          handler();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
