"use client";

/**
 * UILint Toolbar - Segmented pill with Scan button and settings
 *
 * Design:
 * ┌─────────────────────────────────────┐
 * │  [🔍 Scan]  │  [...]               │
 * └─────────────────────────────────────┘
 *        ⌥+Click to inspect
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import { useUILintStore, type UILintStore } from "./store";
import { STYLES } from "./toolbar-styles";
import {
  MagnifyingGlassIcon,
  EllipsisIcon,
  SpinnerIcon,
  CheckCircleIcon,
} from "./toolbar-icons";
import { SettingsPopover } from "./SettingsPopover";
import { ScanResultsPopover } from "./ScanResultsPopover";
import { groupBySourceFile } from "./dom-utils";
import type { SourceFile, ScannedElement } from "./types";

/**
 * Main Toolbar Component - Segmented pill with Scan + Settings
 */
export function UILintToolbar() {
  const { settings, inspectedElement, autoScanState, startAutoScan } =
    useUILintContext();
  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );

  const [showSettings, setShowSettings] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mounted, setMounted] = useState(false);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (showSettings && settingsRef.current) {
        if (
          !settingsRef.current.contains(target) &&
          !toolbarRef.current?.contains(target)
        ) {
          setShowSettings(false);
        }
      }

      if (showResults && resultsRef.current) {
        if (
          !resultsRef.current.contains(target) &&
          !toolbarRef.current?.contains(target)
        ) {
          setShowResults(false);
        }
      }
    };

    if (showSettings || showResults) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSettings, showResults]);

  // Handle scan button click
  const handleScanClick = useCallback(() => {
    if (autoScanState.status === "idle") {
      startAutoScan();
      setShowResults(true);
    } else {
      // Toggle results popover
      setShowResults(!showResults);
    }
    setShowSettings(false);
  }, [autoScanState.status, startAutoScan, showResults]);

  // Handle settings button click
  const handleSettingsClick = useCallback(() => {
    setShowSettings(!showSettings);
    setShowResults(false);
  }, [showSettings]);

  if (!mounted) return null;

  // Hide toolbar when inspection panel is open
  if (inspectedElement) return null;

  // Calculate scan status
  const isScanning = autoScanState.status === "scanning";
  const isPaused = autoScanState.status === "paused";
  const isComplete = autoScanState.status === "complete";
  const hasResults = autoScanState.status !== "idle";

  // Calculate total issues
  let totalIssues = 0;
  elementIssuesCache.forEach((el) => {
    totalIssues += el.issues.length;
  });

  // Calculate files with issues
  const sourceFiles: SourceFile[] = hasResults
    ? groupBySourceFile(autoScanState.elements)
    : [];
  const filesWithIssues = sourceFiles.filter((sf: SourceFile) => {
    const issues = sf.elements.reduce((sum: number, el: ScannedElement) => {
      const cached = elementIssuesCache.get(el.id);
      return sum + (cached?.issues.length || 0);
    }, 0);
    return issues > 0;
  }).length;

  // Get scan button content
  const getScanButtonContent = () => {
    if (isScanning) {
      return (
        <>
          <SpinnerIcon />
          <span>Scanning...</span>
        </>
      );
    }

    if (isPaused) {
      return (
        <>
          <MagnifyingGlassIcon />
          <span>Paused</span>
        </>
      );
    }

    if (isComplete) {
      return (
        <>
          <CheckCircleIcon />
          <span>
            {totalIssues === 0 ? "All clear" : `${totalIssues} issues`}
          </span>
        </>
      );
    }

    return (
      <>
        <MagnifyingGlassIcon />
        <span>Scan</span>
      </>
    );
  };

  const content = (
    <div
      data-ui-lint
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 99999,
        fontFamily: STYLES.font,
      }}
    >
      <style>{`
        @keyframes uilint-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes uilint-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Hint text */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "8px",
          fontSize: "11px",
          color: STYLES.textDim,
          letterSpacing: "0.01em",
        }}
      >
        <span style={{ color: STYLES.textMuted }}>⌥+Click</span> to inspect
      </div>

      {/* Toolbar pill */}
      <div
        ref={toolbarRef}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          height: STYLES.pillHeight,
          borderRadius: STYLES.pillRadius,
          border: `1px solid ${STYLES.border}`,
          backgroundColor: STYLES.bg,
          backdropFilter: STYLES.blur,
          WebkitBackdropFilter: STYLES.blur,
          boxShadow: STYLES.shadow,
          overflow: "hidden",
        }}
      >
        {/* Scan button segment */}
        <button
          onClick={handleScanClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            height: "100%",
            padding: "0 16px",
            border: "none",
            backgroundColor:
              showResults || hasResults ? STYLES.bgSegmentHover : "transparent",
            color: hasResults
              ? totalIssues > 0
                ? STYLES.warning
                : STYLES.success
              : STYLES.text,
            fontSize: "13px",
            fontWeight: 500,
            fontFamily: STYLES.font,
            cursor: "pointer",
            transition: STYLES.transition,
          }}
          onMouseEnter={(e) => {
            if (!showResults && !hasResults) {
              e.currentTarget.style.backgroundColor = STYLES.bgSegmentHover;
            }
          }}
          onMouseLeave={(e) => {
            if (!showResults && !hasResults) {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
          title={
            hasResults
              ? `${sourceFiles.length} files scanned, ${totalIssues} issues found`
              : "Scan page for style issues"
          }
        >
          {getScanButtonContent()}

          {/* Badge for files with issues */}
          {isComplete && filesWithIssues > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "18px",
                height: "18px",
                padding: "0 5px",
                borderRadius: "9px",
                backgroundColor: STYLES.error,
                color: STYLES.badgeText,
                fontSize: "10px",
                fontWeight: 700,
              }}
            >
              {filesWithIssues}
            </span>
          )}
        </button>

        {/* Divider */}
        <div
          style={{
            width: "1px",
            height: "20px",
            backgroundColor: STYLES.divider,
          }}
        />

        {/* Settings button segment */}
        <button
          onClick={handleSettingsClick}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "40px",
            border: "none",
            backgroundColor: showSettings
              ? STYLES.bgSegmentHover
              : "transparent",
            color: showSettings ? STYLES.text : STYLES.textMuted,
            cursor: "pointer",
            transition: STYLES.transition,
          }}
          onMouseEnter={(e) => {
            if (!showSettings) {
              e.currentTarget.style.backgroundColor = STYLES.bgSegmentHover;
              e.currentTarget.style.color = STYLES.text;
            }
          }}
          onMouseLeave={(e) => {
            if (!showSettings) {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = STYLES.textMuted;
            }
          }}
          title="Settings"
        >
          <EllipsisIcon />
        </button>
      </div>

      {/* Settings popover */}
      {showSettings && (
        <div ref={settingsRef}>
          <SettingsPopover settings={settings} />
        </div>
      )}

      {/* Results popover */}
      {showResults && hasResults && (
        <div ref={resultsRef}>
          <ScanResultsPopover />
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
