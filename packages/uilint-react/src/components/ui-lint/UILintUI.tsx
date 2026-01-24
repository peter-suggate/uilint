"use client";

/**
 * UILint UI - Renders all UI components when UILint is active
 * Toolbar, heatmap overlays, and command palette
 */

import React, { useState, useEffect } from "react";
import { useUILintStore, type UILintStore } from "./store";

/**
 * UI components rendered when UILint is active
 */
export function UILintUI() {
  const liveScanEnabled = useUILintStore((s: UILintStore) => s.liveScanEnabled);

  // Dynamically import components to avoid circular dependencies
  const [components, setComponents] = useState<{
    FloatingIcon: React.ComponentType;
    CommandPalette: React.ComponentType;
    HeatmapOverlay: React.ComponentType;
    IndexingIndicator: React.ComponentType;
    InspectorSidebar: React.ComponentType;
  } | null>(null);

  useEffect(() => {
    // Import components
    Promise.all([
      import("./FloatingIcon"),
      import("./command-palette"),
      import("./HeatmapOverlay"),
      import("./IndexingIndicator"),
      import("./inspector"),
    ]).then(
      ([
        floatingIcon,
        commandPalette,
        heatmap,
        indexingIndicator,
        inspector,
      ]) => {
        setComponents({
          FloatingIcon: floatingIcon.FloatingIcon,
          CommandPalette: commandPalette.CommandPalette,
          HeatmapOverlay: heatmap.HeatmapOverlay,
          IndexingIndicator: indexingIndicator.IndexingIndicator,
          InspectorSidebar: inspector.InspectorSidebar,
        });
      }
    );
  }, []);

  if (!components) return null;

  const {
    FloatingIcon,
    CommandPalette,
    HeatmapOverlay,
    IndexingIndicator,
    InspectorSidebar,
  } = components;

  return (
    <>
      <FloatingIcon />
      <CommandPalette />
      {/* HeatmapOverlay shows issue density visualization -
          it internally shows/hides based on command palette selection or Alt key */}
      {liveScanEnabled && <HeatmapOverlay />}
      <IndexingIndicator />
      {/* Inspector sidebar - handles both docked and floating modes internally */}
      <InspectorSidebar />
    </>
  );
}
