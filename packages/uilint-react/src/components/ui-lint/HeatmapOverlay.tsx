"use client";

/**
 * HeatmapOverlay - Shows colored overlays on elements based on issue density
 *
 * Alternative visualization mode to ElementBadges.
 * Uses color intensity to represent issue count.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintStore, type UILintStore } from "./store";
import type { ScannedElement } from "./types";
import { getUILintPortalHost } from "./portal-host";
import {
  getElementVisibleRect,
  isElementCoveredByOverlay,
} from "./visibility-utils";
import {
  calculateHeatmapOpacity,
  getHeatmapColor,
  getHeatmapBorderColor,
} from "./heatmap-colors";

/**
 * Design tokens - uses CSS variables for theme support
 */
const STYLES = {
  bg: "var(--uilint-backdrop)",
  text: "var(--uilint-text-primary)",
  border: "var(--uilint-border)",
  shadow: "var(--uilint-shadow)",
  font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

interface HeatmapElement {
  element: ScannedElement;
  rect: DOMRect;
  issueCount: number;
  opacity: number;
}

export function HeatmapOverlay() {
  const autoScanState = useUILintStore((s: UILintStore) => s.autoScanState);
  const mergedIssueCounts = useUILintStore(
    (s: UILintStore) => s.mergedIssueCounts
  );
  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );
  const setInspectedElement = useUILintStore(
    (s: UILintStore) => s.setInspectedElement
  );

  const [mounted, setMounted] = useState(false);
  const [heatmapElements, setHeatmapElements] = useState<HeatmapElement[]>([]);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

  // File filtering state
  const hoveredFilePath = useUILintStore((s: UILintStore) => s.hoveredFilePath);
  const selectedFilePath = useUILintStore(
    (s: UILintStore) => s.selectedFilePath
  );

  // Command palette state - heatmaps show when command palette is open
  const commandPaletteOpen = useUILintStore(
    (s: UILintStore) => s.commandPaletteOpen
  );
  const visibleCommandPaletteResultIds = useUILintStore(
    (s: UILintStore) => s.visibleCommandPaletteResultIds
  );

  // Alt key state - when held, show all heatmap items for selection
  const altKeyHeld = useUILintStore((s: UILintStore) => s.altKeyHeld);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate heatmap positions and colors
  useEffect(() => {
    if (autoScanState.status === "idle") {
      setHeatmapElements([]);
      return;
    }

    const updatePositions = () => {
      const elements: HeatmapElement[] = [];

      // Find max issue count for normalization
      let maxIssues = 0;
      for (const count of mergedIssueCounts.values()) {
        if (count > maxIssues) maxIssues = count;
      }

      for (const element of autoScanState.elements) {
        if (!element.element || !document.contains(element.element)) continue;

        const issueCount = mergedIssueCounts.get(element.id) ?? 0;

        // Skip elements with no issues in heatmap mode
        if (issueCount === 0) continue;

        const visible = getElementVisibleRect(element.element);
        if (!visible) continue;

        // Check if covered by overlay
        const testX = visible.left + Math.min(8, visible.width / 2);
        const testY = visible.top + Math.min(8, visible.height / 2);
        if (isElementCoveredByOverlay(element.element, testX, testY)) continue;

        const opacity = calculateHeatmapOpacity(issueCount, maxIssues);

        elements.push({
          element,
          rect: DOMRect.fromRect({
            x: visible.left,
            y: visible.top,
            width: visible.width,
            height: visible.height,
          }),
          issueCount,
          opacity,
        });
      }

      setHeatmapElements(elements);
    };

    let rafId: number | null = null;
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updatePositions();
      });
    };

    scheduleUpdate();

    const handleScroll = () => scheduleUpdate();
    const handleResize = () => scheduleUpdate();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") scheduleUpdate();
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [autoScanState.status, autoScanState.elements, mergedIssueCounts]);

  // Filter elements based on command palette visible results
  const visibleElements = useMemo(() => {
    // If alt key is held, show ALL heatmap elements for selection
    if (altKeyHeld) return heatmapElements;

    // If command palette is not open, show nothing
    if (!commandPaletteOpen) return [];

    // If no visible results, show nothing
    if (visibleCommandPaletteResultIds.size === 0) return [];

    // Filter by file path (existing behavior)
    let filteredElements = heatmapElements;
    const activeFilePath = selectedFilePath || hoveredFilePath;
    if (activeFilePath) {
      filteredElements = filteredElements.filter(
        (el) => el.element.source.fileName === activeFilePath
      );
    }

    // Filter to elements that match visible command palette results
    // Visible result IDs include: rule:X, file:X, issue:X, capture:X
    // We need to match elements that have issues from visible rules/files/issues
    return filteredElements.filter((el) => {
      const cached = elementIssuesCache.get(el.element.id);
      if (!cached) return false;

      // Check each visible result ID to see if this element matches
      for (const resultId of visibleCommandPaletteResultIds) {
        // Match rule results - show elements with issues from this rule
        if (resultId.startsWith("rule:")) {
          const ruleId = resultId.replace("rule:", "");
          const fullRuleId = `uilint/${ruleId}`;
          if (cached.issues.some((issue) => issue.ruleId === fullRuleId)) {
            return true;
          }
        }

        // Match file results - show elements from this file
        if (resultId.startsWith("file:")) {
          const filePath = resultId.replace("file:", "");
          if (el.element.source.fileName === filePath) {
            return true;
          }
        }

        // Match issue results - show element that has this specific issue
        if (resultId.startsWith("issue:")) {
          const parts = resultId.split(":");

          if (parts[1] === "file") {
            // File-level issue - show all elements in that file
            const filePath = parts[2];
            if (el.element.source.fileName === filePath) {
              return true;
            }
          } else {
            // Element-level issue - extract elementId
            const elementIdParts = [];
            let i = 1;
            while (i < parts.length && !parts[i].startsWith("uilint")) {
              elementIdParts.push(parts[i]);
              i++;
            }
            const targetElementId = elementIdParts.join(":");
            if (el.element.id === targetElementId || el.element.id.startsWith(targetElementId)) {
              return true;
            }
          }
        }
      }

      return false;
    });
  }, [
    heatmapElements,
    commandPaletteOpen,
    visibleCommandPaletteResultIds,
    altKeyHeld,
    selectedFilePath,
    hoveredFilePath,
    elementIssuesCache,
  ]);

  // Get openCommandPaletteWithFilter from store
  const openCommandPaletteWithFilter = useUILintStore(
    (s: UILintStore) => s.openCommandPaletteWithFilter
  );

  const handleClick = useCallback(
    (element: ScannedElement) => {
      // Open command palette with loc filter
      const displayName = element.source.fileName.split("/").pop() || element.source.fileName;
      const { fileName, lineNumber, columnNumber } = element.source;
      const label = `${displayName}:${lineNumber}${columnNumber ? `:${columnNumber}` : ""}`;
      const locValue = `${fileName}:${lineNumber}${columnNumber ? `:${columnNumber}` : ""}`;

      openCommandPaletteWithFilter({
        type: "loc",
        value: locValue,
        label,
      });
    },
    [openCommandPaletteWithFilter]
  );

  // Event handlers to prevent UILint interactions from propagating to the app
  const handleUILintInteraction = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent | React.PointerEvent) => {
      e.stopPropagation();
    },
    []
  );

  if (!mounted) return null;
  if (autoScanState.status === "idle") return null;

  const content = (
    <div
      data-ui-lint
      onMouseDown={handleUILintInteraction}
      onPointerDown={handleUILintInteraction}
      onClick={handleUILintInteraction}
      onKeyDown={handleUILintInteraction}
      style={{ pointerEvents: "none" }}
    >
      {visibleElements.map((item) => (
        <HeatmapRect
          key={item.element.id}
          item={item}
          isHovered={hoveredElementId === item.element.id}
          onHover={() => setHoveredElementId(item.element.id)}
          onLeave={() => setHoveredElementId(null)}
          onClick={() => handleClick(item.element)}
        />
      ))}
    </div>
  );

  return createPortal(content, getUILintPortalHost());
}

interface HeatmapRectProps {
  item: HeatmapElement;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}

/**
 * Calculate border width based on opacity (more issues = thicker border)
 */
function getBorderWidth(opacity: number, isHovered: boolean): number {
  if (isHovered) return 3;
  // Scale from 1px to 3px based on opacity
  return Math.round(1 + opacity * 4);
}

/**
 * Generate inner gradient that fades quickly to transparent
 * This allows the underlying UI to remain interactive
 */
function getInnerGradient(opacity: number, isHovered: boolean): string {
  const displayOpacity = isHovered ? Math.min(opacity + 0.1, 0.5) : opacity;
  const color = getHeatmapColor(displayOpacity);
  const transparentColor = getHeatmapColor(0);

  // Gradient fades from border color to transparent within ~12px
  return `linear-gradient(to bottom, ${color} 0%, ${transparentColor} 12px),
          linear-gradient(to top, ${color} 0%, ${transparentColor} 12px),
          linear-gradient(to right, ${color} 0%, ${transparentColor} 12px),
          linear-gradient(to left, ${color} 0%, ${transparentColor} 12px)`;
}

function HeatmapRect({
  item,
  isHovered,
  onHover,
  onLeave,
  onClick,
}: HeatmapRectProps) {
  const { rect, issueCount, opacity } = item;

  const borderWidth = getBorderWidth(opacity, isHovered);
  const displayOpacity = isHovered ? Math.min(opacity + 0.15, 0.7) : opacity;

  return (
    <>
      {/* Border overlay - captures mouse events on the border only */}
      <div
        data-ui-lint
        style={{
          position: "fixed",
          top: rect.top - borderWidth,
          left: rect.left - borderWidth,
          width: rect.width + borderWidth * 2,
          height: rect.height + borderWidth * 2,
          border: `${borderWidth}px solid ${getHeatmapBorderColor(displayOpacity)}`,
          borderRadius: "6px",
          pointerEvents: "none",
          transition: "border-color 150ms, border-width 150ms",
          zIndex: isHovered ? 99998 : 99995,
          boxSizing: "border-box",
        }}
      />

      {/* Inner gradient glow - provides visual indication without blocking interaction */}
      <div
        data-ui-lint
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          background: getInnerGradient(opacity, isHovered),
          borderRadius: "4px",
          pointerEvents: "none",
          transition: "opacity 150ms",
          zIndex: isHovered ? 99997 : 99994,
        }}
      />

      {/* Invisible interaction layer on the border area only */}
      <div
        data-ui-lint
        style={{
          position: "fixed",
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
          pointerEvents: "auto",
          cursor: "pointer",
          zIndex: 99993,
          // Use clip-path to create a "frame" shape that only captures border area
          clipPath: `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
            8px 8px, 8px calc(100% - 8px), calc(100% - 8px) calc(100% - 8px), calc(100% - 8px) 8px, 8px 8px
          )`,
        }}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      />

      {/* Issue count tooltip on hover */}
      {isHovered && (
        <div
          data-ui-lint
          style={{
            position: "fixed",
            top: rect.top - 32,
            left: rect.left + rect.width / 2,
            transform: "translateX(-50%)",
            backgroundColor: STYLES.bg,
            border: `1px solid ${STYLES.border}`,
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "11px",
            fontWeight: 600,
            color: STYLES.text,
            whiteSpace: "nowrap",
            boxShadow: STYLES.shadow,
            fontFamily: STYLES.font,
            zIndex: 99999,
            pointerEvents: "none",
          }}
        >
          {issueCount} issue{issueCount !== 1 ? "s" : ""}
        </div>
      )}
    </>
  );
}
