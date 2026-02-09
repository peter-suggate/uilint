/* eslint-disable uilint/prefer-tailwind */
/**
 * InspectorToggle - Main UI anchor for UILint
 *
 * Positioned at the top-right of the window, serves as the primary entry point
 * to the UILint interface. Includes a keyboard shortcut hint for command palette.
 */
import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useComposedStore } from "../../core/store";
import { UILintInspectorIcon, SearchIcon } from "../icons";
import { getGlassStyles } from "./primitives";
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
  const openInspectorPanel = useComposedStore((s) => s.openInspectorPanel);
  const openCommandPalette = useComposedStore((s) => s.openCommandPalette);
  const isMobile = useComposedStore((s) => s.mobile.isMobile);
  const isTouchDevice = useComposedStore((s) => s.mobile.isTouchDevice);
  const wsConnected = useComposedStore((s) => s.wsConnected);
  const connectionMode = useComposedStore((s) => s.connectionStatus.mode);

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  // Hide when inspector or command palette is open
  if (isInspectorOpen || isCommandPaletteOpen) {
    return null;
  }

  const buttonSize = isMobile ? 44 : 36;
  const modKey = isMac() ? "⌘" : "Ctrl+";
  const showShortcutHint = !isTouchDevice;

  // Show status indicator only in websocket mode when disconnected
  const showStatusIndicator = connectionMode === "websocket" && !wsConnected;

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
          right: 16,
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
        {showShortcutHint && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            style={{
              height: buttonSize,
              padding: "0 12px",
              borderRadius: buttonSize / 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: 12,
              fontWeight: 500,
              color: "var(--uilint-text-muted)",
              ...getGlassStyles("medium", "md", false),
              borderTop: "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
              borderBottom: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
              borderLeft: "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
              borderRight: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
            }}
          >
            <span style={{ opacity: 0.7 }}>{modKey}K</span>
            <span style={{ marginLeft: 6, opacity: 0.5 }}>to search</span>
          </motion.div>
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
              width: buttonSize,
              height: buttonSize,
              borderRadius: buttonSize / 2,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--uilint-text-secondary)",
              ...getGlassStyles("medium", "md", false),
              borderTop: "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
              borderBottom: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
              borderLeft: "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
              borderRight: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
            }}
          >
            <SearchIcon size={isMobile ? 20 : 18} />
          </motion.button>
        )}

        {/* Inspector toggle button */}
        <div style={{ position: "relative" }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openInspectorPanel}
            aria-label="Open inspector"
            title={showStatusIndicator ? "Server not connected - click to see setup instructions" : "Open inspector"}
            style={{
              width: buttonSize,
              height: buttonSize,
              borderRadius: buttonSize / 2,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--uilint-text-secondary)",
              ...getGlassStyles("medium", "md", false),
              borderTop: "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
              borderBottom: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
              borderLeft: "1px solid var(--uilint-glass-border-light, rgba(255, 255, 255, 0.8))",
              borderRight: "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.5))",
            }}
          >
            <UILintInspectorIcon size={isMobile ? 20 : 18} />
          </motion.button>

          {/* Status indicator dot - shows when not connected */}
          {showStatusIndicator && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--uilint-warning, #fbbf24)",
                border: "2px solid var(--uilint-surface, #fff)",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.15)",
              }}
              title="Server not connected"
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    portalRoot
  );
}
