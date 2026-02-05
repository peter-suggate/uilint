/* eslint-disable uilint/prefer-tailwind */
/**
 * DuplicatesInspectorPanel - Inspector panel for semantic duplicates
 *
 * Shows a stacked vertical layout comparing source and target duplicate code:
 * - Sticky similarity header with color-coded badge
 * - Source code section (scrollable)
 * - Target/similar code section (scrollable)
 * - Action bar with "Show in Heatmap" button
 *
 * When extended data (sourceCode, targetCode) is not available (e.g., in static mode),
 * the panel parses the ESLint message to extract target info and fetches code dynamically.
 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { devLog } from "uilint-core";
import type { InspectorPanelProps } from "../../../core/plugin-system/types";
import { useComposedStore } from "../../../core/store";
import { DuplicateSimilarityBadge } from "./DuplicateSimilarityBadge";
import { ScrollableCodeSection } from "./ScrollableCodeSection";
import { useDiffHighlights } from "./useDiffHighlights";
import { useSourceCode } from "../../../ui/hooks/useSourceCode";

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
 * Parse the ESLint message to extract duplicate info.
 * Message format: "This {kind} '{name}' is {similarity}% similar to '{otherName}' at {otherLocation}. Consider consolidating."
 */
interface ParsedDuplicateMessage {
  kind?: string;
  sourceName?: string;
  similarity?: number;
  targetName?: string;
  targetFilePath?: string;
  targetLine?: number;
}

function parseDuplicateMessage(message: string | undefined): ParsedDuplicateMessage | null {
  if (!message) return null;

  // Pattern: "This component 'Button' is 85% similar to 'OtherButton' at path/file.tsx:42. Consider consolidating."
  const regex = /This\s+(\w+)\s+'([^']+)'\s+is\s+(\d+)%\s+similar\s+to\s+'([^']+)'\s+at\s+([^:]+):(\d+)/i;
  const match = message.match(regex);

  if (!match) return null;

  return {
    kind: match[1],
    sourceName: match[2],
    similarity: parseInt(match[3], 10),
    targetName: match[4],
    targetFilePath: match[5],
    targetLine: parseInt(match[6], 10),
  };
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

export function DuplicatesInspectorPanel({ data }: InspectorPanelProps) {
  const issueData = extractIssueData(data);

  // Get heatmap filter actions from store
  const setHeatmapFilter = useComposedStore((s) => s.setHeatmapFilter);
  const clearHeatmapFilter = useComposedStore((s) => s.clearHeatmapFilter);
  const heatmapFilter = useComposedStore((s) => s.heatmapFilter);

  // Track whether heatmap filter is active for this duplicate
  const [_isFilterActive, setIsFilterActive] = useState(false);

  // Extract issue info from the data prop (comes from the Issue object when clicking an issue)
  const issueInfo = useMemo(() => {
    if (!data) return null;
    // Try to get from nested issue object first, then from data directly
    const issue = (data.issue as Record<string, unknown>) || data;
    return {
      filePath: (issue.filePath as string) || "",
      line: (issue.line as number) || 0,
      column: (issue.column as number) || 0,
      message: (issue.message as string) || "",
      dataLoc: (issue.dataLoc as string) || "",
    };
  }, [data]);

  // Parse the message to extract target info when extended data is missing
  const parsedMessage = useMemo(() => {
    return parseDuplicateMessage(issueInfo?.message || issueData?.message);
  }, [issueInfo?.message, issueData?.message]);

  // Determine if we need to fetch code dynamically
  const needsDynamicFetch = !issueData?.sourceCode || !issueData?.targetCode;

  // Use the parsed info to determine source and target locations for fetching
  const sourceFilePath = issueData?.sourceLocation?.filePath || issueInfo?.filePath || "";
  const sourceLine = issueData?.sourceLocation?.startLine || issueInfo?.line || 0;
  const targetFilePath = issueData?.targetLocation?.filePath || parsedMessage?.targetFilePath || "";
  const targetLine = issueData?.targetLocation?.startLine || parsedMessage?.targetLine || 0;

  // Fetch source code dynamically when needed
  const sourceCodeResult = useSourceCode({
    filePath: sourceFilePath,
    line: sourceLine,
    contextAbove: 15,  // Fetch more context to capture the full function/component
    contextBelow: 15,
    enabled: needsDynamicFetch && !!sourceFilePath && sourceLine > 0,
  });

  // Fetch target code dynamically when needed
  const targetCodeResult = useSourceCode({
    filePath: targetFilePath,
    line: targetLine,
    contextAbove: 15,
    contextBelow: 15,
    enabled: needsDynamicFetch && !!targetFilePath && targetLine > 0,
  });

  // Determine the actual code to display
  const displaySourceCode = issueData?.sourceCode ||
    (sourceCodeResult.context?.lines.join("\n") || "");
  const displayTargetCode = issueData?.targetCode ||
    (targetCodeResult.context?.lines.join("\n") || "");

  // Compute diff highlights between source and target
  const { sourceLines, targetLines, computed: diffComputed } = useDiffHighlights(
    displaySourceCode,
    displayTargetCode
  );

  // Build dataLoc strings from locations
  const getDataLoc = useCallback((loc: LocationData | undefined): string | null => {
    if (!loc) return null;
    // Format: "path:line:column" - matching the data-loc attribute format
    return `${loc.filePath}:${loc.startLine}:${loc.startColumn ?? 0}`;
  }, []);

  // Build effective locations for display
  const effectiveSourceLocation: LocationData | undefined = issueData?.sourceLocation ||
    (sourceFilePath && sourceLine ? {
      filePath: sourceFilePath,
      startLine: sourceCodeResult.context?.startLine || sourceLine,
      endLine: sourceLine,
      startColumn: 0,
      endColumn: 0,
    } : undefined);

  const effectiveTargetLocation: LocationData | undefined = issueData?.targetLocation ||
    (targetFilePath && targetLine ? {
      filePath: targetFilePath,
      startLine: targetCodeResult.context?.startLine || targetLine,
      endLine: targetLine,
      startColumn: 0,
      endColumn: 0,
    } : undefined);

  const sourceDataLoc = getDataLoc(effectiveSourceLocation);
  const targetDataLoc = getDataLoc(effectiveTargetLocation);

  // Clear heatmap filter when panel unmounts
  useEffect(() => {
    return () => {
      clearHeatmapFilter();
    };
  }, [clearHeatmapFilter]);

  // Handle missing data - show message only if we really can't get any info
  if (!issueData && !issueInfo) {
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

  // Show loading state while fetching code
  const isLoading = needsDynamicFetch && (sourceCodeResult.isLoading || targetCodeResult.isLoading);
  if (isLoading) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--uilint-text-muted)",
          fontSize: 13,
        }}
      >
        <div style={{ marginBottom: 8 }}>Loading code comparison...</div>
        <div style={{ fontSize: 11, opacity: 0.8 }}>
          Fetching source files...
        </div>
      </div>
    );
  }

  // Handle case where we couldn't fetch the code
  if (needsDynamicFetch && !displaySourceCode && !displayTargetCode) {
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
          {parsedMessage
            ? `Similar to '${parsedMessage.targetName}' at ${parsedMessage.targetFilePath}:${parsedMessage.targetLine}`
            : "Could not fetch source code from server."}
        </div>
      </div>
    );
  }

  // Use parsed or provided similarity
  const similarity = issueData?.similarity ?? parsedMessage?.similarity ?? 0;
  const sourceLocation = effectiveSourceLocation;
  const targetLocation = effectiveTargetLocation;

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
      devLog("[DuplicatesInspectorPanel] Navigate to source", sourceLocation);
      // Could integrate with IDE via existing navigation mechanism
    }
  };

  const handleNavigateToTarget = () => {
    if (targetLocation) {
      devLog("[DuplicatesInspectorPanel] Navigate to target", targetLocation);
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
      {sourceLocation && displaySourceCode && (
        <ScrollableCodeSection
          label="This Code"
          icon={<SourceIcon />}
          filePath={sourceLocation.filePath}
          code={displaySourceCode}
          startLine={sourceLocation.startLine}
          endLine={sourceLocation.endLine}
          focusLine={sourceLocation.startLine}
          diffLines={diffComputed ? sourceLines : undefined}
          onNavigate={handleNavigateToSource}
          maxHeight={250}
        />
      )}

      {/* Target/similar code section */}
      {targetLocation && displayTargetCode && (
        <ScrollableCodeSection
          label="Similar Code"
          icon={<TargetIcon />}
          filePath={targetLocation.filePath}
          code={displayTargetCode}
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
