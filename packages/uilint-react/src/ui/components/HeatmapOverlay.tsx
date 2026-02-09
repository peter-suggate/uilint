/* eslint-disable uilint/prefer-tailwind */
/**
 * HeatmapOverlay - Renders colored borders around elements with issues
 *
 * Key interaction model:
 * - Element rectangles are click-through (pointerEvents: none) to allow
 *   interaction with the underlying application
 * - Only the inset badge (square, top-right corner) is clickable
 * - Clicking the badge adds file, rule, and loc filters to narrow to that exact element
 * - Alt+hover on badge shows tooltip with issue details
 *
 * The heatmap automatically reflects the current tile filters:
 * - No filters: show all issues
 * - Rule filter: show only issues for that rule
 * - File filter: show only issues in that file
 * - Loc filter: show only the exact element at that location
 * - Combined filters: intersection of all filter conditions
 */
import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import {
  useComposedStore,
  selectIssuesMap,
  selectSelectedDataLocs,
  selectHasActiveSelection,
  selectPreviewedDataLocs,
  selectHasActivePreview,
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
  isEmphasized: boolean;
  isPreviewed: boolean;
  previewStaggerIndex: number;
  showDetails: boolean;
  onBadgeClick: () => void;
  onBadgeHover: (hovered: boolean) => void;
}

function OverlayItem({ rect, issues, isHovered, isSelected, isEmphasized, isPreviewed, previewStaggerIndex, showDetails, onBadgeClick, onBadgeHover }: OverlayItemProps) {
  // Get highest severity for border color
  const severity = useMemo(() => {
    if (issues.some(i => i.severity === "error")) return "error";
    if (issues.some(i => i.severity === "warning")) return "warning";
    return "info";
  }, [issues]);

  const color = severityToColor(severity);
  const count = issues.length;

  // Calculate opacity based on emphasis state
  // - isEmphasized true: full opacity (1.0)
  // - isEmphasized false: dimmed (0.3)
  // - isPreviewed: boosted to 0.6 (softer than full selection)
  // - hover/selected always boosts visibility
  const baseOpacity = isEmphasized ? 1 : isPreviewed ? 0.6 : 0.3;
  const finalOpacity = isHovered || isSelected ? Math.max(baseOpacity, 0.8) : baseOpacity;

  // Preview glow — subtle pulse via box-shadow
  // Stagger delay per element for a ripple effect (capped at 0.3s)
  const previewDelay = Math.min(previewStaggerIndex * 0.03, 0.3);
  const previewBoxShadow = isPreviewed && !isSelected
    ? `0 0 4px 1px ${color}50`
    : undefined;

  return (
    <div
      style={{
        position: "fixed",
        left: rect.left - 2,
        top: rect.top - 2,
        width: rect.width + 4,
        height: rect.height + 4,
        border: `${isSelected ? 3 : 2}px solid ${color}`,
        borderRadius: 4,
        pointerEvents: "none", // Click-through - allows underlying app interaction
        opacity: finalOpacity,
        transition: `opacity 0.15s ease ${isPreviewed ? `${previewDelay}s` : "0s"}, border-width 0.15s, box-shadow 0.3s ease ${isPreviewed ? `${previewDelay}s` : "0s"}`,
        zIndex: isSelected ? 99991 : 99990,
        boxShadow: isSelected
          ? `0 0 0 2px ${color}40, 0 0 12px ${color}60`
          : previewBoxShadow,
      }}
    >
      {/* Clickable indicator - inset square */}
      <span
        onClick={(e) => {
          e.stopPropagation();
          onBadgeClick();
        }}
        onMouseEnter={() => onBadgeHover(true)}
        onMouseLeave={() => onBadgeHover(false)}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 8,
          height: 8,
          borderRadius: 2,
          background: color,
          pointerEvents: "auto", // Only badge is clickable
          cursor: "pointer",
          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
          transition: "transform 0.1s, box-shadow 0.1s",
        }}
        onMouseOver={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1.2)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
        }}
        onMouseOut={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.3)";
        }}
      />

      {/* Tooltip on Alt+hover badge */}
      {showDetails && isHovered && (
        <div
          style={{
            position: "absolute",
            top: 18,
            right: 0,
            padding: "8px 12px",
            background: "#1f2937",
            color: "white",
            borderRadius: 6,
            fontSize: 12,
            maxWidth: 300,
            whiteSpace: "pre-wrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 99992,
            pointerEvents: "none",
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
  const expandRule = useComposedStore((s) => s.expandRule);
  const expandFileInRule = useComposedStore((s) => s.expandFileInRule);
  const selectIssue = useComposedStore((s) => s.selectIssue);
  const hoveredElementId = useComposedStore((s) => s.hoveredElementId);
  const setHoveredElementId = useComposedStore((s) => s.setHoveredElementId);
  const selectedIssueId = useComposedStore((s) => s.inspector.selectedIssueId);

  // Use selectors for issues and selection state (additive model)
  const issues = useComposedStore(selectIssuesMap);
  const selectedDataLocs = useComposedStore(selectSelectedDataLocs);
  const hasActiveSelection = useComposedStore(selectHasActiveSelection);

  // Preview state (command palette hover/keyboard)
  const previewedDataLocs = useComposedStore(selectPreviewedDataLocs);
  const hasActivePreview = useComposedStore(selectHasActivePreview);

  // Track element positions
  const elementRects = useElementRects(issues);

  // All entries are shown (additive model - no filtering)
  // Emphasis is determined by selectedDataLocs
  const allEntries = useMemo(() => {
    return Array.from(elementRects.entries());
  }, [elementRects]);

  // Handle clicking the badge on an overlay item
  // Opens inspector and expands to the rule/file for this issue
  const handleBadgeClick = (dataLoc: string) => {
    const elementIssues = issues.get(dataLoc) || [];
    if (elementIssues.length > 0) {
      const firstIssue = elementIssues[0];

      // Expand the rule tile for this issue
      expandRule(firstIssue.ruleId);

      // Expand to the file within the rule
      expandFileInRule(firstIssue.filePath);

      // Select the first issue to highlight it
      selectIssue(firstIssue.id);
    }
    // Open the inspector panel
    openInspectorPanel();
  };

  // Handle badge hover - updates hovered element for visual feedback
  const handleBadgeHover = (dataLoc: string, hovered: boolean) => {
    setHoveredElementId(hovered ? dataLoc : null);
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
    >
      {allEntries.map(([dataLoc, { rect }], index) => {
        const elementIssues = issues.get(dataLoc) || [];
        if (elementIssues.length === 0) return null;

        // Emphasis: full opacity if no selection, or if this loc is in selection
        const isEmphasized = !hasActiveSelection || selectedDataLocs.has(dataLoc);
        // Preview: element matches command palette hover/keyboard item
        const isPreviewed = hasActivePreview && previewedDataLocs.has(dataLoc)
          && !isEmphasized; // Don't preview if already emphasized by full selection

        return (
          <OverlayItem
            key={dataLoc}
            dataLoc={dataLoc}
            rect={rect}
            issues={elementIssues}
            isHovered={hoveredElementId === dataLoc}
            isSelected={getSelectedDataLoc === dataLoc}
            isEmphasized={isEmphasized}
            isPreviewed={isPreviewed}
            previewStaggerIndex={index}
            showDetails={altKeyHeld}
            onBadgeClick={() => handleBadgeClick(dataLoc)}
            onBadgeHover={(hovered) => handleBadgeHover(dataLoc, hovered)}
          />
        );
      })}
    </div>,
    portalRoot
  );
}
