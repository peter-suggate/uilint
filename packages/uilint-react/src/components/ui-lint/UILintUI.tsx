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
    CoverageHeatmapOverlay: React.ComponentType;
    IndexingIndicator: React.ComponentType;
  } | null>(null);

  useEffect(() => {
    // Import components
    Promise.all([
      import("./FloatingIcon"),
      import("./command-palette"),
      import("./HeatmapOverlay"),
      import("./CoverageHeatmapOverlay"),
      import("./IndexingIndicator"),
    ]).then(
      ([
        floatingIcon,
        commandPalette,
        heatmap,
        coverageHeatmap,
        indexingIndicator,
      ]) => {
        setComponents({
          FloatingIcon: floatingIcon.FloatingIcon,
          CommandPalette: commandPalette.CommandPalette,
          HeatmapOverlay: heatmap.HeatmapOverlay,
          CoverageHeatmapOverlay: coverageHeatmap.CoverageHeatmapOverlay,
          IndexingIndicator: indexingIndicator.IndexingIndicator,
        });
      }
    );
  }, []);

  if (!components) return null;

  const {
    FloatingIcon,
    CommandPalette,
    HeatmapOverlay,
    CoverageHeatmapOverlay,
    IndexingIndicator,
  } = components;

  return (
    <>
      <FloatingIcon />
      <CommandPalette />
      {/* HeatmapOverlay shows issue density visualization -
          it internally shows/hides based on command palette selection or Alt key */}
      {liveScanEnabled && <HeatmapOverlay />}
      {/* CoverageHeatmapOverlay shows coverage percentage overlay -
          it internally shows/hides based on showCoverageHeatmap state */}
      {liveScanEnabled && <CoverageHeatmapOverlay />}
      <IndexingIndicator />
    </>
  );
}
