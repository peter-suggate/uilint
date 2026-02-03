/**
 * InspectorToggle - Persistent button to open the inspector panel
 *
 * Positioned at the top-right of the window, provides easy access to the
 * inspector without needing to go through the command palette.
 */
import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useComposedStore } from "../../core/store";
import { DockIcon } from "../icons";
import { getGlassStyles } from "./primitives";

export function InspectorToggle() {
  const isInspectorOpen = useComposedStore((s) => s.inspector.open);
  const isCommandPaletteOpen = useComposedStore((s) => s.commandPalette.open);
  const openInspectorPanel = useComposedStore((s) => s.openInspectorPanel);
  const isMobile = useComposedStore((s) => s.mobile.isMobile);

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  // Hide when inspector or command palette is open
  if (isInspectorOpen || isCommandPaletteOpen) {
    return null;
  }

  const buttonSize = isMobile ? 44 : 36;

  return createPortal(
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
        onClick={openInspectorPanel}
        aria-label="Open inspector"
        title="Open inspector"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "auto",
          color: "var(--uilint-text-secondary)",
          ...getGlassStyles("medium", "md", false),
          borderTop: "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
          borderBottom: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
          borderLeft: "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
          borderRight: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
        }}
      >
        <DockIcon size={isMobile ? 20 : 18} />
      </motion.button>
    </AnimatePresence>,
    portalRoot
  );
}
