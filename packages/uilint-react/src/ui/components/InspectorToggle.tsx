/* eslint-disable uilint/prefer-tailwind */
/**
 * InspectorToggle - Minimal keyboard shortcut hint for UILint
 *
 * Shows a small <kbd> element at the top-right indicating the Cmd+K shortcut.
 * On touch devices, shows a search button instead.
 */
import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useComposedStore } from "../../core/store";
import { SearchIcon } from "../icons";
import { PluginToolbar } from "./PluginToolbar";
import { OperationProgressIndicator } from "./OperationProgressIndicator";

/** Detect macOS for showing correct modifier key symbol */
function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

export function InspectorToggle() {
  const isInspectorOpen = useComposedStore((s) => s.inspector.open);
  const isCommandPaletteOpen = useComposedStore((s) => s.commandPalette.open);
  const openCommandPalette = useComposedStore((s) => s.openCommandPalette);
  const isMobile = useComposedStore((s) => s.mobile.isMobile);
  const isTouchDevice = useComposedStore((s) => s.mobile.isTouchDevice);

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  // Hide when inspector or command palette is open
  if (isInspectorOpen || isCommandPaletteOpen) {
    return null;
  }

  const modKey = isMac() ? "⌘" : "Ctrl+";

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
        style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          pointerEvents: "auto",
        }}
      >
        {/* Plugin toolbar action groups (e.g., Vision Capture) */}
        <PluginToolbar />

        {/* Progress indicator for active plugin operations */}
        <OperationProgressIndicator />

        {/* Keyboard shortcut hint - shown on non-touch devices */}
        {!isTouchDevice && (
          <motion.kbd
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 0.5, x: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            style={{
              padding: "2px 6px",
              borderRadius: 4,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: 11,
              fontWeight: 500,
              color: "var(--uilint-text-muted)",
              background: "rgba(0, 0, 0, 0.06)",
              border: "1px solid rgba(0, 0, 0, 0.1)",
              lineHeight: 1,
            }}
          >
            {modKey}K issues
          </motion.kbd>
        )}

        {/* Search button - shown on touch devices (mobile) */}
        {isTouchDevice && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
            onClick={openCommandPalette}
            aria-label="Open search"
            title="Search issues"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--uilint-text-secondary)",
              background: "rgba(0, 0, 0, 0.06)",
            }}
          >
            <SearchIcon size={isMobile ? 20 : 18} />
          </motion.button>
        )}
      </motion.div>
    </AnimatePresence>,
    portalRoot
  );
}
