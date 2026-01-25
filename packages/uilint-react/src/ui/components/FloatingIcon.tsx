/**
 * FloatingIcon - Draggable button that opens the command palette
 * Shows issue count badge and connection status
 */
import React, { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useComposedStore } from "../../core/store";
import { UILintIcon, ConnectionIcon } from "../icons";

interface Position {
  x: number;
  y: number;
}

/** SSR-safe default position - only accesses window on client */
function getDefaultPosition(): Position {
  if (typeof window === "undefined") {
    return { x: 0, y: 16 };
  }
  return { x: window.innerWidth / 2 - 24, y: 16 };
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
    issues.forEach((arr) => { count += arr.length; });
    return count;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const currentPosition = position ?? getDefaultPosition();

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const newX = Math.max(0, Math.min(window.innerWidth - 48, e.clientX - dragOffset.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 48, e.clientY - dragOffset.y));

    setPosition({ x: newX, y: newY });
  }, [isDragging, dragOffset, setPosition]);

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

  // Render into portal
  const portalRoot = document.getElementById("uilint-portal") || document.body;

  return createPortal(
    <button
      ref={buttonRef}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      style={{
        position: "fixed",
        left: currentPosition.x,
        top: currentPosition.y,
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "none",
        background: isConnected ? "#3b82f6" : "#6b7280",
        color: "white",
        cursor: isDragging ? "grabbing" : "grab",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 99999,
        transition: isDragging ? "none" : "background 0.2s",
        pointerEvents: "auto",
      }}
      title={`UILint: ${issueCount} issues${isConnected ? "" : " (disconnected)"}`}
    >
      <UILintIcon size={24} />

      {/* Issue count badge */}
      {issueCount > 0 && (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            background: "#ef4444",
            color: "white",
            fontSize: 11,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 6px",
          }}
        >
          {issueCount > 99 ? "99+" : issueCount}
        </span>
      )}

      {/* Connection indicator */}
      {!isConnected && (
        <span
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#f59e0b",
            border: "2px solid white",
          }}
        />
      )}
    </button>,
    portalRoot
  );
}
