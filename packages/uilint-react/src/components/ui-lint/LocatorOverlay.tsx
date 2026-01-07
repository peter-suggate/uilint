"use client";

/**
 * Locator Overlay - Shows element info when Alt/Option key is held
 * Inspired by LocatorJS for a quick "hover to find source" experience
 *
 * Uses data-loc attributes only (no React Fiber).
 */

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import type { SourceLocation } from "./types";

/**
 * Design tokens
 */
const STYLES = {
  bg: "rgba(17, 24, 39, 0.95)",
  border: "rgba(59, 130, 246, 0.8)",
  borderHighlight: "#3B82F6",
  text: "#F9FAFB",
  textMuted: "#9CA3AF",
  accent: "#3B82F6",
  font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  shadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
  blur: "blur(12px)",
};

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
  const { locatorTarget } = useUILintContext();
  const [mounted, setMounted] = useState(false);

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
    <div data-ui-lint style={{ pointerEvents: "none" }}>
      <style>{`
        @keyframes uilint-locator-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes uilint-locator-pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Element highlight border */}
      <div
        style={{
          position: "fixed",
          top: rect.top - 2,
          left: rect.left - 2,
          width: rect.width + 4,
          height: rect.height + 4,
          border: `2px solid ${STYLES.borderHighlight}`,
          borderRadius: "4px",
          boxShadow: `0 0 0 1px rgba(59, 130, 246, 0.3), inset 0 0 0 1px rgba(59, 130, 246, 0.1)`,
          animation: "uilint-locator-fade-in 0.1s ease-out",
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

  return createPortal(content, document.body);
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
    animation: "uilint-locator-fade-in 0.15s ease-out",
  };

  if (positionAbove) {
    tooltipStyle.bottom = viewportHeight - rect.top + 8;
  } else {
    tooltipStyle.top = rect.bottom + 8;
  }

  return (
    <div
      style={{
        ...tooltipStyle,
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "10px 12px",
        borderRadius: "8px",
        backgroundColor: STYLES.bg,
        backdropFilter: STYLES.blur,
        WebkitBackdropFilter: STYLES.blur,
        border: `1px solid ${STYLES.border}`,
        boxShadow: STYLES.shadow,
        fontFamily: STYLES.font,
        maxWidth: "320px",
        pointerEvents: "auto",
      }}
    >
      {/* Element name */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: STYLES.accent,
          }}
        >
          {"<"}
          {componentName}
          {" />"}
        </span>
      </div>

      {/* File path and line number */}
      {source && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            fontFamily: STYLES.fontMono,
            color: STYLES.text,
          }}
        >
          <span style={{ opacity: 0.9 }}>{getFileName(source.fileName)}</span>
          <span style={{ color: STYLES.textMuted }}>:</span>
          <span style={{ color: STYLES.accent }}>{source.lineNumber}</span>
        </div>
      )}

      {/* Click hint */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "10px",
          color: STYLES.textMuted,
          borderTop: `1px solid rgba(75, 85, 99, 0.3)`,
          paddingTop: "8px",
          marginTop: "2px",
        }}
      >
        <span>Click to inspect</span>
      </div>
    </div>
  );
}

/**
 * Highlight overlay for the inspected element (when sidebar is open)
 */
export function InspectedElementHighlight() {
  const { inspectedElement } = useUILintContext();
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

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
    <div data-ui-lint style={{ pointerEvents: "none" }}>
      <style>{`
        @keyframes uilint-inspected-pulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.6), 0 0 8px rgba(16, 185, 129, 0.3); }
          50% { box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.8), 0 0 16px rgba(16, 185, 129, 0.5); }
        }
      `}</style>

      {/* Element highlight with pulsing border */}
      <div
        style={{
          position: "fixed",
          top: rect.top - 3,
          left: rect.left - 3,
          width: rect.width + 6,
          height: rect.height + 6,
          border: "2px solid #10B981",
          borderRadius: "6px",
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          animation: "uilint-inspected-pulse 2s ease-in-out infinite",
          zIndex: 99996,
        }}
      />

      {/* Small label at top-left of element */}
      <div
        style={{
          position: "fixed",
          top: rect.top - 24,
          left: rect.left - 3,
          padding: "2px 8px",
          backgroundColor: "#10B981",
          color: "#FFFFFF",
          fontSize: "10px",
          fontWeight: 600,
          fontFamily: STYLES.font,
          borderRadius: "4px 4px 0 0",
          zIndex: 99996,
        }}
      >
        Inspecting
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
