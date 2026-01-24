"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Violation } from "./types";
import { getElementBySnapshotId } from "./snapshot";
import { getUILintPortalHost } from "../components/ui-lint/portal-host";

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ElementHighlight {
  id: string;
  rect: HighlightRect;
  badgeNumber?: number;
}

interface ConsistencyHighlighterProps {
  violations: Violation[];
  selectedViolation: Violation | null;
  lockedViolation: Violation | null;
}

const HIGHLIGHT_COLOR = "#3b82f6"; // Blue
const PLUS_SIZE = 14; // Size of plus icon
const PLUS_SIZE_HOVER = 22; // Expanded size on hover
const PLUS_THICKNESS = 2; // Thickness of plus arms
const PLUS_THICKNESS_HOVER = 3; // Thickness when hovered
const BORDER_WIDTH = 2;

/**
 * Calculates highlight rects for a set of element IDs
 */
function calculateHighlights(
  elementIds: string[],
  withBadges: boolean = false
): ElementHighlight[] {
  const highlights: ElementHighlight[] = [];

  elementIds.forEach((id, index) => {
    const el = getElementBySnapshotId(id);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    highlights.push({
      id,
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
      badgeNumber: withBadges && elementIds.length > 1 ? index + 1 : undefined,
    });
  });

  return highlights;
}

/**
 * Gets all unique element IDs from violations
 */
function getAllViolatingIds(violations: Violation[]): Set<string> {
  const ids = new Set<string>();
  violations.forEach((v) => {
    v.elementIds.forEach((id) => ids.add(id));
  });
  return ids;
}

/**
 * Overview plus icon component - indicator for violating elements
 * Expands and fills in on hover for better clickability
 */
function OverviewPlusIcon({ rect }: { rect: HighlightRect }) {
  const [isHovered, setIsHovered] = useState(false);

  const size = isHovered ? PLUS_SIZE_HOVER : PLUS_SIZE;
  const thickness = isHovered ? PLUS_THICKNESS_HOVER : PLUS_THICKNESS;
  const armLength = isHovered ? 10 : 6;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "fixed",
        top: rect.top - size / 2,
        left: rect.left + rect.width - size / 2,
        width: size,
        height: size,
        borderRadius: isHovered ? 4 : 3,
        backgroundColor: isHovered
          ? HIGHLIGHT_COLOR
          : "rgba(59, 130, 246, 0.15)",
        border: `${thickness}px solid ${HIGHLIGHT_COLOR}`,
        pointerEvents: "auto",
        cursor: "pointer",
        zIndex: 99997,
        boxShadow: isHovered
          ? "0 2px 8px rgba(59, 130, 246, 0.4)"
          : "0 0 4px rgba(59, 130, 246, 0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s ease-out",
      }}
    >
      {/* Horizontal arm of plus */}
      <div
        style={{
          position: "absolute",
          width: armLength,
          height: thickness,
          backgroundColor: isHovered ? "white" : HIGHLIGHT_COLOR,
          borderRadius: 1,
          transition: "all 0.15s ease-out",
        }}
      />
      {/* Vertical arm of plus */}
      <div
        style={{
          position: "absolute",
          width: thickness,
          height: armLength,
          backgroundColor: isHovered ? "white" : HIGHLIGHT_COLOR,
          borderRadius: 1,
          transition: "all 0.15s ease-out",
        }}
      />
    </div>
  );
}

/**
 * Full highlight rectangle with optional badge
 */
function HighlightRect({
  rect,
  badgeNumber,
}: {
  rect: HighlightRect;
  badgeNumber?: number;
}) {
  return (
    <>
      {/* Border rectangle */}
      <div
        style={{
          position: "fixed",
          top: rect.top - BORDER_WIDTH,
          left: rect.left - BORDER_WIDTH,
          width: rect.width + BORDER_WIDTH * 2,
          height: rect.height + BORDER_WIDTH * 2,
          border: `${BORDER_WIDTH}px solid ${HIGHLIGHT_COLOR}`,
          borderRadius: 4,
          backgroundColor: `${HIGHLIGHT_COLOR}10`,
          pointerEvents: "none",
          zIndex: 99998,
          transition: "all 0.15s ease-out",
        }}
      />

      {/* Badge number */}
      {badgeNumber !== undefined && (
        <div
          style={{
            position: "fixed",
            top: rect.top - 12,
            left: rect.left - 4,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: HIGHLIGHT_COLOR,
            color: "white",
            fontSize: 11,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 6px",
            pointerEvents: "none",
            zIndex: 99999,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {badgeNumber}
        </div>
      )}
    </>
  );
}

/**
 * Main consistency highlighter component
 * Renders highlights via Portal to document.body
 */
export function ConsistencyHighlighter({
  violations,
  selectedViolation,
  lockedViolation,
}: ConsistencyHighlighterProps) {
  const [overviewHighlights, setOverviewHighlights] = useState<
    ElementHighlight[]
  >([]);
  const [activeHighlights, setActiveHighlights] = useState<ElementHighlight[]>(
    []
  );
  const [mounted, setMounted] = useState(false);

  // Determine which violation to show
  const activeViolation = lockedViolation || selectedViolation;

  // Calculate overview highlights (dots for all violating elements)
  const updateOverviewHighlights = useCallback(() => {
    if (activeViolation) {
      setOverviewHighlights([]);
      return;
    }

    const allIds = getAllViolatingIds(violations);
    const highlights: ElementHighlight[] = [];

    allIds.forEach((id) => {
      const el = getElementBySnapshotId(id);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      highlights.push({
        id,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
      });
    });

    setOverviewHighlights(highlights);
  }, [violations, activeViolation]);

  // Calculate active highlights (rectangles for selected violation)
  const updateActiveHighlights = useCallback(() => {
    if (!activeViolation) {
      setActiveHighlights([]);
      return;
    }

    const highlights = calculateHighlights(activeViolation.elementIds, true);
    setActiveHighlights(highlights);
  }, [activeViolation]);

  // Set mounted state
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Update highlights on mount, violation change, and scroll/resize
  useEffect(() => {
    updateOverviewHighlights();
    updateActiveHighlights();

    const handleUpdate = () => {
      updateOverviewHighlights();
      updateActiveHighlights();
    };

    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [updateOverviewHighlights, updateActiveHighlights]);

  // Don't render until mounted (SSR safety)
  if (!mounted) return null;

  // No violations, no highlights
  if (violations.length === 0) return null;

  const content = (
    <>
      {/* Overview plus icons when no violation selected */}
      {!activeViolation &&
        overviewHighlights.map((h) => (
          <OverviewPlusIcon key={h.id} rect={h.rect} />
        ))}

      {/* Active highlights for selected violation */}
      {activeViolation &&
        activeHighlights.map((h) => (
          <HighlightRect key={h.id} rect={h.rect} badgeNumber={h.badgeNumber} />
        ))}
    </>
  );

  return createPortal(content, getUILintPortalHost());
}
