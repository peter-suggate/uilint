"use client";

/**
 * UILint Toolbar - Main Orchestrator
 *
 * Three distinct modes:
 * 1. Disconnected: Minimal pill with settings only
 * 2. Connected/Idle: Two-segment pill (Start Scanning + Settings)
 * 3. Scanning: Compact floating UI with hint, status dropdown, and stop button
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "../UILintProvider";
import { useUILintStore } from "../store";
import { getUILintPortalHost } from "../portal-host";
import { RegionSelector, type SelectedRegion } from "../RegionSelector";
import { TabbedToolbar } from "./TabbedToolbar";
import { TOKENS } from "./tokens";

export function UILintToolbar() {
  const { settings } = useUILintContext();

  // Store state
  const wsConnected = useUILintStore((s) => s.wsConnected);
  const showResults = useUILintStore((s) => s.showResultsPanel);
  const setShowResults = useUILintStore((s) => s.setShowResultsPanel);
  const regionSelectionActive = useUILintStore((s) => s.regionSelectionActive);
  const setRegionSelectionActive = useUILintStore(
    (s) => s.setRegionSelectionActive
  );
  const setSelectedRegion = useUILintStore((s) => s.setSelectedRegion);
  const triggerVisionAnalysis = useUILintStore((s) => s.triggerVisionAnalysis);

  // Local state
  const [mounted, setMounted] = useState(false);
  const [nextjsOverlayVisible, setNextjsOverlayVisible] = useState(false);

  // Refs
  const toolbarRef = useRef<HTMLDivElement>(null);

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

  // Close popovers on outside click / escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showResults) setShowResults(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showResults, setShowResults]);

  // Handlers
  const handleRegionSelected = useCallback(
    (region: SelectedRegion) => {
      setRegionSelectionActive(false);
      // Store the selected region and trigger analysis
      setSelectedRegion(region);
      triggerVisionAnalysis();
    },
    [setRegionSelectionActive, setSelectedRegion, triggerVisionAnalysis]
  );

  const handleRegionCancel = useCallback(() => {
    setRegionSelectionActive(false);
    // Clear any previously selected region
    setSelectedRegion(null);
  }, [setRegionSelectionActive, setSelectedRegion]);

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
        fontFamily: TOKENS.fontFamily,
        transition: `bottom ${TOKENS.transitionSlow}`,
        pointerEvents: "none",
      }}
    >
      {/* Main toolbar area */}
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="UI Lint toolbar"
        style={{ pointerEvents: "auto" }}
      >
        <TabbedToolbar />
      </div>

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
