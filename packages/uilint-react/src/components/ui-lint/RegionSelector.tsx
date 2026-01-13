"use client";

/**
 * RegionSelector Component
 *
 * Full-screen overlay that allows users to click and drag to select a region
 * for vision capture. Shows a live selection rectangle with dimensions.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { getUILintPortalHost } from "./portal-host";

export interface SelectedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RegionSelectorProps {
  /** Whether the selector is active */
  active: boolean;
  /** Called when a region is selected (on mouse up) */
  onRegionSelected: (region: SelectedRegion) => void;
  /** Called when selection is cancelled (Escape key) */
  onCancel: () => void;
}

// Design tokens - uses CSS variables where applicable
const TOKENS = {
  overlayBg: "rgba(0, 0, 0, 0.5)", // Keep neutral overlay
  selectionBorder: "var(--uilint-accent)",
  selectionBg: "var(--uilint-accent)", // Will have opacity applied
  textBg: "var(--uilint-backdrop)",
  textColor: "var(--uilint-text-primary)",
  fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
  fontMono: `"SF Mono", Monaco, "Cascadia Code", monospace`,
} as const;

export function RegionSelector({
  active,
  onRegionSelected,
  onCancel,
}: RegionSelectorProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [currentPoint, setCurrentPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate selection rectangle
  const getSelectionRect = useCallback((): SelectedRegion | null => {
    if (!startPoint || !currentPoint) return null;

    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    return { x, y, width, height };
  }, [startPoint, currentPoint]);

  // Handle mouse down - start selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start selection on left click
    if (e.button !== 0) return;

    setIsSelecting(true);
    setStartPoint({ x: e.clientX, y: e.clientY });
    setCurrentPoint({ x: e.clientX, y: e.clientY });
  }, []);

  // Handle mouse move - update selection
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelecting || !startPoint) return;

      setCurrentPoint({ x: e.clientX, y: e.clientY });
    },
    [isSelecting, startPoint]
  );

  // Handle mouse up - complete selection
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelecting || !startPoint) return;

      const rect = getSelectionRect();
      if (rect && rect.width > 10 && rect.height > 10) {
        // Only accept selections larger than 10x10px
        onRegionSelected(rect);
      } else {
        // Selection too small, cancel
        onCancel();
      }

      // Reset state
      setIsSelecting(false);
      setStartPoint(null);
      setCurrentPoint(null);
    },
    [isSelecting, startPoint, getSelectionRect, onRegionSelected, onCancel]
  );

  // Handle escape key
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [active, onCancel]);

  // Prevent page scroll while selecting
  useEffect(() => {
    if (!active) return;

    const preventScroll = (e: Event) => {
      e.preventDefault();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("wheel", preventScroll, { passive: false });
    document.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("wheel", preventScroll);
      document.removeEventListener("touchmove", preventScroll);
    };
  }, [active]);

  if (!active || !mounted) return null;

  const selectionRect = getSelectionRect();

  const content = (
    <div
      ref={overlayRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        cursor: "crosshair",
        backgroundColor: TOKENS.overlayBg,
        fontFamily: TOKENS.fontFamily,
      }}
      data-ui-lint
    >
      {/* Instructions */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          padding: "12px 20px",
          borderRadius: "12px",
          backgroundColor: TOKENS.textBg,
          color: TOKENS.textColor,
          fontSize: "14px",
          fontWeight: 500,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        Click and drag to select a region • Press{" "}
        <kbd
          style={{
            padding: "2px 6px",
            borderRadius: "4px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            fontSize: "11px",
            fontFamily: TOKENS.fontMono,
            marginLeft: "4px",
          }}
        >
          Esc
        </kbd>{" "}
        to cancel
      </div>

      {/* Selection rectangle */}
      {selectionRect && selectionRect.width > 0 && selectionRect.height > 0 && (
        <>
          {/* Selection box */}
          <div
            style={{
              position: "absolute",
              left: `${selectionRect.x}px`,
              top: `${selectionRect.y}px`,
              width: `${selectionRect.width}px`,
              height: `${selectionRect.height}px`,
              border: `2px solid ${TOKENS.selectionBorder}`,
              backgroundColor: TOKENS.selectionBg,
              pointerEvents: "none",
              boxShadow: `0 0 0 9999px ${TOKENS.overlayBg}`,
            }}
          />

          {/* Dimensions label */}
          <div
            style={{
              position: "absolute",
              left: `${selectionRect.x}px`,
              top: `${selectionRect.y - 32}px`,
              padding: "6px 10px",
              borderRadius: "6px",
              backgroundColor: TOKENS.textBg,
              color: TOKENS.textColor,
              fontSize: "12px",
              fontFamily: TOKENS.fontMono,
              fontWeight: 500,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
              pointerEvents: "none",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            {Math.round(selectionRect.width)} ×{" "}
            {Math.round(selectionRect.height)}
          </div>
        </>
      )}
    </div>
  );

  return createPortal(content, getUILintPortalHost());
}
