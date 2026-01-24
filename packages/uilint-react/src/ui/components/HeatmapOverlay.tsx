/**
 * HeatmapOverlay - Renders colored borders around elements with issues
 * Shows issue count on hover when Alt key is held
 */
import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import { useComposedStore } from "../../core/store";
import { useElementRects } from "../hooks/useElementRects";
import { severityToColor } from "../types";
import type { Issue } from "../types";

interface OverlayItemProps {
  dataLoc: string;
  rect: DOMRect;
  issues: Issue[];
  isHovered: boolean;
  showDetails: boolean;
  onClick: () => void;
}

function OverlayItem({ dataLoc, rect, issues, isHovered, showDetails, onClick }: OverlayItemProps) {
  // Get highest severity for border color
  const severity = useMemo(() => {
    if (issues.some(i => i.severity === "error")) return "error";
    if (issues.some(i => i.severity === "warning")) return "warning";
    return "info";
  }, [issues]);

  const color = severityToColor(severity);
  const count = issues.length;

  return (
    <div
      onClick={onClick}
      style={{
        position: "fixed",
        left: rect.left - 2,
        top: rect.top - 2,
        width: rect.width + 4,
        height: rect.height + 4,
        border: `2px solid ${color}`,
        borderRadius: 4,
        pointerEvents: "auto",
        cursor: "pointer",
        opacity: isHovered ? 1 : 0.6,
        transition: "opacity 0.15s",
        zIndex: 99990,
      }}
    >
      {/* Issue count badge */}
      <span
        style={{
          position: "absolute",
          top: -10,
          right: -10,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          background: color,
          color: "white",
          fontSize: 10,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 4px",
        }}
      >
        {count}
      </span>

      {/* Tooltip on Alt+hover */}
      {showDetails && isHovered && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 8,
            padding: "8px 12px",
            background: "#1f2937",
            color: "white",
            borderRadius: 6,
            fontSize: 12,
            maxWidth: 300,
            whiteSpace: "pre-wrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 99991,
          }}
        >
          <strong>{count} issue{count !== 1 ? "s" : ""}</strong>
          <div style={{ marginTop: 4, opacity: 0.8 }}>
            {issues.slice(0, 3).map((issue, i) => (
              <div key={i} style={{ marginTop: i > 0 ? 4 : 0 }}>
                • {issue.message.slice(0, 60)}{issue.message.length > 60 ? "..." : ""}
              </div>
            ))}
            {issues.length > 3 && (
              <div style={{ marginTop: 4, opacity: 0.6 }}>
                +{issues.length - 3} more...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function HeatmapOverlay() {
  const altKeyHeld = useComposedStore((s) => s.altKeyHeld);
  const openInspector = useComposedStore((s) => s.openInspector);
  const hoveredElementId = useComposedStore((s) => s.hoveredElementId);
  const setHoveredElementId = useComposedStore((s) => s.setHoveredElementId);

  // Get issues from store
  const issues = useComposedStore((s) => s.plugins?.eslint?.issues);

  // Track element positions
  const elementRects = useElementRects(issues);

  // Handle clicking an overlay item
  const handleClick = (dataLoc: string) => {
    openInspector("element", { dataLoc });
  };

  // Don't render if no issues
  if (!issues || issues.size === 0) {
    return null;
  }

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 99990,
      }}
      onMouseMove={(e) => {
        // Find element under cursor
        const target = e.target as HTMLElement;
        const dataLoc = target.getAttribute?.("data-loc");
        setHoveredElementId(dataLoc || null);
      }}
    >
      {Array.from(elementRects.entries()).map(([dataLoc, { rect }]) => {
        const elementIssues = issues.get(dataLoc) || [];
        if (elementIssues.length === 0) return null;

        return (
          <OverlayItem
            key={dataLoc}
            dataLoc={dataLoc}
            rect={rect}
            issues={elementIssues}
            isHovered={hoveredElementId === dataLoc}
            showDetails={altKeyHeld}
            onClick={() => handleClick(dataLoc)}
          />
        );
      })}
    </div>,
    portalRoot
  );
}
