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
import type { ScannedElement, InspectedElement } from "./types";
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

  // Command palette selection state - heatmaps only show when an item is selected
  const selectedCommandPaletteItemId = useUILintStore(
    (s: UILintStore) => s.selectedCommandPaletteItemId
  );
  const hoveredCommandPaletteItemId = useUILintStore(
    (s: UILintStore) => s.hoveredCommandPaletteItemId
  );

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

  // Determine which item to highlight (selected takes precedence over hovered)
  const activeItemId = selectedCommandPaletteItemId || hoveredCommandPaletteItemId;

  // Filter elements based on active command palette selection
  const visibleElements = useMemo(() => {
    // If no item is active (selected or hovered), show nothing
    if (!activeItemId) return [];

    let filteredElements = heatmapElements;

    // Filter by file path (existing behavior)
    const activeFilePath = selectedFilePath || hoveredFilePath;
    if (activeFilePath) {
      filteredElements = filteredElements.filter(
        (el) => el.element.source.fileName === activeFilePath
      );
    }

    // Filter by rule if a rule is selected in the command palette
    if (activeItemId.startsWith("rule:")) {
      const ruleId = activeItemId.replace("rule:", "");
      filteredElements = filteredElements.filter((el) => {
        const cached = elementIssuesCache.get(el.element.id);
        if (!cached) return false;
        // Check if this element has any issues from the selected rule
        return cached.issues.some((issue) => issue.ruleId === ruleId);
      });
    }

    // Filter by file if a file is selected in the command palette
    if (activeItemId.startsWith("file:")) {
      const filePath = activeItemId.replace("file:", "");
      filteredElements = filteredElements.filter(
        (el) => el.element.source.fileName === filePath
      );
    }

    // Filter by specific issue if an issue is selected
    // Issue ID format: issue:${elementId}:${ruleId}:${line}:${column} or issue:file:${filePath}:${ruleId}:${line}:${column}
    if (activeItemId.startsWith("issue:")) {
      const parts = activeItemId.split(":");

      if (parts[1] === "file") {
        // File-level issue: issue:file:${filePath}:${ruleId}:${line}:${column}
        // These don't map to specific elements, so show all elements in that file
        const filePath = parts[2];
        filteredElements = filteredElements.filter(
          (el) => el.element.source.fileName === filePath
        );
      } else {
        // Element-level issue: issue:${elementId}:${ruleId}:${line}:${column}
        // The elementId is at parts[1], which is like "loc:path:line:column#occurrence"
        // We need to reconstruct it carefully since it contains colons
        const elementIdParts = [];
        let i = 1;
        // The elementId starts with "loc:" and ends before the ruleId (which starts with "uilint/")
        while (i < parts.length && !parts[i].startsWith("uilint")) {
          elementIdParts.push(parts[i]);
          i++;
        }
        const targetElementId = elementIdParts.join(":");

        // Show only the specific element this issue belongs to
        filteredElements = filteredElements.filter(
          (el) => el.element.id === targetElementId || el.element.id.startsWith(targetElementId)
        );
      }
    }

    return filteredElements;
  }, [
    heatmapElements,
    activeItemId,
    selectedFilePath,
    hoveredFilePath,
    elementIssuesCache,
  ]);

  const handleClick = useCallback(
    (element: ScannedElement) => {
      const inspected: InspectedElement = {
        element: element.element,
        source: element.source,
        rect: element.element.getBoundingClientRect(),
        scannedElementId: element.id,
      };
      setInspectedElement(inspected);
    },
    [setInspectedElement]
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
