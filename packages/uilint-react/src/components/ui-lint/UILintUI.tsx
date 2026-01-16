"use client";

/**
 * UILint UI - Renders all UI components when UILint is active
 * Toolbar, overlays, badges, and inspection panel
 */

import React, { useState, useEffect } from "react";
import { useUILintStore, type UILintStore } from "./store";

/**
 * UI components rendered when UILint is active
 */
export function UILintUI() {
  const altKeyHeld = useUILintStore((s: UILintStore) => s.altKeyHeld);
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
    Toolbar: React.ComponentType;
    Panel: React.ComponentType;
    LocatorOverlay: React.ComponentType;
    VisionIssueHighlight: React.ComponentType;
    InspectedHighlight: React.ComponentType;
    ElementBadges: React.ComponentType;
    HeatmapOverlay: React.ComponentType;
    VisionIssueBadges: React.ComponentType;
  } | null>(null);

  useEffect(() => {
    // Import components
    Promise.all([
      import("./toolbar"),
      import("./InspectionPanel"),
      import("./LocatorOverlay"),
      import("./ElementBadges"),
      import("./HeatmapOverlay"),
      import("./VisionIssueBadge"),
    ]).then(([toolbar, panel, locator, badges, heatmap, visionBadges]) => {
      setComponents({
        Toolbar: toolbar.UILintToolbar,
        Panel: panel.InspectionPanel,
        LocatorOverlay: locator.LocatorOverlay,
        VisionIssueHighlight: locator.VisionIssueHighlight,
        InspectedHighlight: locator.InspectedElementHighlight,
        ElementBadges: badges.ElementBadges,
        HeatmapOverlay: heatmap.HeatmapOverlay,
        VisionIssueBadges: visionBadges.VisionIssueBadges,
      });
    });
  }, []);

  if (!components) return null;

  const {
    Toolbar,
    Panel,
    LocatorOverlay,
    VisionIssueHighlight,
    InspectedHighlight,
    ElementBadges,
    HeatmapOverlay,
    VisionIssueBadges,
  } = components;

  const hasVisionIssues = visionIssuesCache.size > 0;

  return (
    <>
      <Toolbar />
      {(altKeyHeld || inspectedElement) && <LocatorOverlay />}
      <VisionIssueHighlight />
      {liveScanEnabled && displayMode === "badges" && <ElementBadges />}
      {liveScanEnabled && displayMode === "heatmap" && <HeatmapOverlay />}
      {hasVisionIssues && <VisionIssueBadges />}
      {inspectedElement && (
        <>
          <InspectedHighlight />
          <Panel />
        </>
      )}
    </>
  );
}
