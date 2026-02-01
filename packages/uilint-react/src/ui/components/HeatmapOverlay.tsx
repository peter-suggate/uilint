/**
 * HeatmapOverlay - Renders colored borders around elements with issues
 * Shows issue count on hover when Alt key is held
 *
 * The heatmap automatically reflects the current tile filters:
 * - No filters: show all issues
 * - Rule filter: show only issues for that rule
 * - Rule + File filter: show only issues for that rule in that file
 */
import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import {
  useComposedStore,
  selectIssuesMap,
  selectHeatmapDataLocs,
  selectHasActiveTileFilters,
} from "../../core/store";
import { useElementRects } from "../hooks/useElementRects";
import { severityToColor } from "../types";
import type { Issue } from "../types";

interface OverlayItemProps {
  dataLoc: string;
  rect: DOMRect;
  issues: Issue[];
  isHovered: boolean;
  isSelected: boolean;
  showDetails: boolean;
  onClick: () => void;
}

function OverlayItem({ rect, issues, isHovered, isSelected, showDetails, onClick }: OverlayItemProps) {
  // Get highest severity for border color
  const severity = useMemo(() => {
    if (issues.some(i => i.severity === "error")) return "error";
    if (issues.some(i => i.severity === "warning")) return "warning";
    return "info";
  }, [issues]);

  const color = severityToColor(severity);
  const count = issues.length;

  return (
    <div
      onClick={onClick}
      style={{
        position: "fixed",
        left: rect.left - 2,
        top: rect.top - 2,
        width: rect.width + 4,
        height: rect.height + 4,
        border: `${isSelected ? 3 : 2}px solid ${color}`,
        borderRadius: 4,
        pointerEvents: "auto",
        cursor: "pointer",
        opacity: isHovered || isSelected ? 1 : 0.6,
        transition: "opacity 0.15s, border-width 0.15s",
        zIndex: isSelected ? 99991 : 99990,
        boxShadow: isSelected ? `0 0 0 2px ${color}40, 0 0 12px ${color}60` : undefined,
      }}
    >
      {/* Issue count badge */}
      <span
        style={{
          position: "absolute",
          top: -10,
          right: -10,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          background: color,
          color: "white",
          fontSize: 10,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 4px",
        }}
      >
        {count}
      </span>

      {/* Tooltip on Alt+hover */}
      {showDetails && isHovered && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 8,
            padding: "8px 12px",
            background: "#1f2937",
            color: "white",
            borderRadius: 6,
            fontSize: 12,
            maxWidth: 300,
            whiteSpace: "pre-wrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 99991,
          }}
        >
          <strong>{count} issue{count !== 1 ? "s" : ""}</strong>
          <div style={{ marginTop: 4, opacity: 0.8 }}>
            {issues.slice(0, 3).map((issue, i) => (
              <div key={i} style={{ marginTop: i > 0 ? 4 : 0 }}>
                • {issue.message.slice(0, 60)}{issue.message.length > 60 ? "..." : ""}
              </div>
            ))}
            {issues.length > 3 && (
              <div style={{ marginTop: 4, opacity: 0.6 }}>
                +{issues.length - 3} more...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function HeatmapOverlay() {
  const altKeyHeld = useComposedStore((s) => s.altKeyHeld);
  const openInspectorPanel = useComposedStore((s) => s.openInspectorPanel);
  const expandFile = useComposedStore((s) => s.expandFile);
  const selectIssue = useComposedStore((s) => s.selectIssue);
  const hoveredElementId = useComposedStore((s) => s.hoveredElementId);
  const setHoveredElementId = useComposedStore((s) => s.setHoveredElementId);
  const selectedIssueId = useComposedStore((s) => s.inspector.selectedIssueId);

  // Use selectors for issues and heatmap filter state
  const issues = useComposedStore(selectIssuesMap);
  const heatmapDataLocs = useComposedStore(selectHeatmapDataLocs);
  const hasActiveTileFilters = useComposedStore(selectHasActiveTileFilters);

  // Track element positions
  const elementRects = useElementRects(issues);

  // Filter elements based on tile filters (derived via selector)
  // When heatmapDataLocs is empty and no filters, show all
  // When heatmapDataLocs is empty but filters exist, show nothing (no matches)
  // When heatmapDataLocs has values, show only those
  const filteredEntries = useMemo(() => {
    const entries = Array.from(elementRects.entries());

    // No filters active = show all issues
    if (!hasActiveTileFilters) {
      return entries;
    }

    // Filters active but no matching dataLocs = show nothing
    if (heatmapDataLocs.length === 0) {
      return [];
    }

    // Filter to only dataLocs that match the tile filters
    const dataLocSet = new Set(heatmapDataLocs);
    return entries.filter(([dataLoc]) => dataLocSet.has(dataLoc));
  }, [elementRects, heatmapDataLocs, hasActiveTileFilters]);

  // Handle clicking an overlay item
  // Opens the unified inspector panel and expands the file containing the clicked element
  const handleClick = (dataLoc: string) => {
    const elementIssues = issues.get(dataLoc) || [];
    if (elementIssues.length > 0) {
      // Expand the file containing this element
      const firstIssue = elementIssues[0];
      expandFile(firstIssue.filePath);
      // Select the first issue to highlight it
      selectIssue(firstIssue.id);
    }
    // Open the inspector panel
    openInspectorPanel();
  };

  // Determine if a dataLoc contains the currently selected issue
  const getSelectedDataLoc = useMemo(() => {
    if (!selectedIssueId) return null;
    for (const [dataLoc, dataLocIssues] of issues.entries()) {
      if (dataLocIssues.some(i => i.id === selectedIssueId)) {
        return dataLoc;
      }
    }
    return null;
  }, [selectedIssueId, issues]);

  // Don't render if no issues
  if (!issues || issues.size === 0) {
    return null;
  }

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 99990,
      }}
      onMouseMove={(e) => {
        // Find element under cursor
        const target = e.target as HTMLElement;
        const dataLoc = target.getAttribute?.("data-loc");
        setHoveredElementId(dataLoc || null);
      }}
    >
      {filteredEntries.map(([dataLoc, { rect }]) => {
        const elementIssues = issues.get(dataLoc) || [];
        if (elementIssues.length === 0) return null;

        return (
          <OverlayItem
            key={dataLoc}
            dataLoc={dataLoc}
            rect={rect}
            issues={elementIssues}
            isHovered={hoveredElementId === dataLoc || hasActiveTileFilters}
            isSelected={getSelectedDataLoc === dataLoc}
            showDetails={altKeyHeld}
            onClick={() => handleClick(dataLoc)}
          />
        );
      })}
    </div>,
    portalRoot
  );
}
