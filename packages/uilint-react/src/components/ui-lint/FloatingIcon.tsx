"use client";

/**
 * FloatingIcon - Minimal floating trigger for command palette
 *
 * Features:
 * - Small icon with scanning animation when active
 * - Cmd+K shortcut hint
 * - Click to open command palette
 * - Respects data-position attribute for placement
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useUILintStore, type UILintStore } from "./store";
import { getUILintPortalHost } from "./portal-host";
import { cn } from "@/lib/utils";
import { Icons } from "./command-palette/icons";
import { RegionSelector, type SelectedRegion } from "./RegionSelector";

export function FloatingIcon() {
  const openCommandPalette = useUILintStore((s) => s.openCommandPalette);
  const wsConnected = useUILintStore((s) => s.wsConnected);
  const liveScanEnabled = useUILintStore((s) => s.liveScanEnabled);
  const regionSelectionActive = useUILintStore((s) => s.regionSelectionActive);
  const setRegionSelectionActive = useUILintStore((s) => s.setRegionSelectionActive);
  const setSelectedRegion = useUILintStore((s) => s.setSelectedRegion);
  const setCaptureMode = useUILintStore((s) => s.setCaptureMode);
  const triggerVisionAnalysis = useUILintStore((s) => s.triggerVisionAnalysis);

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
  const [nextjsOverlayVisible, setNextjsOverlayVisible] = useState(false);

  // Platform detection for shortcut display
  const isMac =
    typeof navigator !== "undefined" && navigator.platform?.includes("Mac");
  const shortcutKey = isMac ? "⌘" : "Ctrl+";

  // Detect Next.js overlay
  useEffect(() => {
    const checkForNextOverlay = () => {
      const overlaySelectors = [
        "nextjs-portal",
        "[data-nextjs-dialog]",
        "[data-nextjs-dialog-overlay]",
        "#__next-build-watcher",
        "[data-nextjs-toast]",
      ];

      const hasOverlay = overlaySelectors.some((selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden";
      });

      setNextjsOverlayVisible(hasOverlay);
    };

    checkForNextOverlay();
    const observer = new MutationObserver(checkForNextOverlay);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    return () => observer.disconnect();
  }, []);

  // Mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Prevent event propagation
  const handleUILintInteraction = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent | React.PointerEvent) => {
      e.stopPropagation();
    },
    []
  );

  if (!mounted) return null;

  const bottomPosition = nextjsOverlayVisible ? "80px" : "20px";
  const devtoolPosition =
    typeof document !== "undefined"
      ? (document
          .querySelector<HTMLElement>(".dev-tool-root")
          ?.getAttribute("data-position") as
          | "bottom-left"
          | "bottom-right"
          | "top-left"
          | "top-right"
          | null) ?? "bottom-left"
      : "bottom-left";

  const content = (
    <div
      data-ui-lint
      onMouseDown={handleUILintInteraction}
      onPointerDown={handleUILintInteraction}
      onClick={handleUILintInteraction}
      onKeyDown={handleUILintInteraction}
      style={{
        position: "fixed",
        ...(devtoolPosition.startsWith("top")
          ? { top: "20px", bottom: "auto" }
          : { bottom: bottomPosition, top: "auto" }),
        ...(devtoolPosition.endsWith("right")
          ? { right: "20px", left: "auto" }
          : { left: "20px", right: "auto" }),
        zIndex: 99999,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        transition: "bottom 0.3s ease",
        pointerEvents: "none",
      }}
    >
      {/* Floating icon button */}
      <button
        type="button"
        onClick={() => openCommandPalette()}
        className={cn(
          "relative flex items-center gap-2 px-3 py-2.5 rounded-full",
          "bg-white/80 dark:bg-zinc-900/80",
          "backdrop-blur-xl",
          "border border-white/30 dark:border-white/10",
          "shadow-lg shadow-black/10 dark:shadow-black/30",
          "text-zinc-700 dark:text-zinc-200",
          "hover:bg-white dark:hover:bg-zinc-800",
          "transition-all duration-200",
          "group"
        )}
        style={{ pointerEvents: "auto" }}
        aria-label="Open command palette"
      >
        {/* Logo/Icon with scanning animation */}
        <div className="relative">
          <Icons.Scan
            className={cn(
              "w-4 h-4",
              liveScanEnabled && "text-emerald-500",
              !wsConnected && "text-zinc-400"
            )}
          />
          {/* Scanning pulse animation */}
          {liveScanEnabled && (
            <span
              className={cn(
                "absolute inset-0 rounded-full",
                "bg-emerald-400/30 dark:bg-emerald-500/20",
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
              "bg-amber-100 dark:bg-amber-900/50",
              "text-amber-700 dark:text-amber-300"
            )}
          >
            {totalIssueCount > 99 ? "99+" : totalIssueCount}
          </span>
        )}

        {/* Shortcut hint */}
        <kbd
          className={cn(
            "px-1.5 py-0.5 rounded",
            "bg-zinc-100/80 dark:bg-zinc-800/80",
            "text-[10px] font-medium text-zinc-500 dark:text-zinc-400",
            "opacity-60 group-hover:opacity-100 transition-opacity"
          )}
        >
          {shortcutKey}K
        </kbd>
      </button>

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
