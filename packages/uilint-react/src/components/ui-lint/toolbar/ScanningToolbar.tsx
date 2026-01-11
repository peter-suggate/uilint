"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "../UILintProvider";
import { useUILintStore, type UILintStore } from "../store";
import { Badge } from "../Badge";
import { PillContainer, Divider, Kbd } from "./shared";
import { TOKENS } from "./tokens";
import { Icons } from "./icons";
import { CaptureModePopover } from "./CaptureModePopover";

export function ScanningToolbar() {
  const { autoScanState, disableLiveScan } = useUILintContext();

  // Store state
  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );
  const fileIssuesCache = useUILintStore((s: UILintStore) => s.fileIssuesCache);
  const showResults = useUILintStore((s: UILintStore) => s.showResultsPanel);
  const setShowResults = useUILintStore(
    (s: UILintStore) => s.setShowResultsPanel
  );
  const visionAnalyzing = useUILintStore((s: UILintStore) => s.visionAnalyzing);
  const visionProgressPhase = useUILintStore(
    (s: UILintStore) => s.visionProgressPhase
  );
  const visionLastError = useUILintStore((s: UILintStore) => s.visionLastError);
  const visionIssuesCache = useUILintStore(
    (s: UILintStore) => s.visionIssuesCache
  );
  const triggerVisionAnalysis = useUILintStore(
    (s: UILintStore) => s.triggerVisionAnalysis
  );
  const captureMode = useUILintStore((s: UILintStore) => s.captureMode);
  const regionSelectionActive = useUILintStore(
    (s: UILintStore) => s.regionSelectionActive
  );
  const setRegionSelectionActive = useUILintStore(
    (s: UILintStore) => s.setRegionSelectionActive
  );
  const setSelectedRegion = useUILintStore(
    (s: UILintStore) => s.setSelectedRegion
  );

  // Local state
  const [showCaptureModePopover, setShowCaptureModePopover] = useState(false);
  const captureModePopoverRef = useRef<HTMLDivElement | null>(null);
  const captureModeAnchorRef = useRef<HTMLDivElement | null>(null);
  const [captureModePopoverPos, setCaptureModePopoverPos] = useState<{
    left: number;
    bottom: number;
  } | null>(null);

  // Derived state
  const isScanning =
    autoScanState.status === "scanning" || autoScanState.status === "paused";

  // Count issues
  let elementIssues = 0;
  elementIssuesCache.forEach((el) => {
    elementIssues += el.issues.length;
  });

  let fileLevelIssues = 0;
  fileIssuesCache.forEach((issues) => {
    fileLevelIssues += issues.length;
  });

  let visionIssueCount = 0;
  visionIssuesCache.forEach((issues) => {
    visionIssueCount += issues.length;
  });

  const totalIssues = elementIssues + fileLevelIssues;
  const hasIssues = totalIssues > 0 || visionIssueCount > 0;
  const hasVisionError = !!visionLastError?.message;

  // Get icon and label for current capture mode
  const CaptureModeIcon = captureMode === "full" ? Icons.Camera : Icons.Crop;
  const captureModeLabel = captureMode === "full" ? "Full" : "Region";

  // Handlers
  const handleStopScan = useCallback(() => {
    disableLiveScan();
    setShowResults(false);
  }, [disableLiveScan, setShowResults]);

  const handleToggleResults = useCallback(() => {
    setShowResults(!showResults);
  }, [showResults, setShowResults]);

  const handleVisionAnalyze = useCallback(() => {
    // If region mode is selected, activate region selector
    if (captureMode === "region") {
      setRegionSelectionActive(true);
    } else {
      // Full page mode - trigger analysis directly
      triggerVisionAnalysis();
    }
  }, [captureMode, setRegionSelectionActive, triggerVisionAnalysis]);

  const handleToggleCaptureModePopover = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCaptureModePopover((prev) => {
      const next = !prev;
      if (next) {
        const rect = captureModeAnchorRef.current?.getBoundingClientRect();
        if (rect) {
          setCaptureModePopoverPos({
            left: rect.left,
            // place the popover just above the anchor, with an 8px gap
            bottom: window.innerHeight - rect.top + 8,
          });
        }
      }
      return next;
    });
  }, []);

  const handleCloseCaptureModePopover = useCallback(() => {
    setShowCaptureModePopover(false);
  }, []);

  // Close popover on outside click
  useEffect(() => {
    if (!showCaptureModePopover) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;

      const isInsidePopover = captureModePopoverRef.current?.contains(
        target as Node
      );
      const isCaptureModeButton = target.closest(
        "button[aria-label='Select capture mode']"
      );

      if (!isInsidePopover && !isCaptureModeButton) {
        setShowCaptureModePopover(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowCaptureModePopover(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showCaptureModePopover]);

  // Keep popover positioned if the viewport changes
  useEffect(() => {
    if (!showCaptureModePopover) return;

    const updatePos = () => {
      const rect = captureModeAnchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCaptureModePopoverPos({
        left: rect.left,
        bottom: window.innerHeight - rect.top + 8,
      });
    };

    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [showCaptureModePopover]);

  // Determine status display
  const getStatusContent = () => {
    if (isScanning) {
      return (
        <>
          <div className="uilint-scanning-dot" />
          <span style={{ fontFamily: TOKENS.fontMono, fontSize: "12px" }}>
            Scanning...
          </span>
        </>
      );
    }

    if (hasIssues) {
      return (
        <>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: `${TOKENS.warning}20`,
              color: TOKENS.warning,
            }}
          >
            <Icons.AlertTriangle />
          </span>
          <Badge count={totalIssues + visionIssueCount} />
        </>
      );
    }

    return (
      <>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            backgroundColor: `${TOKENS.success}20`,
            color: TOKENS.success,
          }}
        >
          <Icons.Check />
        </span>
        <span
          style={{ fontSize: "12px", fontWeight: 500, color: TOKENS.success }}
        >
          All clear
        </span>
      </>
    );
  };

  const statusVariant = hasIssues
    ? "warning"
    : isScanning
    ? "accent"
    : "success";
  const glowColor = hasIssues ? `${TOKENS.warning}25` : undefined;

  return (
    <div
      className="uilint-scanning-bar"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
      }}
    >
      {/* Status pill */}
      <PillContainer glow={glowColor}>
        {/* Status dropdown trigger */}
        <button
          className={`uilint-btn uilint-btn--${statusVariant}`}
          onClick={handleToggleResults}
          title={
            hasIssues
              ? `${totalIssues + visionIssueCount} issue${
                  totalIssues + visionIssueCount !== 1 ? "s" : ""
                } found`
              : "View scan results"
          }
          aria-label="Toggle scan results"
          aria-expanded={showResults}
          style={{ paddingRight: "10px" }}
        >
          {getStatusContent()}
          <Icons.ChevronDown />
        </button>

        <Divider />

        {/* Vision capture button with mode selector */}
        <div
          ref={captureModeAnchorRef}
          style={{ position: "relative", display: "flex" }}
        >
          {/* Main capture button */}
          <button
            className={`uilint-btn ${
              visionAnalyzing ? "uilint-btn--accent" : ""
            }`}
            style={{
              paddingLeft: "12px",
              paddingRight: "8px",
              ...(!visionAnalyzing &&
                hasVisionError && {
                  color: TOKENS.error,
                  backgroundColor: `${TOKENS.error}12`,
                }),
            }}
            onClick={handleVisionAnalyze}
            disabled={visionAnalyzing}
            title={
              visionAnalyzing
                ? visionProgressPhase || "Analyzing..."
                : hasVisionError
                ? `Last vision run failed (${visionLastError?.stage}): ${visionLastError?.message}`
                : `Capture ${captureModeLabel}`
            }
            aria-label={`Capture and analyze page with vision (${captureModeLabel} mode)`}
          >
            {visionAnalyzing ? <Icons.Spinner /> : <CaptureModeIcon />}
            <span style={{ fontSize: "12px" }}>{captureModeLabel}</span>
          </button>

          {/* Mode dropdown trigger */}
          <button
            className="uilint-btn"
            style={{
              paddingLeft: "6px",
              paddingRight: "8px",
              borderLeft: `1px solid ${TOKENS.border}`,
              minWidth: "24px",
            }}
            onClick={handleToggleCaptureModePopover}
            disabled={visionAnalyzing}
            title="Select capture mode"
            aria-label="Select capture mode"
            aria-expanded={showCaptureModePopover}
          >
            <Icons.ChevronDown />
          </button>
        </div>

        <Divider />

        {/* Stop button */}
        <button
          className="uilint-btn uilint-btn--icon"
          onClick={handleStopScan}
          title="Stop scanning (⌥S)"
          aria-label="Stop scanning"
        >
          <Icons.X />
        </button>
      </PillContainer>

      {/* Keyboard hint */}
      <Kbd>⌥ + Click an element</Kbd>

      {/* Capture mode popover (portal so it isn't clipped by the pill container) */}
      {showCaptureModePopover &&
        captureModePopoverPos &&
        createPortal(
          <div
            // Mark this as "inside" UILint for outside-click logic and styling
            data-ui-lint
            style={{
              position: "fixed",
              left: captureModePopoverPos.left,
              bottom: captureModePopoverPos.bottom,
              pointerEvents: "auto",
              zIndex: 100000,
            }}
          >
            <div
              ref={captureModePopoverRef}
              className="uilint-popover"
              onClick={(e) => e.stopPropagation()}
            >
              <CaptureModePopover onClose={handleCloseCaptureModePopover} />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
