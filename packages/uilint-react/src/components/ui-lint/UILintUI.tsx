"use client";

/**
 * UILint UI - Renders all UI components when UILint is active
 * Toolbar, overlays, badges, and command palette
 */

import React, { useState, useEffect } from "react";
import { useUILintStore, type UILintStore } from "./store";

/**
 * UI components rendered when UILint is active
 */
export function UILintUI() {
  const inspectedElement = useUILintStore(
    (s: UILintStore) => s.inspectedElement
  );
  const liveScanEnabled = useUILintStore((s: UILintStore) => s.liveScanEnabled);
  const visionIssuesCache = useUILintStore(
    (s: UILintStore) => s.visionIssuesCache
  );
  const displayMode = useUILintStore(
    (s: UILintStore) => s.autoScanSettings.eslint.displayMode
  );

  // Dynamically import components to avoid circular dependencies
  const [components, setComponents] = useState<{
    FloatingIcon: React.ComponentType;
    CommandPalette: React.ComponentType;
    VisionIssueHighlight: React.ComponentType;
    InspectedHighlight: React.ComponentType;
    ElementBadges: React.ComponentType;
    HeatmapOverlay: React.ComponentType;
    CoverageHeatmapOverlay: React.ComponentType;
    VisionIssueBadges: React.ComponentType;
    IndexingIndicator: React.ComponentType;
  } | null>(null);

  useEffect(() => {
    // Import components
    Promise.all([
      import("./FloatingIcon"),
      import("./command-palette"),
      import("./LocatorOverlay"),
      import("./ElementBadges"),
      import("./HeatmapOverlay"),
      import("./CoverageHeatmapOverlay"),
      import("./VisionIssueBadge"),
      import("./IndexingIndicator"),
    ]).then(
      ([
        floatingIcon,
        commandPalette,
        locator,
        badges,
        heatmap,
        coverageHeatmap,
        visionBadges,
        indexingIndicator,
      ]) => {
        setComponents({
          FloatingIcon: floatingIcon.FloatingIcon,
          CommandPalette: commandPalette.CommandPalette,
          VisionIssueHighlight: locator.VisionIssueHighlight,
          InspectedHighlight: locator.InspectedElementHighlight,
          ElementBadges: badges.ElementBadges,
          HeatmapOverlay: heatmap.HeatmapOverlay,
          CoverageHeatmapOverlay: coverageHeatmap.CoverageHeatmapOverlay,
          VisionIssueBadges: visionBadges.VisionIssueBadges,
          IndexingIndicator: indexingIndicator.IndexingIndicator,
        });
      }
    );
  }, []);

  if (!components) return null;

  const {
    FloatingIcon,
    CommandPalette,
    VisionIssueHighlight,
    InspectedHighlight,
    ElementBadges,
    HeatmapOverlay,
    CoverageHeatmapOverlay,
    VisionIssueBadges,
    IndexingIndicator,
  } = components;

  const hasVisionIssues = visionIssuesCache.size > 0;

  return (
    <>
      <FloatingIcon />
      <CommandPalette />
      <VisionIssueHighlight />
      {liveScanEnabled && displayMode === "badges" && <ElementBadges />}
      {/* HeatmapOverlay is always rendered when live scan is enabled -
          it internally shows/hides based on command palette selection or Alt key */}
      {liveScanEnabled && <HeatmapOverlay />}
      {/* CoverageHeatmapOverlay shows coverage percentage overlay -
          it internally shows/hides based on showCoverageHeatmap state */}
      {liveScanEnabled && <CoverageHeatmapOverlay />}
      {hasVisionIssues && <VisionIssueBadges />}
      {inspectedElement && <InspectedHighlight />}
      <IndexingIndicator />
    </>
  );
}
