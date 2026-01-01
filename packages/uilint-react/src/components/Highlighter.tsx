"use client";

import React, { useEffect, useState } from "react";
import { useUILint } from "./UILint";

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Highlighter() {
  const { highlightedIssue } = useUILint();
  const [rect, setRect] = useState<HighlightRect | null>(null);

  useEffect(() => {
    if (!highlightedIssue?.selector) {
      setRect(null);
      return;
    }

    try {
      const element = document.querySelector(highlightedIssue.selector);
      if (element) {
        const domRect = element.getBoundingClientRect();
        setRect({
          top: domRect.top + window.scrollY,
          left: domRect.left + window.scrollX,
          width: domRect.width,
          height: domRect.height,
        });
      } else {
        setRect(null);
      }
    } catch {
      setRect(null);
    }
  }, [highlightedIssue]);

  if (!rect) return null;

  const typeColors: Record<string, string> = {
    color: "#F59E0B",
    typography: "#8B5CF6",
    spacing: "#10B981",
    component: "#3B82F6",
    responsive: "#EC4899",
    accessibility: "#EF4444",
  };

  const color = highlightedIssue?.type
    ? typeColors[highlightedIssue.type] || "#EF4444"
    : "#EF4444";

  return (
    <>
      {/* Highlight overlay */}
      <div
        style={{
          position: "absolute",
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          border: `2px solid ${color}`,
          borderRadius: "4px",
          backgroundColor: `${color}15`,
          pointerEvents: "none",
          zIndex: 99998,
          boxShadow: `0 0 0 4px ${color}30`,
          transition: "all 0.2s ease-out",
        }}
      />

      {/* Label */}
      <div
        style={{
          position: "absolute",
          top: rect.top - 28,
          left: rect.left - 4,
          padding: "4px 8px",
          backgroundColor: color,
          color: "white",
          fontSize: "11px",
          fontWeight: "600",
          borderRadius: "4px 4px 0 0",
          pointerEvents: "none",
          zIndex: 99998,
          fontFamily: "system-ui, -apple-system, sans-serif",
          textTransform: "uppercase",
        }}
      >
        {highlightedIssue?.type || "Issue"}
      </div>
    </>
  );
}
