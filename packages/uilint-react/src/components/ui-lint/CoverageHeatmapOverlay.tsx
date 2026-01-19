"use client";

/**
 * CoverageHeatmapOverlay - Shows colored overlays on elements based on test coverage
 *
 * Uses color to represent coverage percentage:
 * - Green: High coverage (80-100%)
 * - Yellow: Medium coverage (40-80%)
 * - Red: Low coverage (0-40%)
 *
 * Lower coverage = more visible overlay (inverse of issue heatmap)
 */

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintStore, type UILintStore } from "./store";
import type { ScannedElement } from "./types";
import { getUILintPortalHost } from "./portal-host";
import {
  getElementVisibleRect,
  isElementCoveredByOverlay,
} from "./visibility-utils";
import { getCoverageColor } from "./coverage-colors";

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

interface CoverageElement {
  element: ScannedElement;
  rect: DOMRect;
  coverage: number; // 0-100
}

export function CoverageHeatmapOverlay() {
  const autoScanState = useUILintStore((s: UILintStore) => s.autoScanState);
  const coverageData = useUILintStore((s: UILintStore) => s.coverageData);
  const showCoverageHeatmap = useUILintStore(
    (s: UILintStore) => s.showCoverageHeatmap
  );
  const commandPaletteOpen = useUILintStore(
    (s: UILintStore) => s.commandPaletteOpen
  );
  const coverageStatus = useUILintStore((s: UILintStore) => s.coverageStatus);
  const requestCoverage = useUILintStore((s: UILintStore) => s.requestCoverage);

  // Show heatmap when command palette is open OR when explicitly enabled
  const shouldShow = commandPaletteOpen || showCoverageHeatmap;

  // Request coverage data when command palette opens (if not already loaded)
  useEffect(() => {
    if (commandPaletteOpen && coverageStatus === "idle") {
      requestCoverage();
    }
  }, [commandPaletteOpen, coverageStatus, requestCoverage]);

  const [mounted, setMounted] = useState(false);
  const [coverageElements, setCoverageElements] = useState<CoverageElement[]>(
    []
  );
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate coverage overlay positions and colors
  useEffect(() => {
    if (!shouldShow || coverageStatus !== "ready") {
      setCoverageElements([]);
      return;
    }

    if (autoScanState.status === "idle") {
      setCoverageElements([]);
      return;
    }

    const updatePositions = () => {
      const elements: CoverageElement[] = [];

      for (const element of autoScanState.elements) {
        if (!element.element || !document.contains(element.element)) continue;

        // Get coverage for this element's file
        // Coverage keys may be absolute paths or /src/... paths
        const filePath = element.source.fileName;
        let coverage: number | undefined;

        // Try to match the file path in coverage data
        for (const [coveragePath, pct] of coverageData.entries()) {
          if (
            coveragePath.endsWith(filePath) ||
            filePath.endsWith(coveragePath.replace(/^\//, ""))
          ) {
            coverage = pct;
            break;
          }
        }

        // If no coverage data found, skip this element
        if (coverage === undefined) continue;

        const visible = getElementVisibleRect(element.element);
        if (!visible) continue;

        // Check if covered by overlay
        const testX = visible.left + Math.min(8, visible.width / 2);
        const testY = visible.top + Math.min(8, visible.height / 2);
        if (isElementCoveredByOverlay(element.element, testX, testY)) continue;

        elements.push({
          element,
          rect: DOMRect.fromRect({
            x: visible.left,
            y: visible.top,
            width: visible.width,
            height: visible.height,
          }),
          coverage,
        });
      }

      setCoverageElements(elements);
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
  }, [
    shouldShow,
    coverageStatus,
    autoScanState.status,
    autoScanState.elements,
    coverageData,
  ]);

  // Event handlers to prevent UILint interactions from propagating to the app
  const handleUILintInteraction = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent | React.PointerEvent) => {
      e.stopPropagation();
    },
    []
  );

  if (!mounted) return null;
  if (!shouldShow) return null;
  if (coverageStatus !== "ready") return null;
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
      {coverageElements.map((item) => (
        <CoverageRect
          key={item.element.id}
          item={item}
          isHovered={hoveredElementId === item.element.id}
          onHover={() => setHoveredElementId(item.element.id)}
          onLeave={() => setHoveredElementId(null)}
        />
      ))}
    </div>
  );

  return createPortal(content, getUILintPortalHost());
}

interface CoverageRectProps {
  item: CoverageElement;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}

/** Constant background opacity for all coverage overlays */
const BACKGROUND_OPACITY = 0.15;

function CoverageRect({ item, isHovered, onHover, onLeave }: CoverageRectProps) {
  const { rect, coverage } = item;
  const color = getCoverageColor(coverage);
  const displayOpacity = isHovered ? BACKGROUND_OPACITY + 0.1 : BACKGROUND_OPACITY;

  return (
    <>
      {/* Transparent background overlay */}
      <div
        data-ui-lint
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          backgroundColor: color.replace(")", ` / ${displayOpacity})`),
          borderRadius: "4px",
          pointerEvents: "none",
          transition: "background-color 150ms",
          zIndex: isHovered ? 99997 : 99994,
        }}
      />

      {/* Invisible interaction layer */}
      <div
        data-ui-lint
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          pointerEvents: "auto",
          cursor: "default",
          zIndex: 99993,
        }}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
      />

      {/* Coverage tooltip on hover */}
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
          {Math.round(coverage)}% coverage
        </div>
      )}
    </>
  );
}
