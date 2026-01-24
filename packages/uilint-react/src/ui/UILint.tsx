/**
 * UILint - Root component for the UILint overlay UI
 *
 * Renders:
 * - FloatingIcon: Draggable button to open command palette
 * - HeatmapOverlay: Colored borders on elements with issues
 * - CommandPalette: Search interface for issues
 * - InspectorSidebar: Detail panel for issues/elements
 */
import React, { useEffect } from "react";
import { FloatingIcon } from "./components/FloatingIcon";
import { HeatmapOverlay } from "./components/HeatmapOverlay";
import { CommandPalette } from "./components/CommandPalette";
import { InspectorSidebar } from "./components/Inspector";
import { useKeyboardShortcuts } from "./hooks";

// Create portal container for overlays
function ensurePortalContainer() {
  if (typeof document === "undefined") return;

  let container = document.getElementById("uilint-portal");
  if (!container) {
    container = document.createElement("div");
    container.id = "uilint-portal";
    container.style.cssText = "position: fixed; top: 0; left: 0; z-index: 99990; pointer-events: none;";
    document.body.appendChild(container);
  }
  return container;
}

export interface UILintProps {
  /** Whether the UI is enabled */
  enabled?: boolean;
}

/**
 * Main UILint component
 * Add this to your app to enable the UILint overlay
 */
export function UILint({ enabled = true }: UILintProps) {
  // Set up keyboard shortcuts (Cmd+K, etc.)
  useKeyboardShortcuts();

  // Ensure portal container exists
  useEffect(() => {
    if (enabled) {
      ensurePortalContainer();
    }
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <>
      <FloatingIcon />
      <HeatmapOverlay />
      <CommandPalette />
      <InspectorSidebar />
    </>
  );
}

export default UILint;
