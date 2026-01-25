/**
 * FloatingIcon - Draggable glassmorphic command bar trigger
 * macOS Spotlight-inspired design with keyboard shortcut hint
 */
import React, { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useComposedStore } from "../../core/store";
import { SearchIcon } from "../icons";

interface Position {
  x: number;
  y: number;
}

const PILL_WIDTH = 180;
const PILL_HEIGHT = 36;

/** SSR-safe default position - centered horizontally at top */
function getDefaultPosition(): Position {
  if (typeof window === "undefined") {
    return { x: 0, y: 16 };
  }
  return { x: window.innerWidth / 2 - PILL_WIDTH / 2, y: 16 };
}

/** Detect macOS for showing correct modifier key symbol */
function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

export function FloatingIcon() {
  const openCommandPalette = useComposedStore((s) => s.openCommandPalette);
  const isConnected = useComposedStore((s) => s.wsConnected);
  const position = useComposedStore((s) => s.floatingIconPosition);
  const setPosition = useComposedStore((s) => s.setFloatingIconPosition);

  // Get issue count from eslint plugin
  const issueCount = useComposedStore((s) => {
    const issues = s.plugins?.eslint?.issues;
    if (!issues) return 0;
    let count = 0;
    issues.forEach((arr) => {
      count += arr.length;
    });
    return count;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const currentPosition = position ?? getDefaultPosition();
  const modKey = isMac() ? "⌥" : "Alt+";

  const handleGripMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = Math.max(
        0,
        Math.min(window.innerWidth - PILL_WIDTH, e.clientX - dragOffset.x)
      );
      const newY = Math.max(
        0,
        Math.min(window.innerHeight - PILL_HEIGHT, e.clientY - dragOffset.y)
      );

      setPosition({ x: newX, y: newY });
    },
    [isDragging, dragOffset, setPosition]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleClick = useCallback(() => {
    if (!isDragging) {
      openCommandPalette();
    }
  }, [isDragging, openCommandPalette]);

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  return createPortal(
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "fixed",
        left: currentPosition.x,
        top: currentPosition.y,
        height: PILL_HEIGHT,
        display: "flex",
        alignItems: "center",
        gap: 0,
        zIndex: 99999,
        pointerEvents: "auto",
      }}
    >
      {/* Grip handle */}
      <div
        onMouseDown={handleGripMouseDown}
        style={{
          width: 20,
          height: PILL_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isDragging ? "grabbing" : "grab",
          borderRadius: "10px 0 0 10px",
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(255, 255, 255, 0.8)",
          borderLeft: "1px solid rgba(255, 255, 255, 0.8)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.5)",
          boxShadow: isDragging
            ? "0 8px 32px rgba(0, 0, 0, 0.2)"
            : "0 4px 16px rgba(0, 0, 0, 0.1)",
          transition: isDragging ? "none" : "box-shadow 0.2s",
        }}
      >
        <svg
          width="6"
          height="14"
          viewBox="0 0 6 14"
          fill="none"
          style={{ opacity: isHovered ? 0.6 : 0.35 }}
        >
          <circle cx="1.5" cy="2" r="1.5" fill="currentColor" />
          <circle cx="4.5" cy="2" r="1.5" fill="currentColor" />
          <circle cx="1.5" cy="7" r="1.5" fill="currentColor" />
          <circle cx="4.5" cy="7" r="1.5" fill="currentColor" />
          <circle cx="1.5" cy="12" r="1.5" fill="currentColor" />
          <circle cx="4.5" cy="12" r="1.5" fill="currentColor" />
        </svg>
      </div>

      {/* Main pill button */}
      <button
        onClick={handleClick}
        style={{
          height: PILL_HEIGHT,
          padding: "0 14px 0 10px",
          border: "none",
          borderRadius: "0 10px 10px 0",
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(255, 255, 255, 0.8)",
          borderRight: "1px solid rgba(255, 255, 255, 0.5)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.5)",
          boxShadow: isDragging
            ? "0 8px 32px rgba(0, 0, 0, 0.2)"
            : "0 4px 16px rgba(0, 0, 0, 0.1)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: isDragging ? "none" : "box-shadow 0.2s, background 0.2s",
          color: "#1a1a1a",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 13,
          fontWeight: 400,
        }}
        onMouseOver={(e) => {
          if (!isDragging) {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.85)";
          }
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.7)";
        }}
      >
        <SearchIcon size={15} style={{ opacity: 0.5 }} />

        <span style={{ opacity: 0.7 }}>Search</span>

        {/* Issue count - subtle inline */}
        {issueCount > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#ef4444",
              opacity: 0.9,
            }}
          >
            {issueCount > 99 ? "99+" : issueCount}
          </span>
        )}

        {/* Keyboard shortcut */}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            fontWeight: 500,
            opacity: 0.4,
            letterSpacing: "-0.02em",
          }}
        >
          {modKey}K
        </span>
      </button>

      {/* Connection indicator - subtle dot */}
      {!isConnected && (
        <span
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#f59e0b",
            border: "2px solid white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      )}
    </div>,
    portalRoot
  );
}
