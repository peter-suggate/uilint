"use client";

/**
 * CoverageHeatmapOverlay - Shows colored overlays on elements based on test coverage
 *
 * Uses color to represent coverage percentage:
 * - Green: High coverage (80-100%)
 * - Yellow: Medium coverage (40-80%)
 * - Red: Low coverage (0-40%)
 *
 * Only visible when:
 * - Alt/Option key is held down, OR
 * - Command palette is open AND require-test-coverage rule is visible
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
import { cn } from "@/lib/utils";
import { Icons } from "./command-palette/icons";

const COVERAGE_RULE_ID = "require-test-coverage";

interface CoverageElement {
  element: ScannedElement;
  rect: DOMRect;
  coverage: number; // 0-100
}

export function CoverageHeatmapOverlay() {
  const autoScanState = useUILintStore((s: UILintStore) => s.autoScanState);
  const coverageData = useUILintStore((s: UILintStore) => s.coverageData);
  const commandPaletteOpen = useUILintStore(
    (s: UILintStore) => s.commandPaletteOpen
  );
  const coverageStatus = useUILintStore((s: UILintStore) => s.coverageStatus);
  const requestCoverage = useUILintStore((s: UILintStore) => s.requestCoverage);
  const openCommandPaletteWithFilter = useUILintStore(
    (s: UILintStore) => s.openCommandPaletteWithFilter
  );
  const visibleCommandPaletteResultIds = useUILintStore(
    (s: UILintStore) => s.visibleCommandPaletteResultIds
  );

  // Track Alt/Option key state
  const [altKeyDown, setAltKeyDown] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) setAltKeyDown(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) setAltKeyDown(false);
    };
    // Also reset on blur (in case user releases Alt while window is not focused)
    const handleBlur = () => setAltKeyDown(false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Check if require-test-coverage rule is visible in command palette results
  const coverageRuleVisible = visibleCommandPaletteResultIds.has(COVERAGE_RULE_ID);

  // Show heatmap when:
  // 1. Alt/Option key is held down, OR
  // 2. Command palette is open AND require-test-coverage rule is visible
  const shouldShow =
    altKeyDown ||
    (commandPaletteOpen && coverageRuleVisible);

  // Request coverage data when conditions are met (if not already loaded)
  useEffect(() => {
    if (shouldShow && coverageStatus === "idle") {
      requestCoverage();
    }
  }, [shouldShow, coverageStatus, requestCoverage]);

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

  // Handle click on coverage element - open command palette with coverage filter
  const handleClick = useCallback(
    (element: ScannedElement, coverage: number) => {
      const { fileName, lineNumber, columnNumber } = element.source;
      const displayName = fileName.split("/").pop() || fileName;
      const label = `${displayName}:${lineNumber}${columnNumber ? `:${columnNumber}` : ""} (${Math.round(coverage)}%)`;
      const locValue = `${fileName}:${lineNumber}${columnNumber ? `:${columnNumber}` : ""}`;

      openCommandPaletteWithFilter({
        type: "coverage",
        value: locValue,
        label,
      });
    },
    [openCommandPaletteWithFilter]
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
          onClick={() => handleClick(item.element, item.coverage)}
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
  onClick: () => void;
}

/** Constant background opacity for all coverage overlays */
const BACKGROUND_OPACITY = 0.15;

function CoverageRect({ item, isHovered, onHover, onLeave, onClick }: CoverageRectProps) {
  const { rect, coverage } = item;
  const color = getCoverageColor(coverage);
  const displayOpacity = isHovered ? BACKGROUND_OPACITY + 0.1 : BACKGROUND_OPACITY;

  // Handle mouse leave with a small delay to allow moving to the button
  const handleMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      // Check if we're moving to the button (which has data-ui-lint-button)
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (relatedTarget?.closest("[data-ui-lint-button]")) {
        return; // Don't leave hover state when moving to button
      }
      onLeave();
    },
    [onLeave]
  );

  return (
    <>
      {/* Transparent background overlay (visual only) */}
      <div
        data-ui-lint
        className={cn(
          "fixed rounded pointer-events-none transition-colors duration-150",
          isHovered ? "z-[99997]" : "z-[99994]"
        )}
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          backgroundColor: color.replace(")", ` / ${displayOpacity})`),
        }}
      />

      {/* Border-frame hover detection layer - doesn't block clicks in center */}
      <div
        data-ui-lint
        className="fixed z-[99993] pointer-events-auto cursor-default"
        style={{
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
          // Clip-path creates a frame shape - only border area triggers events
          clipPath: `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
            8px 8px, 8px calc(100% - 8px), calc(100% - 8px) calc(100% - 8px), calc(100% - 8px) 8px, 8px 8px
          )`,
        }}
        onMouseEnter={onHover}
        onMouseLeave={handleMouseLeave}
      />

      {/* Combined coverage % + View button - only shown on hover */}
      {isHovered && (
        <button
          data-ui-lint
          data-ui-lint-button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
          className={cn(
            "fixed z-[99999] pointer-events-auto",
            "flex items-center gap-1.5",
            "px-2.5 py-1",
            "bg-backdrop border border-border rounded-md",
            "text-[11px] font-medium text-foreground",
            "shadow-md",
            "cursor-pointer",
            "transition-all duration-100",
            "hover:shadow-lg hover:scale-[1.02]"
          )}
          style={{
            top: rect.top + 4,
            right: window.innerWidth - rect.right + 4,
          }}
        >
          <span className="font-semibold">{Math.round(coverage)}%</span>
          <span className="opacity-50">·</span>
          <span className="flex items-center gap-0.5">
            <Icons.Code className="w-3 h-3" />
            View
          </span>
        </button>
      )}
    </>
  );
}
