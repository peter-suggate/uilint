/**
 * DuplicatesInspectorPanel - Inspector panel for semantic duplicates
 *
 * Shows a stacked vertical layout comparing source and target duplicate code:
 * - Sticky similarity header with color-coded badge
 * - Source code section (scrollable)
 * - Target/similar code section (scrollable)
 * - Action bar with "Show in Heatmap" button
 */
import React, { useEffect, useState, useCallback } from "react";
import type { InspectorPanelProps } from "../../../core/plugin-system/types";
import { useComposedStore } from "../../../core/store";
import { DuplicateSimilarityBadge } from "./DuplicateSimilarityBadge";
import { ScrollableCodeSection } from "./ScrollableCodeSection";
import { useDiffHighlights } from "./useDiffHighlights";

/**
 * Location data for a code chunk
 */
interface LocationData {
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

/**
 * Extended issue data for duplicates
 */
interface DuplicateIssueData {
  /** The issue message */
  message?: string;
  /** Rule ID */
  ruleId?: string;
  /** Source code string */
  sourceCode?: string;
  /** Target/similar code string */
  targetCode?: string;
  /** Location of source code */
  sourceLocation?: LocationData;
  /** Location of target code */
  targetLocation?: LocationData;
  /** Similarity score (0-1 or 0-100) */
  similarity?: number;
  /** Name of source function/component */
  sourceName?: string;
  /** Name of target function/component */
  targetName?: string;
}

/**
 * Icon for "This Code" section
 */
function SourceIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Icon for "Similar Code" section
 */
function TargetIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/**
 * Extract issue data from panel props
 */
function extractIssueData(data?: Record<string, unknown>): DuplicateIssueData | null {
  if (!data) return null;

  // The data might be directly the issue or nested under 'issue'
  const issue = (data.issue as DuplicateIssueData) || data;

  return {
    message: issue.message as string | undefined,
    ruleId: issue.ruleId as string | undefined,
    sourceCode: issue.sourceCode as string | undefined,
    targetCode: issue.targetCode as string | undefined,
    sourceLocation: issue.sourceLocation as LocationData | undefined,
    targetLocation: issue.targetLocation as LocationData | undefined,
    similarity: issue.similarity as number | undefined,
    sourceName: issue.sourceName as string | undefined,
    targetName: issue.targetName as string | undefined,
  };
}

export function DuplicatesInspectorPanel({ data, services }: InspectorPanelProps) {
  const issueData = extractIssueData(data);

  // Get heatmap filter actions from store
  const setHeatmapFilter = useComposedStore((s) => s.setHeatmapFilter);
  const clearHeatmapFilter = useComposedStore((s) => s.clearHeatmapFilter);
  const heatmapFilter = useComposedStore((s) => s.heatmapFilter);

  // Track whether heatmap filter is active for this duplicate
  const [isFilterActive, setIsFilterActive] = useState(false);

  // Compute diff highlights between source and target
  const { sourceLines, targetLines, computed: diffComputed } = useDiffHighlights(
    issueData?.sourceCode || "",
    issueData?.targetCode || ""
  );

  // Build dataLoc strings from locations
  const getDataLoc = useCallback((loc: LocationData | undefined): string | null => {
    if (!loc) return null;
    // Format: "path:line:column" - matching the data-loc attribute format
    return `${loc.filePath}:${loc.startLine}:${loc.startColumn ?? 0}`;
  }, []);

  const sourceDataLoc = getDataLoc(issueData?.sourceLocation);
  const targetDataLoc = getDataLoc(issueData?.targetLocation);

  // Clear heatmap filter when panel unmounts
  useEffect(() => {
    return () => {
      clearHeatmapFilter();
    };
  }, [clearHeatmapFilter]);

  // Handle missing data
  if (!issueData) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--uilint-text-muted)",
          fontSize: 13,
        }}
      >
        No duplicate information available.
      </div>
    );
  }

  // Handle missing code
  if (!issueData.sourceCode || !issueData.targetCode) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--uilint-text-muted)",
          fontSize: 13,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          Code comparison not available.
        </div>
        <div style={{ fontSize: 11, opacity: 0.8 }}>
          Run the latest version of the duplicates rule to see code comparison.
        </div>
      </div>
    );
  }

  const similarity = issueData.similarity ?? 0;
  const sourceLocation = issueData.sourceLocation;
  const targetLocation = issueData.targetLocation;

  // Check if filter is currently active for these locations
  const filterIsActive =
    heatmapFilter.mode === "related-only" &&
    heatmapFilter.highlightedLocs.length > 0 &&
    (sourceDataLoc && heatmapFilter.highlightedLocs.includes(sourceDataLoc));

  // Handle "Show in Heatmap" click - toggles filter
  const handleShowInHeatmap = useCallback(() => {
    if (filterIsActive) {
      // Turn off filter
      clearHeatmapFilter();
      setIsFilterActive(false);
    } else {
      // Turn on filter for both source and target locations
      const locs: string[] = [];
      if (sourceDataLoc) locs.push(sourceDataLoc);
      if (targetDataLoc) locs.push(targetDataLoc);

      if (locs.length > 0) {
        setHeatmapFilter(locs, "Duplicate Pair");
        setIsFilterActive(true);
      }
    }
  }, [filterIsActive, sourceDataLoc, targetDataLoc, setHeatmapFilter, clearHeatmapFilter]);

  // Handle file navigation
  const handleNavigateToSource = () => {
    if (sourceLocation) {
      console.log("[DuplicatesInspectorPanel] Navigate to source", sourceLocation);
      // Could integrate with IDE via existing navigation mechanism
    }
  };

  const handleNavigateToTarget = () => {
    if (targetLocation) {
      console.log("[DuplicatesInspectorPanel] Navigate to target", targetLocation);
      // Could integrate with IDE via existing navigation mechanism
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 12,
        height: "100%",
        overflow: "auto",
      }}
    >
      {/* Sticky similarity header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "8px 0",
          background: "var(--uilint-background)",
        }}
      >
        <DuplicateSimilarityBadge similarity={similarity} />
      </div>

      {/* Source code section */}
      {sourceLocation && (
        <ScrollableCodeSection
          label="This Code"
          icon={<SourceIcon />}
          filePath={sourceLocation.filePath}
          code={issueData.sourceCode}
          startLine={sourceLocation.startLine}
          endLine={sourceLocation.endLine}
          focusLine={sourceLocation.startLine}
          diffLines={diffComputed ? sourceLines : undefined}
          onNavigate={handleNavigateToSource}
          maxHeight={250}
        />
      )}

      {/* Target/similar code section */}
      {targetLocation && (
        <ScrollableCodeSection
          label="Similar Code"
          icon={<TargetIcon />}
          filePath={targetLocation.filePath}
          code={issueData.targetCode}
          startLine={targetLocation.startLine}
          endLine={targetLocation.endLine}
          focusLine={targetLocation.startLine}
          diffLines={diffComputed ? targetLines : undefined}
          onNavigate={handleNavigateToTarget}
          maxHeight={250}
        />
      )}

      {/* Action bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          paddingTop: 8,
          borderTop: "1px solid var(--uilint-border)",
        }}
      >
        <button
          onClick={handleShowInHeatmap}
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 500,
            color: filterIsActive ? "white" : "var(--uilint-text-primary)",
            background: filterIsActive ? "#f59e0b" : "var(--uilint-surface)",
            border: filterIsActive ? "1px solid #f59e0b" : "1px solid var(--uilint-border)",
            borderRadius: 6,
            cursor: "pointer",
            transition: "background 0.15s, border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!filterIsActive) {
              e.currentTarget.style.background = "var(--uilint-surface-elevated)";
              e.currentTarget.style.borderColor = "var(--uilint-border-hover)";
            }
          }}
          onMouseLeave={(e) => {
            if (!filterIsActive) {
              e.currentTarget.style.background = "var(--uilint-surface)";
              e.currentTarget.style.borderColor = "var(--uilint-border)";
            }
          }}
        >
          {filterIsActive ? "Clear Heatmap Filter" : "Focus in Heatmap"}
        </button>
      </div>

      {/* Debug info (only in development) */}
      {process.env.NODE_ENV === "development" && !diffComputed && (
        <div
          style={{
            fontSize: 10,
            color: "var(--uilint-text-disabled)",
            textAlign: "center",
          }}
        >
          Diff highlighting skipped (code too large)
        </div>
      )}
    </div>
  );
}

/**
 * Panel title function
 */
export function getDuplicatesPanelTitle(): string {
  return "Duplicate Code";
}

export default DuplicatesInspectorPanel;
