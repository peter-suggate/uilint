"use client";

/**
 * Locator Overlay - Shows element info when Alt/Option key is held
 * Inspired by LocatorJS for a quick "hover to find source" experience
 *
 * Uses data-loc attributes only (no React Fiber).
 */

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useUILintStore, type UILintStore } from "./store";
import type { SourceLocation } from "./types";
import { DATA_UILINT_ID } from "./types";
import { getUILintPortalHost } from "./portal-host";
import { cn } from "@/lib/utils";

/**
 * Get the display name from a file path
 */
function getFileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

/**
 * Main Locator Overlay Component
 */
export function LocatorOverlay() {
  const locatorTarget = useUILintStore((s: UILintStore) => s.locatorTarget);
  const [mounted, setMounted] = useState(false);
  const handleUILintInteraction = (
    e: React.MouseEvent | React.KeyboardEvent | React.PointerEvent
  ) => {
    e.stopPropagation();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get the source from locator target
  const currentSource = useMemo<SourceLocation | null>(() => {
    if (!locatorTarget) return null;
    return locatorTarget.source;
  }, [locatorTarget]);

  // Current element name (tag name)
  const currentName = useMemo(() => {
    if (!locatorTarget) return "";
    return locatorTarget.element.tagName.toLowerCase();
  }, [locatorTarget]);

  // Early return after all hooks
  if (!mounted || !locatorTarget) return null;

  const { rect } = locatorTarget;

  const content = (
    <div
      data-ui-lint
      onMouseDown={handleUILintInteraction}
      onPointerDown={handleUILintInteraction}
      onClick={handleUILintInteraction}
      onKeyDown={handleUILintInteraction}
      className="pointer-events-none"
    >
      {/* Element highlight border */}
      <div
        className="fixed border-2 border-blue-500 rounded ring-2 ring-blue-500/30 animate-in fade-in duration-100"
        style={{
          top: rect.top - 2,
          left: rect.left - 2,
          width: rect.width + 4,
          height: rect.height + 4,
          zIndex: 99997,
        }}
      />

      {/* Info tooltip */}
      <InfoTooltip
        rect={rect}
        source={currentSource}
        componentName={currentName}
      />
    </div>
  );

  return createPortal(content, getUILintPortalHost());
}

/**
 * Highlight for a hovered vision issue
 */
export function VisionIssueHighlight() {
  const hoveredVisionIssue = useUILintStore(
    (s: UILintStore) => s.hoveredVisionIssue
  );
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update rect when issue changes or on scroll/resize
  useEffect(() => {
    if (!hoveredVisionIssue?.dataLoc) {
      setRect(null);
      return;
    }

    const updateRect = () => {
      // Try both formats (source location and runtime ID)
      let element = document.querySelector(
        `[${DATA_UILINT_ID}="${hoveredVisionIssue.dataLoc}"]`
      );
      if (!element) {
        element = document.querySelector(
          `[${DATA_UILINT_ID}^="loc:${hoveredVisionIssue.dataLoc}"]`
        );
      }
      if (element) {
        setRect(element.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };

    updateRect();

    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);

    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [hoveredVisionIssue]);

  if (!mounted || !hoveredVisionIssue || !rect) return null;

  const isError = hoveredVisionIssue.severity === "error";

  return createPortal(
    <div
      data-ui-lint
      className={cn(
        "fixed rounded-lg pointer-events-none animate-in fade-in duration-100",
        isError
          ? "border-2 border-red-500 bg-red-500/10 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
          : "border-2 border-amber-500 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
      )}
      style={{
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
        zIndex: 99997,
      }}
    />,
    getUILintPortalHost()
  );
}

/**
 * Info tooltip showing element name and file location
 */
interface InfoTooltipProps {
  rect: DOMRect;
  source: SourceLocation | null;
  componentName: string;
}

function InfoTooltip({ rect, source, componentName }: InfoTooltipProps) {
  // Position the tooltip above or below the element
  const viewportHeight = window.innerHeight;
  const spaceAbove = rect.top;
  const spaceBelow = viewportHeight - rect.bottom;
  const positionAbove = spaceAbove > 100 || spaceBelow < 100;

  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.max(8, Math.min(rect.left, window.innerWidth - 320)),
    zIndex: 99999,
  };

  if (positionAbove) {
    tooltipStyle.bottom = viewportHeight - rect.top + 8;
  } else {
    tooltipStyle.top = rect.bottom + 8;
  }

  return (
    <div
      style={tooltipStyle}
      className="flex flex-col gap-1.5 p-2.5 px-3 rounded-lg bg-zinc-900/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-700 dark:border-zinc-600 shadow-lg max-w-80 pointer-events-auto animate-in fade-in duration-150"
    >
      {/* Element name */}
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-blue-400">
          {"<"}
          {componentName}
          {" />"}
        </span>
      </div>

      {/* File path and line number */}
      {source && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-300">
          <span>{getFileName(source.fileName)}</span>
          <span className="text-zinc-500">:</span>
          <span className="text-blue-400">{source.lineNumber}</span>
        </div>
      )}

      {/* Click hint */}
      <div className="flex items-center gap-3 text-[10px] text-zinc-500 border-t border-zinc-700/50 pt-2 mt-0.5">
        <span>Click to inspect</span>
      </div>
    </div>
  );
}

/**
 * Highlight overlay for the inspected element (when sidebar is open)
 */
export function InspectedElementHighlight() {
  const inspectedElement = useUILintStore(
    (s: UILintStore) => s.inspectedElement
  );
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const handleUILintInteraction = (
    e: React.MouseEvent | React.KeyboardEvent | React.PointerEvent
  ) => {
    e.stopPropagation();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update rect when element changes or on scroll/resize
  useEffect(() => {
    if (!inspectedElement?.element) return;

    const updateRect = () => {
      if (inspectedElement.element) {
        setRect(inspectedElement.element.getBoundingClientRect());
      }
    };

    updateRect();

    // Update on scroll and resize
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);

    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [inspectedElement?.element]);

  if (!mounted || !inspectedElement || !rect) return null;

  const content = (
    <div
      data-ui-lint
      onMouseDown={handleUILintInteraction}
      onPointerDown={handleUILintInteraction}
      onClick={handleUILintInteraction}
      onKeyDown={handleUILintInteraction}
      className="pointer-events-none"
    >
      {/* Element highlight with pulsing border */}
      <div
        className="fixed border-2 border-blue-500 rounded-md bg-blue-500/10 animate-pulse"
        style={{
          top: rect.top - 3,
          left: rect.left - 3,
          width: rect.width + 6,
          height: rect.height + 6,
          boxShadow:
            "0 0 0 2px rgba(59, 130, 246, 0.6), 0 0 8px rgba(59, 130, 246, 0.3)",
          zIndex: 99996,
        }}
      />

      {/* Small label at top-left of element */}
      <div
        className="fixed px-2 py-0.5 bg-blue-500 text-white text-[10px] font-semibold rounded-t"
        style={{
          top: rect.top - 22,
          left: rect.left - 3,
          zIndex: 99996,
        }}
      >
        Inspecting
      </div>
    </div>
  );

  return createPortal(content, getUILintPortalHost());
}
