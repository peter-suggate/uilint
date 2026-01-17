"use client";

/**
 * FloatingIcon - Minimal floating trigger for command palette
 *
 * Features:
 * - Draggable to any position on screen
 * - Small icon with scanning animation when active
 * - Cmd+K shortcut hint
 * - Click to open command palette
 * - Position persists across sessions
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useUILintStore, type FloatingIconPosition } from "./store";
import { getUILintPortalHost } from "./portal-host";
import { cn } from "@/lib/utils";
import { Icons } from "./command-palette/icons";
import { RegionSelector, type SelectedRegion } from "./RegionSelector";

/** Default position: top-center of the viewport */
function getDefaultPosition(): FloatingIconPosition {
  if (typeof window === "undefined") return { x: 400, y: 20 };
  return { x: window.innerWidth / 2, y: 20 };
}

/** Minimum pixels mouse must move before drag starts */
const DRAG_THRESHOLD = 8;

/** Clamp position to viewport bounds */
function clampToViewport(
  pos: FloatingIconPosition,
  buttonWidth: number,
  buttonHeight: number
): FloatingIconPosition {
  if (typeof window === "undefined") return pos;
  // Minimal padding - just keep the icon fully visible
  const minX = buttonWidth / 2;
  const maxX = window.innerWidth - buttonWidth / 2;
  const minY = buttonHeight / 2;
  const maxY = window.innerHeight - buttonHeight / 2;
  return {
    x: Math.max(minX, Math.min(maxX, pos.x)),
    y: Math.max(minY, Math.min(maxY, pos.y)),
  };
}

export function FloatingIcon() {
  const openCommandPalette = useUILintStore((s) => s.openCommandPalette);
  const commandPaletteOpen = useUILintStore((s) => s.commandPaletteOpen);
  const wsConnected = useUILintStore((s) => s.wsConnected);
  const liveScanEnabled = useUILintStore((s) => s.liveScanEnabled);
  const regionSelectionActive = useUILintStore((s) => s.regionSelectionActive);
  const setRegionSelectionActive = useUILintStore((s) => s.setRegionSelectionActive);
  const setSelectedRegion = useUILintStore((s) => s.setSelectedRegion);
  const setCaptureMode = useUILintStore((s) => s.setCaptureMode);
  const triggerVisionAnalysis = useUILintStore((s) => s.triggerVisionAnalysis);
  const floatingIconPosition = useUILintStore((s) => s.floatingIconPosition);
  const setFloatingIconPosition = useUILintStore((s) => s.setFloatingIconPosition);

  // Get total issue count for badge
  const elementIssuesCache = useUILintStore((s) => s.elementIssuesCache);
  const fileIssuesCache = useUILintStore((s) => s.fileIssuesCache);
  const visionIssuesCache = useUILintStore((s) => s.visionIssuesCache);

  const totalIssueCount = useMemo(() => {
    let count = 0;
    elementIssuesCache.forEach((el) => (count += el.issues.length));
    fileIssuesCache.forEach((issues) => (count += issues.length));
    visionIssuesCache.forEach((issues) => (count += issues.length));
    return count;
  }, [elementIssuesCache, fileIssuesCache, visionIssuesCache]);

  // Local state
  const [mounted, setMounted] = useState(false);
  const [isPendingDrag, setIsPendingDrag] = useState(false); // Mouse down but threshold not met
  const [isDragging, setIsDragging] = useState(false); // Threshold met, actively dragging
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [localPosition, setLocalPosition] = useState<FloatingIconPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Platform detection for shortcut display
  const isMac =
    typeof navigator !== "undefined" && navigator.platform?.includes("Mac");
  const shortcutKey = isMac ? "⌘" : "Ctrl+";

  // Initialize local position from store or default
  useEffect(() => {
    if (mounted && !localPosition) {
      setLocalPosition(floatingIconPosition || getDefaultPosition());
    }
  }, [mounted, floatingIconPosition, localPosition]);

  // Mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle window resize - clamp position to new viewport
  useEffect(() => {
    if (!mounted) return;

    const handleResize = () => {
      setLocalPosition((prev) => {
        if (!prev) return prev;
        const buttonWidth = buttonRef.current?.offsetWidth || 100;
        const buttonHeight = buttonRef.current?.offsetHeight || 40;
        return clampToViewport(prev, buttonWidth, buttonHeight);
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mounted]);

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start drag on left mouse button
      if (e.button !== 0) return;

      // Record start position to detect drag vs click
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };

      // Calculate offset: difference between mouse click and icon's current center position
      // This offset will be used to keep the icon at the same relative position under the cursor
      if (localPosition) {
        setDragOffset({
          x: e.clientX - localPosition.x,
          y: e.clientY - localPosition.y,
        });
      }

      // Start in pending state - actual drag begins after threshold
      setIsPendingDrag(true);
      e.preventDefault();
    },
    [localPosition]
  );

  // Document-level mouse move and up handlers
  useEffect(() => {
    if (!isPendingDrag && !isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const startPos = dragStartPosRef.current;
      if (!startPos) return;

      const dx = Math.abs(e.clientX - startPos.x);
      const dy = Math.abs(e.clientY - startPos.y);

      // Check if we've exceeded the drag threshold
      if (isPendingDrag && !isDragging) {
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          // Threshold exceeded - start actual drag
          setIsPendingDrag(false);
          setIsDragging(true);
          // Fall through to update position immediately (no return)
        } else {
          return; // Don't move yet while pending and threshold not met
        }
      }

      // Actually dragging - update position
      const buttonWidth = buttonRef.current?.offsetWidth || 100;
      const buttonHeight = buttonRef.current?.offsetHeight || 40;

      const newPos = clampToViewport(
        {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        },
        buttonWidth,
        buttonHeight
      );

      setLocalPosition(newPos);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const wasDragging = isDragging;
      setIsPendingDrag(false);
      setIsDragging(false);

      if (wasDragging && localPosition) {
        // Save position to store (persists to localStorage)
        setFloatingIconPosition(localPosition);
      } else {
        // It was a click (threshold never exceeded) - open command palette
        openCommandPalette();
      }

      dragStartPosRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPendingDrag, isDragging, dragOffset, localPosition, setFloatingIconPosition, openCommandPalette]);

  // Handlers
  const handleRegionSelected = useCallback(
    (region: SelectedRegion) => {
      setRegionSelectionActive(false);
      setSelectedRegion(region);
      setCaptureMode("region");
      triggerVisionAnalysis();
    },
    [setRegionSelectionActive, setSelectedRegion, setCaptureMode, triggerVisionAnalysis]
  );

  const handleRegionCancel = useCallback(() => {
    setRegionSelectionActive(false);
    setSelectedRegion(null);
    setCaptureMode("full");
  }, [setRegionSelectionActive, setSelectedRegion, setCaptureMode]);

  // Prevent event propagation (but allow drag to work)
  const handleUILintInteraction = useCallback(
    (e: React.KeyboardEvent | React.PointerEvent) => {
      e.stopPropagation();
    },
    []
  );

  if (!mounted || !localPosition) return null;

  // Hide the static icon when command palette is open
  const showStaticIcon = !commandPaletteOpen;

  const content = (
    <div
      data-ui-lint
      onPointerDown={handleUILintInteraction}
      onKeyDown={handleUILintInteraction}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 99999,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        pointerEvents: "none",
      }}
    >
      {/* Static floating icon button */}
      <AnimatePresence>
        {showStaticIcon && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "fixed",
              left: `${localPosition.x}px`,
              top: `${localPosition.y}px`,
              transform: "translate(-50%, -50%)",
              transition: isDragging ? "none" : "left 0.1s ease, top 0.1s ease",
            }}
          >
            <button
              ref={buttonRef}
              type="button"
              onMouseDown={handleMouseDown}
              className={cn(
                "relative flex items-center gap-2 px-3 py-2.5 rounded-full",
                "bg-backdrop",
                "backdrop-blur-xl",
                "border border-border",
                "shadow-lg",
                "text-foreground",
                "hover:bg-surface-elevated",
                "transition-all duration-200",
                "group",
                isDragging && "cursor-grabbing scale-105",
                !isDragging && "cursor-grab"
              )}
              style={{ pointerEvents: "auto" }}
              aria-label="Open command palette (drag to move)"
            >
              {/* Logo/Icon with scanning animation */}
              <div className="relative">
                <Icons.Scan
                  className={cn(
                    "w-4 h-4",
                    liveScanEnabled && "text-success",
                    !wsConnected && "text-muted-foreground"
                  )}
                />
                {/* Scanning pulse animation */}
                {liveScanEnabled && (
                  <span
                    className={cn(
                      "absolute inset-0 rounded-full",
                      "bg-success/30",
                      "animate-ping"
                    )}
                    style={{ animationDuration: "2s" }}
                  />
                )}
              </div>

              {/* Issue badge */}
              {totalIssueCount > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center",
                    "min-w-[18px] h-[18px] px-1",
                    "text-[10px] font-semibold",
                    "rounded-full",
                    "bg-warning-bg",
                    "text-warning"
                  )}
                >
                  {totalIssueCount > 99 ? "99+" : totalIssueCount}
                </span>
              )}

              {/* Shortcut hint */}
              <kbd
                className={cn(
                  "px-1.5 py-0.5 rounded",
                  "bg-muted",
                  "text-[10px] font-medium text-muted-foreground",
                  "opacity-60 group-hover:opacity-100 transition-opacity"
                )}
              >
                {shortcutKey}K
              </kbd>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Region selector overlay */}
      <RegionSelector
        active={regionSelectionActive}
        onRegionSelected={handleRegionSelected}
        onCancel={handleRegionCancel}
      />
    </div>
  );

  return createPortal(content, getUILintPortalHost());
}
