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
import type { Issue, IssueSeverity } from "../types";

interface OverlayItemProps {
  dataLoc: string;
  rect: DOMRect;
  issues: Issue[];
  isHovered: boolean;
  isSelected: boolean;
  isEmphasized: boolean;
  isPreviewed: boolean;
  hasActiveSelection: boolean;
  hasActivePreview: boolean;
  previewStaggerIndex: number;
  showExtendedDetails: boolean;
  resolveIssueSeverity: (issue: Issue) => IssueSeverity;
  onBadgeClick: () => void;
  onBadgeHover: (hovered: boolean) => void;
}

function OverlayItem({
  rect,
  issues,
  isHovered,
  isSelected,
  isEmphasized,
  isPreviewed,
  hasActiveSelection,
  hasActivePreview,
  previewStaggerIndex,
  showExtendedDetails,
  resolveIssueSeverity,
  onBadgeClick,
  onBadgeHover,
}: OverlayItemProps) {
  // Get highest severity for border color
  const severity = useMemo(() => {
    if (issues.some((i) => resolveIssueSeverity(i) === "error")) return "error";
    if (issues.some((i) => resolveIssueSeverity(i) === "warning"))
      return "warning";
    return "info";
  }, [issues, resolveIssueSeverity]);

  const color = severityToColor(severity);
  const count = issues.length;

  // Calculate opacity based on emphasis + preview state:
  // Priority: full selection > preview > default
  // - Selection active + emphasized: 1.0
  // - Selection active + not emphasized + previewed: 0.6 + glow
  // - Selection active + not emphasized + not previewed: 0.3
  // - No selection + preview active + previewed: 1.0 + glow
  // - No selection + preview active + not previewed: 0.4
  // - Nothing active: 1.0
  let baseOpacity: number;
  if (hasActiveSelection) {
    baseOpacity = isEmphasized ? 1 : isPreviewed ? 0.6 : 0.3;
  } else if (hasActivePreview) {
    baseOpacity = isPreviewed ? 1 : 0.4;
  } else {
    baseOpacity = 1;
  }
  const finalOpacity =
    isHovered || isSelected ? Math.max(baseOpacity, 0.8) : baseOpacity;

  // Preview glow — animated pulse via CSS animation
  // Stagger delay per element for a ripple effect (capped at 0.3s)
  const previewDelay = Math.min(previewStaggerIndex * 0.03, 0.3);
  const isGlowing = isPreviewed && !isSelected;

  return (
    <div
      style={
        {
          position: "fixed",
          left: rect.left - 2,
          top: rect.top - 2,
          width: rect.width + 4,
          height: rect.height + 4,
          border: `${isSelected ? 3 : 2}px solid ${color}`,
          borderRadius: 4,
          pointerEvents: "none", // Click-through - allows underlying app interaction
          opacity: finalOpacity,
          transition: `opacity 0.15s ease ${
            isPreviewed ? `${previewDelay}s` : "0s"
          }, border-width 0.15s, box-shadow 0.3s ease ${
            isPreviewed ? `${previewDelay}s` : "0s"
          }`,
          zIndex: isSelected ? 99991 : isPreviewed ? 99991 : 99990,
          boxShadow: isSelected
            ? `0 0 0 2px ${color}40, 0 0 12px ${color}60`
            : undefined,
          // CSS custom property for the pulse animation — uses severity color
          "--uilint-pulse-color": `${color}60`,
          animation: isGlowing
            ? `uilint-spotlight 2s ease-in-out ${previewDelay}s infinite`
            : "none",
        } as React.CSSProperties
      }
    >
      {/* Clickable indicator with accessible hit target */}
      <button
        type="button"
        aria-label={`${count} issue${count !== 1 ? "s" : ""} on this element`}
        onClick={(e) => {
          e.stopPropagation();
          onBadgeClick();
        }}
        onMouseEnter={() => onBadgeHover(true)}
        onMouseLeave={() => onBadgeHover(false)}
        style={{
          position: "absolute",
          top: -18,
          right: -18,
          width: 44,
          height: 44,
          border: "none",
          background: "transparent",
          padding: 0,
          pointerEvents: "auto", // Only badge is clickable
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: color,
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            display: "block",
          }}
        />
      </button>

      {/* Tooltip on hover (Alt shows more detail) */}
      {isHovered && (
        <div
          style={{
            position: "absolute",
            top: 18,
            right: 0,
            padding: "8px 12px",
            background: "var(--uilint-surface-elevated)",
            color: "var(--uilint-text-primary)",
            border: "1px solid var(--uilint-border)",
            borderRadius: 6,
            fontSize: 12,
            maxWidth: 300,
            whiteSpace: "pre-wrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 99992,
            pointerEvents: "none",
          }}
        >
          <strong>
            {count} issue{count !== 1 ? "s" : ""}
          </strong>
          <div style={{ marginTop: 4, opacity: 0.8 }}>
            {issues.slice(0, showExtendedDetails ? 3 : 1).map((issue, i) => (
              <div key={i} style={{ marginTop: i > 0 ? 4 : 0 }}>
                • {issue.message.slice(0, 60)}
                {issue.message.length > 60 ? "..." : ""}
              </div>
            ))}
            {issues.length > (showExtendedDetails ? 3 : 1) && (
              <div style={{ marginTop: 4, opacity: 0.6 }}>
                +{issues.length - (showExtendedDetails ? 3 : 1)} more...
              </div>
            )}
            {!showExtendedDetails && issues.length > 1 && (
              <div style={{ marginTop: 4, opacity: 0.6 }}>
                Hold Alt to preview more details
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
  const selectElement = useComposedStore((s) => s.selectElement);
  const hoveredElementId = useComposedStore((s) => s.hoveredElementId);
  const setHoveredElementId = useComposedStore((s) => s.setHoveredElementId);
  const selectedIssueId = useComposedStore((s) => s.inspector.selectedIssueId);
  const ruleConfigs = useComposedStore(
    (s) =>
      (
        s.plugins?.eslint as
          | {
              ruleConfigs?: Map<
                string,
                { severity?: "off" | "warn" | "error" }
              >;
            }
          | undefined
      )?.ruleConfigs
  );

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
  const resolveIssueSeverity = useMemo(
    () =>
      (issue: Issue): IssueSeverity => {
        const configured = ruleConfigs?.get(issue.ruleId)?.severity;
        if (configured === "error") return "error";
        if (configured === "warn") return "warning";
        return issue.severity;
      },
    [ruleConfigs]
  );

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
    // Show element context panel
    selectElement(dataLoc);
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
      if (dataLocIssues.some((i) => i.id === selectedIssueId)) {
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
        const isEmphasized =
          !hasActiveSelection || selectedDataLocs.has(dataLoc);
        // Preview: element matches command palette hover/keyboard item
        const isPreviewed = hasActivePreview && previewedDataLocs.has(dataLoc);

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
            hasActiveSelection={hasActiveSelection}
            hasActivePreview={hasActivePreview}
            previewStaggerIndex={index}
            showExtendedDetails={altKeyHeld}
            resolveIssueSeverity={resolveIssueSeverity}
            onBadgeClick={() => handleBadgeClick(dataLoc)}
            onBadgeHover={(hovered) => handleBadgeHover(dataLoc, hovered)}
          />
        );
      })}
    </div>,
    portalRoot
  );
}
