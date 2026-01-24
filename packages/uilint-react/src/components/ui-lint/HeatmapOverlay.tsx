"use client";

/**
 * HeatmapOverlay - Shows colored overlays on elements based on issue density
 *
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

        // Only show elements that have issues
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

  // Get inspector actions from store
  const openInspector = useUILintStore((s: UILintStore) => s.openInspector);

  const handleClick = useCallback(
    (element: ScannedElement) => {
      // Open inspector for element details
      openInspector("element", { elementId: element.id });
    },
    [openInspector]
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
 * Generate gradient border colors for bottom-left to top-right effect.
 * Returns [transparentColor, opaqueColor] for use in CSS gradient.
 */
function getGradientBorderColors(opacity: number): [string, string] {
  const transparentColor = getHeatmapBorderColor(opacity * 0.2);
  const opaqueColor = getHeatmapBorderColor(opacity);
  return [transparentColor, opaqueColor];
}

/** Size of the clickable corner circle indicator */
const CORNER_CIRCLE_SIZE = 12;

function HeatmapRect({
  item,
  isHovered,
  onHover,
  onLeave,
  onClick,
}: HeatmapRectProps) {
  const { rect, issueCount, opacity } = item;

  const dotColor = getHeatmapBorderColor(opacity);

  const borderWidth = getBorderWidth(opacity, isHovered);
  const displayOpacity = isHovered ? Math.min(opacity + 0.15, 0.7) : opacity;
  const [transparentColor, opaqueColor] = getGradientBorderColors(displayOpacity);

  // Outer dimensions including border
  const outerWidth = rect.width + borderWidth * 2;
  const outerHeight = rect.height + borderWidth * 2;

  // Build tooltip text
  const tooltipText = `${issueCount} issue${issueCount !== 1 ? "s" : ""}`;

  return (
    <>
      {/* Gradient border overlay */}
      <div
        data-ui-lint
        style={{
          position: "fixed",
          top: rect.top - borderWidth,
          left: rect.left - borderWidth,
          width: outerWidth,
          height: outerHeight,
          background: `linear-gradient(135deg, ${transparentColor} 0%, ${opaqueColor} 100%)`,
          borderRadius: "6px",
          pointerEvents: "none",
          transition: "opacity 150ms",
          zIndex: isHovered ? 99998 : 99995,
          // Create border frame using clip-path (outer rect minus inner rect)
          clipPath: `polygon(
            evenodd,
            0 0, ${outerWidth}px 0, ${outerWidth}px ${outerHeight}px, 0 ${outerHeight}px, 0 0,
            ${borderWidth}px ${borderWidth}px, ${borderWidth}px ${outerHeight - borderWidth}px, ${outerWidth - borderWidth}px ${outerHeight - borderWidth}px, ${outerWidth - borderWidth}px ${borderWidth}px, ${borderWidth}px ${borderWidth}px
          )`,
        }}
      />

      {/* Clickable corner dot at top-right */}
      <div
        data-ui-lint
        style={{
          position: "fixed",
          top: rect.top - CORNER_CIRCLE_SIZE / 2,
          left: rect.left + rect.width - CORNER_CIRCLE_SIZE / 2,
          width: CORNER_CIRCLE_SIZE,
          height: CORNER_CIRCLE_SIZE,
          backgroundColor: dotColor,
          borderRadius: "50%",
          pointerEvents: "auto",
          cursor: "pointer",
          zIndex: 99999,
          transition: "transform 150ms, background-color 150ms",
          transform: isHovered ? "scale(1.1)" : "scale(1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: STYLES.font,
        }}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title={tooltipText}
      />

      {/* Tooltip on hover */}
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
          {tooltipText}
        </div>
      )}
    </>
  );
}
