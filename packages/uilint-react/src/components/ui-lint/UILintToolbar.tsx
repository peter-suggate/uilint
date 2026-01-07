"use client";

/**
 * UILint Toolbar - Three-segment pill for live scanning
 *
 * Design:
 * ┌────────────────────────────────────────┐
 * │  [👁 Toggle]  │  [Issues]  │  [...]   │
 * └────────────────────────────────────────┘
 *              ⌥+Click to inspect
 *
 * Segments:
 * 1. Toggle: Enable/disable live scanning mode
 * 2. Issues: Show issue count, opens results panel
 * 3. Settings: Ellipsis for settings popover
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import { useUILintStore, type UILintStore } from "./store";
import { STYLES } from "./toolbar-styles";
import {
  EyeIcon,
  EyeOffIcon,
  EllipsisIcon,
  SpinnerIcon,
  WarningIcon,
  CheckCircleIcon,
} from "./toolbar-icons";
import { SettingsPopover } from "./SettingsPopover";
import { ScanPanelStack } from "./ScanPanelStack";

/**
 * Main Toolbar Component - Three-segment pill
 */
export function UILintToolbar() {
  const {
    settings,
    inspectedElement,
    liveScanEnabled,
    autoScanState,
    enableLiveScan,
    disableLiveScan,
  } = useUILintContext();

  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );

  const [showSettings, setShowSettings] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mounted, setMounted] = useState(false);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

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
    };

    if (showSettings) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSettings]);

  // Handle toggle button click
  const handleToggleClick = useCallback(() => {
    if (liveScanEnabled) {
      disableLiveScan();
      setShowResults(false);
    } else {
      enableLiveScan();
    }
    setShowSettings(false);
  }, [liveScanEnabled, enableLiveScan, disableLiveScan]);

  // Handle issues button click
  const handleIssuesClick = useCallback(() => {
    if (!liveScanEnabled) return;
    setShowResults(!showResults);
    setShowSettings(false);
  }, [liveScanEnabled, showResults]);

  // Handle settings button click
  const handleSettingsClick = useCallback(() => {
    setShowSettings(!showSettings);
    setShowResults(false);
  }, [showSettings]);

  if (!mounted) return null;

  // Calculate scan status
  const isScanning = autoScanState.status === "scanning";
  const isComplete = autoScanState.status === "complete";

  // Calculate total issues
  let totalIssues = 0;
  elementIssuesCache.forEach((el) => {
    totalIssues += el.issues.length;
  });

  const hasIssues = totalIssues > 0;

  // Get toggle button content
  const getToggleContent = () => {
    if (isScanning) {
      return <SpinnerIcon />;
    }
    if (liveScanEnabled) {
      return <EyeIcon />;
    }
    return <EyeOffIcon />;
  };

  // Get issues button content
  const getIssuesContent = () => {
    if (!liveScanEnabled) {
      return <span style={{ opacity: 0.5 }}>--</span>;
    }
    if (isScanning) {
      return <span style={{ opacity: 0.7 }}>...</span>;
    }
    if (hasIssues) {
      return (
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <WarningIcon />
          <span>{totalIssues}</span>
        </span>
      );
    }
    return (
      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <CheckCircleIcon />
        <span>0</span>
      </span>
    );
  };

  const content = (
    <div
      data-ui-lint
      style={{
        position: "fixed",
        bottom: "70px",
        left: "20px",
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
        {/* Toggle button segment */}
        <button
          onClick={handleToggleClick}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "40px",
            border: "none",
            backgroundColor: liveScanEnabled
              ? STYLES.bgSegmentHover
              : "transparent",
            color: liveScanEnabled ? STYLES.accent : STYLES.textMuted,
            cursor: "pointer",
            transition: STYLES.transition,
          }}
          onMouseEnter={(e) => {
            if (!liveScanEnabled) {
              e.currentTarget.style.backgroundColor = STYLES.bgSegmentHover;
              e.currentTarget.style.color = STYLES.text;
            }
          }}
          onMouseLeave={(e) => {
            if (!liveScanEnabled) {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = STYLES.textMuted;
            }
          }}
          title={
            liveScanEnabled ? "Disable live scanning" : "Enable live scanning"
          }
        >
          {getToggleContent()}
        </button>

        {/* Divider */}
        <div
          style={{
            width: "1px",
            height: "20px",
            backgroundColor: STYLES.divider,
          }}
        />

        {/* Issues button segment */}
        <button
          onClick={handleIssuesClick}
          disabled={!liveScanEnabled}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            height: "100%",
            padding: "0 12px",
            border: "none",
            backgroundColor:
              showResults && liveScanEnabled
                ? STYLES.bgSegmentHover
                : "transparent",
            color: !liveScanEnabled
              ? STYLES.textDim
              : hasIssues
              ? STYLES.warning
              : isComplete
              ? STYLES.success
              : STYLES.text,
            fontSize: "13px",
            fontWeight: 500,
            fontFamily: STYLES.font,
            cursor: liveScanEnabled ? "pointer" : "default",
            transition: STYLES.transition,
            opacity: liveScanEnabled ? 1 : 0.6,
          }}
          onMouseEnter={(e) => {
            if (liveScanEnabled && !showResults) {
              e.currentTarget.style.backgroundColor = STYLES.bgSegmentHover;
            }
          }}
          onMouseLeave={(e) => {
            if (liveScanEnabled && !showResults) {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
          title={
            liveScanEnabled
              ? `${totalIssues} issues found`
              : "Enable scanning to see issues"
          }
        >
          {getIssuesContent()}
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

      {/* Scan results panel stack */}
      <ScanPanelStack
        show={showResults && liveScanEnabled}
        onClose={() => setShowResults(false)}
      />
    </div>
  );

  return createPortal(content, document.body);
}
