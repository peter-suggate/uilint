import { useEffect } from "react";
import { useComposedStore } from "../../core/store";

/**
 * Hook for global keyboard shortcuts
 * - Cmd/Ctrl+K: Toggle command palette
 * - Escape: Close command palette
 * - Alt: Enable heatmap hover details
 */
export function useKeyboardShortcuts() {
  const openCommandPalette = useComposedStore((s) => s.openCommandPalette);
  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const setAltKeyHeld = useComposedStore((s) => s.setAltKeyHeld);
  const isOpen = useComposedStore((s) => s.commandPalette.open);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K toggles palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          closeCommandPalette();
        } else {
          openCommandPalette();
        }
        return;
      }

      // Escape closes palette
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        closeCommandPalette();
        return;
      }

      // Alt key for heatmap details
      if (e.key === "Alt") {
        setAltKeyHeld(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setAltKeyHeld(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isOpen, openCommandPalette, closeCommandPalette, setAltKeyHeld]);
}
