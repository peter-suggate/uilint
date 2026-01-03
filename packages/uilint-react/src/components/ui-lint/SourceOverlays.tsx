"use client";

/**
 * Source Overlays - Colored rectangles over components with file labels
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import type { ScannedElement, SourceFile } from "./types";
import { buildEditorUrl } from "./fiber-utils";

/**
 * Design tokens
 */
const STYLES = {
  font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  shadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
};

/**
 * Get label position styles based on setting
 */
function getLabelPositionStyles(
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right"
): React.CSSProperties {
  switch (position) {
    case "top-left":
      return { top: "-1px", left: "-1px" };
    case "top-right":
      return { top: "-1px", right: "-1px" };
    case "bottom-left":
      return { bottom: "-1px", left: "-1px" };
    case "bottom-right":
      return { bottom: "-1px", right: "-1px" };
  }
}

/**
 * Main Source Overlays Component
 */
export function SourceOverlays() {
  const {
    sourceFiles,
    scannedElements,
    settings,
    selectedElement,
    setSelectedElement,
    hoveredElement,
    setHoveredElement,
    mode,
  } = useUILintContext();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Create a map of element ID to source file for quick lookup
  const elementToFile = useMemo(() => {
    const map = new Map<string, SourceFile>();
    for (const file of sourceFiles) {
      for (const element of file.elements) {
        map.set(element.id, file);
      }
    }
    return map;
  }, [sourceFiles]);

  // Handle element click
  const handleElementClick = useCallback(
    (element: ScannedElement) => {
      if (mode === "inspect") {
        setSelectedElement(
          selectedElement?.id === element.id ? null : element
        );
      }
    },
    [mode, selectedElement, setSelectedElement]
  );

  // Handle label click - open in editor
  const handleLabelClick = useCallback(
    (element: ScannedElement, e: React.MouseEvent) => {
      e.stopPropagation();
      if (element.source) {
        const url = buildEditorUrl(element.source, "cursor");
        window.open(url, "_blank");
      }
    },
    []
  );

  if (!mounted) return null;

  const content = (
    <div data-ui-lint style={{ pointerEvents: "none" }}>
      <style>{`
        @keyframes uilint-overlay-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {scannedElements.map((element) => {
        const file = elementToFile.get(element.id);
        if (!file) return null;

        const isSelected = selectedElement?.id === element.id;
        const isHovered = hoveredElement?.id === element.id;

        return (
          <ElementOverlay
            key={element.id}
            element={element}
            file={file}
            settings={settings}
            isSelected={isSelected}
            isHovered={isHovered}
            onHover={() => setHoveredElement(element)}
            onLeave={() => setHoveredElement(null)}
            onClick={() => handleElementClick(element)}
            onLabelClick={(e) => handleLabelClick(element, e)}
            showClickable={mode === "inspect"}
          />
        );
      })}
    </div>
  );

  return createPortal(content, document.body);
}

/**
 * Individual element overlay
 */
interface ElementOverlayProps {
  element: ScannedElement;
  file: SourceFile;
  settings: ReturnType<typeof useUILintContext>["settings"];
  isSelected: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  onLabelClick: (e: React.MouseEvent) => void;
  showClickable: boolean;
}

function ElementOverlay({
  element,
  file,
  settings,
  isSelected,
  isHovered,
  onHover,
  onLeave,
  onClick,
  onLabelClick,
  showClickable,
}: ElementOverlayProps) {
  const { rect } = element;

  // Skip if element is too small
  if (rect.width < 20 || rect.height < 20) return null;

  // Skip if element is outside viewport
  if (
    rect.bottom < 0 ||
    rect.top > window.innerHeight ||
    rect.right < 0 ||
    rect.left > window.innerWidth
  ) {
    return null;
  }

  const borderWidth = isSelected ? 3 : isHovered ? 2 : 1.5;

  return (
    <div
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        border: `${borderWidth}px solid ${file.color}`,
        borderRadius: "2px",
        pointerEvents: showClickable ? "auto" : "none",
        cursor: showClickable ? "pointer" : "default",
        zIndex: isSelected ? 99998 : isHovered ? 99997 : 99996,
        animation: "uilint-overlay-fade-in 0.15s ease-out",
        transition: "border-width 0.15s",
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      {/* File label */}
      {settings.showLabels && (
        <FileLabel
          file={file}
          element={element}
          position={settings.labelPosition}
          isHovered={isHovered}
          isSelected={isSelected}
          onClick={onLabelClick}
        />
      )}
    </div>
  );
}

/**
 * File name label pill
 */
interface FileLabelProps {
  file: SourceFile;
  element: ScannedElement;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  isHovered: boolean;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function FileLabel({
  file,
  element,
  position,
  isHovered,
  isSelected,
  onClick,
}: FileLabelProps) {
  const [showFullPath, setShowFullPath] = useState(false);

  const positionStyles = getLabelPositionStyles(position);

  // Truncate display name if too long
  const displayName =
    file.displayName.length > 20
      ? file.displayName.slice(0, 17) + "..."
      : file.displayName;

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyles,
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 6px",
        borderRadius: "3px",
        backgroundColor: file.color,
        color: "#FFFFFF",
        fontSize: "10px",
        fontWeight: 600,
        fontFamily: STYLES.fontMono,
        whiteSpace: "nowrap",
        pointerEvents: "auto",
        cursor: "pointer",
        boxShadow: STYLES.shadow,
        transition: "transform 0.1s, padding 0.1s",
        transform: isHovered || isSelected ? "scale(1.05)" : "scale(1)",
        zIndex: 99999,
      }}
      onMouseEnter={() => setShowFullPath(true)}
      onMouseLeave={() => setShowFullPath(false)}
      onClick={onClick}
      title={`${file.path}:${element.source?.lineNumber || "?"}\nClick to open in editor`}
    >
      <span>{displayName}</span>
      {element.source?.lineNumber && (
        <span style={{ opacity: 0.8, fontSize: "9px" }}>
          :{element.source.lineNumber}
        </span>
      )}
    </div>
  );
}

/**
 * Tooltip showing full file path
 */
function FullPathTooltip({ path }: { path: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        marginTop: "4px",
        padding: "4px 8px",
        borderRadius: "4px",
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        border: "1px solid rgba(75, 85, 99, 0.5)",
        color: "#F9FAFB",
        fontSize: "10px",
        fontFamily: STYLES.fontMono,
        whiteSpace: "nowrap",
        zIndex: 100000,
        boxShadow: STYLES.shadow,
      }}
    >
      {path}
    </div>
  );
}
