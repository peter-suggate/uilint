"use client";

/**
 * HeatmapOverlay - Shows colored overlays on elements based on issue density
 *
 * Uses color intensity to represent issue count.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useUILintStore, type UILintStore } from "./store";
import type { ScannedElement } from "./types";
import { getDataLocFromSource } from "./types";
import { getUILintPortalHost } from "./portal-host";
import {
  getElementVisibleRect,
  isElementCoveredByOverlay,
} from "./visibility-utils";
import {
  calculateHeatmapOpacity,
  getHeatmapBorderColor,
} from "./heatmap-colors";

/** Debounce time in ms after scroll/movement stops before fading back in */
const MOVEMENT_DEBOUNCE_MS = 150;

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

  const [mounted, setMounted] = useState(false);
  const [heatmapElements, setHeatmapElements] = useState<HeatmapElement[]>([]);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Refs for scroll/movement detection
  const scrollTimeoutRef = useRef<number | null>(null);
  const lastPositionsRef = useRef<Map<string, { top: number; left: number }>>(new Map());

  // Alt key state - overlay only shows when alt is held (with exceptions)
  const altKeyHeld = useUILintStore((s: UILintStore) => s.altKeyHeld);

  // Inspector state - positions need to update when sidebar opens/closes/resizes
  const inspectorOpen = useUILintStore((s: UILintStore) => s.inspectorOpen);
  const inspectorDocked = useUILintStore((s: UILintStore) => s.inspectorDocked);
  const inspectorWidth = useUILintStore((s: UILintStore) => s.inspectorWidth);

  // Inspector mode state - for determining which elements to show when alt is not held
  const inspectorMode = useUILintStore((s: UILintStore) => s.inspectorMode);
  const inspectorElementId = useUILintStore((s: UILintStore) => s.inspectorElementId);
  const inspectorRuleId = useUILintStore((s: UILintStore) => s.inspectorRuleId);
  const elementIssuesCache = useUILintStore((s: UILintStore) => s.elementIssuesCache);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper to determine if an element should be visible
  const shouldShowElement = useCallback(
    (element: ScannedElement): boolean => {
      // Always show if alt is held
      if (altKeyHeld) return true;

      // Show if this specific element is being inspected
      if (inspectorOpen && inspectorMode === "element" && inspectorElementId === element.id) {
        return true;
      }

      // Show if a rule is being inspected and this element has issues from that rule
      if (inspectorOpen && inspectorMode === "rule" && inspectorRuleId) {
        const dataLoc = getDataLocFromSource(element.source);
        const elementData = elementIssuesCache.get(dataLoc);
        if (elementData) {
          const fullRuleId = `uilint/${inspectorRuleId}`;
          const hasRuleIssue = elementData.issues.some(
            (issue) => issue.ruleId === fullRuleId || issue.ruleId === inspectorRuleId
          );
          if (hasRuleIssue) return true;
        }
      }

      return false;
    },
    [altKeyHeld, inspectorOpen, inspectorMode, inspectorElementId, inspectorRuleId, elementIssuesCache]
  );

  // Calculate heatmap positions and colors
  useEffect(() => {
    if (autoScanState.status === "idle") {
      setHeatmapElements([]);
      return;
    }

    const updatePositions = () => {
      const elements: HeatmapElement[] = [];
      const currentPositions = new Map<string, { top: number; left: number }>();
      let hasPositionChanges = false;

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

        // Check visibility based on alt key and inspector state
        if (!shouldShowElement(element)) continue;

        const visible = getElementVisibleRect(element.element);
        if (!visible) continue;

        // Check if covered by overlay
        const testX = visible.left + Math.min(8, visible.width / 2);
        const testY = visible.top + Math.min(8, visible.height / 2);
        if (isElementCoveredByOverlay(element.element, testX, testY)) continue;

        const opacity = calculateHeatmapOpacity(issueCount, maxIssues);

        // Track position for movement detection
        const prevPos = lastPositionsRef.current.get(element.id);
        currentPositions.set(element.id, { top: visible.top, left: visible.left });

        if (prevPos) {
          const movedDistance = Math.abs(visible.top - prevPos.top) + Math.abs(visible.left - prevPos.left);
          if (movedDistance > 2) {
            hasPositionChanges = true;
          }
        }

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

      // Update position tracking
      lastPositionsRef.current = currentPositions;

      // Trigger moving state if positions changed significantly
      if (hasPositionChanges) {
        setIsMoving(true);
        // Clear existing timeout
        if (scrollTimeoutRef.current !== null) {
          clearTimeout(scrollTimeoutRef.current);
        }
        // Set timeout to clear moving state after debounce
        scrollTimeoutRef.current = window.setTimeout(() => {
          setIsMoving(false);
          scrollTimeoutRef.current = null;
        }, MOVEMENT_DEBOUNCE_MS);
      }

      setHeatmapElements(elements);
    };

    let rafId: number | null = null;
    let transitionTimeoutId: number | null = null;

    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updatePositions();
      });
    };

    scheduleUpdate();

    // Also update after CSS transition completes (sidebar uses 0.2s transition)
    transitionTimeoutId = window.setTimeout(() => {
      transitionTimeoutId = null;
      updatePositions();
    }, 250);

    const handleScroll = () => {
      // Set moving state immediately on scroll
      setIsMoving(true);

      // Clear existing timeout
      if (scrollTimeoutRef.current !== null) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set timeout to clear moving state after scroll stops
      scrollTimeoutRef.current = window.setTimeout(() => {
        setIsMoving(false);
        scrollTimeoutRef.current = null;
      }, MOVEMENT_DEBOUNCE_MS);

      scheduleUpdate();
    };

    const handleResize = () => {
      // Set moving state on resize too
      setIsMoving(true);

      if (scrollTimeoutRef.current !== null) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = window.setTimeout(() => {
        setIsMoving(false);
        scrollTimeoutRef.current = null;
      }, MOVEMENT_DEBOUNCE_MS);

      scheduleUpdate();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") scheduleUpdate();
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (transitionTimeoutId !== null) clearTimeout(transitionTimeoutId);
      if (scrollTimeoutRef.current !== null) clearTimeout(scrollTimeoutRef.current);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [autoScanState.status, autoScanState.elements, mergedIssueCounts, inspectorOpen, inspectorDocked, inspectorWidth, shouldShowElement]);

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

  // Don't render anything if no elements to show
  if (heatmapElements.length === 0) return null;

  const content = (
    <div
      data-ui-lint
      onMouseDown={handleUILintInteraction}
      onPointerDown={handleUILintInteraction}
      onClick={handleUILintInteraction}
      onKeyDown={handleUILintInteraction}
      style={{
        pointerEvents: "none",
      }}
    >
      {heatmapElements.map((item) => (
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

/** Size of the clickable corner plus icon indicator */
const PLUS_SIZE = 14;
const PLUS_SIZE_HOVER = 22;
const PLUS_THICKNESS = 2;
const PLUS_THICKNESS_HOVER = 3;
/** Inset distance from corner for plus icon */
const PLUS_INSET = 4;

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
          borderRadius: 0,
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

      {/* Clickable corner plus icon at top-right (inset) */}
      <div
        data-ui-lint
        style={{
          position: "fixed",
          top: rect.top + PLUS_INSET,
          left: rect.left + rect.width - (isHovered ? PLUS_SIZE_HOVER : PLUS_SIZE) - PLUS_INSET,
          width: isHovered ? PLUS_SIZE_HOVER : PLUS_SIZE,
          height: isHovered ? PLUS_SIZE_HOVER : PLUS_SIZE,
          backgroundColor: dotColor,
          border: `${isHovered ? PLUS_THICKNESS_HOVER : PLUS_THICKNESS}px solid ${dotColor}`,
          borderRadius: isHovered ? 4 : 3,
          pointerEvents: "auto",
          cursor: "pointer",
          zIndex: 99999,
          // Only transition visual properties, not position (top/left)
          transition: "width 150ms ease-out, height 150ms ease-out, background-color 150ms ease-out, border 150ms ease-out, border-radius 150ms ease-out, box-shadow 150ms ease-out",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isHovered
            ? `0 2px 8px ${dotColor}66`
            : `0 0 4px ${dotColor}4D`,
        }}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title={tooltipText}
      >
        {/* Horizontal arm of plus */}
        <div
          style={{
            position: "absolute",
            width: isHovered ? 10 : 6,
            height: isHovered ? PLUS_THICKNESS_HOVER : PLUS_THICKNESS,
            backgroundColor: isHovered ? "white" : dotColor,
            borderRadius: 1,
            transition: "width 150ms ease-out, height 150ms ease-out, background-color 150ms ease-out",
          }}
        />
        {/* Vertical arm of plus */}
        <div
          style={{
            position: "absolute",
            width: isHovered ? PLUS_THICKNESS_HOVER : PLUS_THICKNESS,
            height: isHovered ? 10 : 6,
            backgroundColor: isHovered ? "white" : dotColor,
            borderRadius: 1,
            transition: "width 150ms ease-out, height 150ms ease-out, background-color 150ms ease-out",
          }}
        />
      </div>

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
