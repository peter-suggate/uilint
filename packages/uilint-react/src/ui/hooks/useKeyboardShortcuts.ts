import { useEffect } from "react";
import { useComposedStore } from "../../core/store";
import { pluginRegistry } from "../../core/plugin-system/registry";
import { getPluginServices } from "../../core/store/composed-store";

/**
 * Hook for global keyboard shortcuts
 * - Cmd/Ctrl+K: Toggle command palette
 * - Cmd/Ctrl+Shift+C: Vision capture full page
 * - Cmd/Ctrl+Shift+R: Vision capture region
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

      // Cmd+Shift+C or Ctrl+Shift+C: Vision capture full page
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "C") {
        e.preventDefault();
        const services = getPluginServices();
        if (!services) return;
        // Find the full page capture action from toolbar action groups
        const groups = pluginRegistry.getAllToolbarActionGroups();
        for (const group of groups) {
          const action = group.actions.find((a) => a.id === "vision:capture-full-page");
          if (action) {
            action.onClick(services);
            return;
          }
        }
        return;
      }

      // Cmd+Shift+R or Ctrl+Shift+R: Vision capture region
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "R") {
        e.preventDefault();
        const services = getPluginServices();
        if (!services) return;
        const groups = pluginRegistry.getAllToolbarActionGroups();
        for (const group of groups) {
          const action = group.actions.find((a) => a.id === "vision:capture-region");
          if (action) {
            action.onClick(services);
            return;
          }
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
