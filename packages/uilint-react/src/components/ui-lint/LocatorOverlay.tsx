"use client";

/**
 * Vision and Inspection Overlays
 *
 * Contains highlight components for vision issues and inspected elements.
 * The main locator functionality is now handled by HeatmapOverlay.
 */

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useUILintStore, type UILintStore } from "./store";
import { DATA_UILINT_ID } from "./types";
import { getUILintPortalHost } from "./portal-host";
import { cn } from "@/lib/utils";

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
