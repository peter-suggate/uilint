"use client";

/**
 * UILint Toolbar - Improved UX Version
 *
 * Key improvements:
 * - Clear visual hierarchy: Primary (toggle) → Secondary (issues) → Tertiary (settings)
 * - Contextual hints that only show when relevant
 * - CSS-based hover/focus states (no inline handlers)
 * - Full keyboard navigation with visible focus rings
 * - Smooth animations for all state changes
 * - Better disabled state communication
 * - Expanded panel that doesn't conflict with settings
 * - Touch-friendly targets (min 44px)
 * - ARIA labels and semantic markup
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import { useUILintStore, type UILintStore } from "./store";
import { SettingsPopover } from "./SettingsPopover";
import { ScanPanelStack } from "./ScanPanelStack";
import { Badge, BADGE_COLORS } from "./Badge";

// ============================================================================
// Design Tokens - Cohesive dark glass aesthetic
// ============================================================================
const TOKENS = {
  // Colors
  bgBase: "rgba(15, 15, 15, 0.85)",
  bgElevated: "rgba(25, 25, 25, 0.95)",
  bgHover: "rgba(255, 255, 255, 0.08)",
  bgActive: "rgba(255, 255, 255, 0.12)",

  border: "rgba(255, 255, 255, 0.1)",
  borderFocus: "rgba(99, 179, 237, 0.6)",

  textPrimary: "rgba(255, 255, 255, 0.95)",
  textSecondary: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.4)",
  textDisabled: "rgba(255, 255, 255, 0.25)",

  accent: "#63b3ed", // Calm blue
  success: BADGE_COLORS.success, // Soft green (shared with Badge)
  warning: BADGE_COLORS.warning, // Warm orange (shared with Badge)

  // Typography
  fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
  fontMono: `"SF Mono", Monaco, "Cascadia Code", monospace`,

  // Sizing
  pillHeight: "44px", // Touch-friendly
  pillRadius: "22px",
  buttonMinWidth: "44px", // Touch target minimum

  // Effects
  blur: "blur(20px)",
  shadowSm: "0 2px 8px rgba(0, 0, 0, 0.3)",
  shadowMd: "0 4px 20px rgba(0, 0, 0, 0.4)",
  shadowGlow: (color: string) => `0 0 20px ${color}`,

  // Animation
  transitionFast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
  transitionBase: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  transitionSlow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

// ============================================================================
// Icons - Refined, consistent weight
// ============================================================================
const Icons = {
  Eye: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  Scan: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  ),
  Check: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Settings: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  ChevronRight: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
};

// ============================================================================
// Styles - CSS-in-JS with proper pseudo-selectors via CSS string
// ============================================================================
const globalStyles = `
  @keyframes uilint-fade-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  
  @keyframes uilint-fade-out {
    from { opacity: 1; transform: translateY(0) scale(1); }
    to { opacity: 0; transform: translateY(8px) scale(0.98); }
  }
  
  @keyframes uilint-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  @keyframes uilint-scan-line {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  @keyframes uilint-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .uilint-toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    border: none;
    background: transparent;
    color: ${TOKENS.textSecondary};
    cursor: pointer;
    transition: 
      background-color ${TOKENS.transitionFast},
      color ${TOKENS.transitionFast},
      transform ${TOKENS.transitionFast};
    outline: none;
    position: relative;
  }
  
  .uilint-toolbar-btn:hover:not(:disabled) {
    background: ${TOKENS.bgHover};
    color: ${TOKENS.textPrimary};
  }
  
  .uilint-toolbar-btn:active:not(:disabled) {
    background: ${TOKENS.bgActive};
    transform: scale(0.97);
  }
  
  .uilint-toolbar-btn:focus-visible {
    box-shadow: inset 0 0 0 2px ${TOKENS.borderFocus};
  }
  
  .uilint-toolbar-btn:disabled {
    cursor: not-allowed;
    color: ${TOKENS.textDisabled};
  }
  
  .uilint-toolbar-btn--active {
    background: ${TOKENS.bgActive} !important;
    color: ${TOKENS.accent} !important;
  }
  
  .uilint-toolbar-btn--warning {
    color: ${TOKENS.warning} !important;
  }
  
  .uilint-toolbar-btn--success {
    color: ${TOKENS.success} !important;
  }
  
  .uilint-hint {
    opacity: 0;
    transform: translateY(4px);
    transition: 
      opacity ${TOKENS.transitionBase},
      transform ${TOKENS.transitionBase};
    pointer-events: none;
  }
  
  .uilint-hint--visible {
    opacity: 1;
    transform: translateY(0);
  }
  
  .uilint-scanning-indicator {
    position: relative;
    overflow: hidden;
  }
  
  .uilint-scanning-indicator::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(99, 179, 237, 0.3),
      transparent
    );
    animation: uilint-scan-line 1.5s ease-in-out infinite;
  }
  
  .uilint-popover {
    animation: uilint-fade-in ${TOKENS.transitionSlow} forwards;
  }
  
  .uilint-popover--closing {
    animation: uilint-fade-out ${TOKENS.transitionBase} forwards;
  }
  
  /* Custom scrollbar styling for dark mode - scoped to uilint components */
  [data-ui-lint] *,
  [data-ui-lint] {
    /* Firefox */
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) rgba(15, 15, 15, 0.3);
  }
  
  /* WebKit browsers (Chrome, Safari, Edge) */
  [data-ui-lint] *::-webkit-scrollbar,
  [data-ui-lint]::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  [data-ui-lint] *::-webkit-scrollbar-track,
  [data-ui-lint]::-webkit-scrollbar-track {
    background: rgba(15, 15, 15, 0.3);
    border-radius: 4px;
  }
  
  [data-ui-lint] *::-webkit-scrollbar-thumb,
  [data-ui-lint]::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    border: 1px solid rgba(15, 15, 15, 0.2);
    transition: background ${TOKENS.transitionFast};
  }
  
  [data-ui-lint] *::-webkit-scrollbar-thumb:hover,
  [data-ui-lint]::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
  }
  
  [data-ui-lint] *::-webkit-scrollbar-thumb:active,
  [data-ui-lint]::-webkit-scrollbar-thumb:active {
    background: rgba(255, 255, 255, 0.35);
  }
  
  [data-ui-lint] *::-webkit-scrollbar-corner,
  [data-ui-lint]::-webkit-scrollbar-corner {
    background: rgba(15, 15, 15, 0.3);
  }
`;

// ============================================================================
// Sub-components
// ============================================================================

interface ToolbarButtonProps {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: "default" | "warning" | "success";
  title: string;
  ariaLabel: string;
  width?: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  disabled,
  active,
  variant = "default",
  title,
  ariaLabel,
  width = TOKENS.buttonMinWidth,
  children,
}: ToolbarButtonProps) {
  const classes = [
    "uilint-toolbar-btn",
    active && "uilint-toolbar-btn--active",
    variant === "warning" && "uilint-toolbar-btn--warning",
    variant === "success" && "uilint-toolbar-btn--success",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={classes}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active}
      style={{ minWidth: width }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: "1px",
        height: "20px",
        backgroundColor: TOKENS.border,
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
}

interface ScanStatusProps {
  status: "idle" | "scanning" | "paused" | "complete";
  issueCount: number;
  enabled: boolean;
}

function ScanStatus({ status, issueCount, enabled }: ScanStatusProps) {
  if (!enabled) {
    return (
      <span
        style={{
          fontSize: "12px",
          color: TOKENS.textDisabled,
          fontStyle: "italic",
        }}
      >
        Off
      </span>
    );
  }

  if (status === "scanning" || status === "paused") {
    return (
      <span
        className="uilint-scanning-indicator"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "0 4px",
        }}
      >
        <Icons.Scan />
        <span
          style={{
            fontSize: "12px",
            fontFamily: TOKENS.fontMono,
            animation: `uilint-pulse 1s ease-in-out infinite`,
          }}
        >
          Scanning
        </span>
      </span>
    );
  }

  if (issueCount === 0) {
    return (
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            backgroundColor: `${TOKENS.success}20`,
            color: TOKENS.success,
          }}
        >
          <Icons.Check />
        </span>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: TOKENS.success,
          }}
        >
          Clear
        </span>
      </span>
    );
  }

  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          backgroundColor: `${TOKENS.warning}20`,
          color: TOKENS.warning,
        }}
      >
        <Icons.AlertTriangle />
      </span>
      <Badge count={issueCount} />
    </span>
  );
}

// ============================================================================
// Main Toolbar Component
// ============================================================================
export function UILintToolbar() {
  const {
    settings,
    liveScanEnabled,
    autoScanState,
    enableLiveScan,
    disableLiveScan,
  } = useUILintContext();

  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );

  const fileIssuesCache = useUILintStore((s: UILintStore) => s.fileIssuesCache);

  // Local state
  const [showSettings, setShowSettings] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [nextjsOverlayVisible, setNextjsOverlayVisible] = useState(false);

  // Refs
  const toolbarRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Detect Next.js error overlay presence
  useEffect(() => {
    const checkForNextOverlay = () => {
      // Next.js uses these selectors for error overlays
      const overlaySelectors = [
        "nextjs-portal",
        "[data-nextjs-dialog]",
        "[data-nextjs-dialog-overlay]",
        "#__next-build-watcher",
        "[data-nextjs-toast]",
      ];

      const hasOverlay = overlaySelectors.some((selector) => {
        const el = document.querySelector(selector);
        // Check if element exists and is visible
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden";
      });

      setNextjsOverlayVisible(hasOverlay);
    };

    // Check immediately
    checkForNextOverlay();

    // Watch for DOM changes (Next.js injects overlay dynamically)
    const observer = new MutationObserver(checkForNextOverlay);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    return () => observer.disconnect();
  }, []);

  // Derived state
  const isScanning = autoScanState.status === "scanning";
  const isComplete = autoScanState.status === "complete";

  // Count element-level issues
  let elementIssues = 0;
  elementIssuesCache.forEach((el) => {
    elementIssues += el.issues.length;
  });

  // Count file-level issues
  let fileLevelIssues = 0;
  fileIssuesCache.forEach((issues) => {
    fileLevelIssues += issues.length;
  });

  const totalIssues = elementIssues + fileLevelIssues;
  const hasIssues = totalIssues > 0;

  // Mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element | null;

      // Don't close if clicking on any UILint element (prevents dismissing app popovers)
      if (target?.closest?.("[data-ui-lint]")) {
        return;
      }

      if (showSettings && settingsRef.current && toolbarRef.current) {
        if (
          !settingsRef.current.contains(target as Node) &&
          !toolbarRef.current.contains(target as Node)
        ) {
          handleCloseSettings();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      // Don't handle Escape if it's being used by app (e.g., closing app modal)
      // Only handle if UILint UI is actually open
      if (e.key === "Escape") {
        if (showSettings) handleCloseSettings();
        if (showResults) setShowResults(false);
      }
    };

    // Use capture phase to check before app handlers, but still allow app to see the event
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showSettings, showResults]);

  // Handlers
  const handleToggleClick = useCallback(() => {
    if (liveScanEnabled) {
      disableLiveScan();
      setShowResults(false);
    } else {
      enableLiveScan();
    }
    if (showSettings) handleCloseSettings();
  }, [liveScanEnabled, enableLiveScan, disableLiveScan, showSettings]);

  const handleIssuesClick = useCallback(() => {
    if (!liveScanEnabled) {
      // If not enabled, clicking issues should enable scanning
      enableLiveScan();
      return;
    }
    setShowResults((prev) => !prev);
  }, [liveScanEnabled, enableLiveScan]);

  const handleSettingsClick = useCallback(() => {
    if (showSettings) {
      handleCloseSettings();
    } else {
      setShowSettings(true);
      setShowResults(false);
    }
  }, [showSettings]);

  const handleCloseSettings = useCallback(() => {
    setSettingsClosing(true);
    setTimeout(() => {
      setShowSettings(false);
      setSettingsClosing(false);
    }, 150);
  }, []);

  // Event handlers to prevent UILint interactions from propagating to the app
  const handleUILintInteraction = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
    },
    []
  );

  if (!mounted) return null;

  // Determine button variants
  const issueVariant = !liveScanEnabled
    ? "default"
    : hasIssues
    ? "warning"
    : isComplete
    ? "success"
    : "default";

  // Calculate bottom position - move up when Next.js overlay is visible
  const bottomPosition = nextjsOverlayVisible ? "80px" : "20px";

  const content = (
    <div
      data-ui-lint
      onMouseDown={handleUILintInteraction}
      onClick={handleUILintInteraction}
      onKeyDown={handleUILintInteraction}
      style={{
        position: "fixed",
        bottom: bottomPosition,
        left: "20px",
        zIndex: 99999,
        fontFamily: TOKENS.fontFamily,
        transition: `bottom ${TOKENS.transitionSlow}`,
        pointerEvents: "none", // Allow clicks to pass through empty space
      }}
    >
      <style>{globalStyles}</style>

      {/* Contextual hint - only shows when live scan is enabled */}
      <div
        className={`uilint-hint ${
          liveScanEnabled ? "uilint-hint--visible" : ""
        }`}
        style={{
          textAlign: "center",
          marginBottom: "10px",
          fontSize: "11px",
          color: TOKENS.textMuted,
          letterSpacing: "0.02em",
          pointerEvents: "auto", // Re-enable pointer events for hint
        }}
        aria-hidden={!liveScanEnabled}
      >
        <kbd
          style={{
            display: "inline-block",
            padding: "2px 5px",
            marginRight: "4px",
            borderRadius: "4px",
            backgroundColor: TOKENS.bgElevated,
            border: `1px solid ${TOKENS.border}`,
            fontSize: "10px",
            fontFamily: TOKENS.fontMono,
            color: TOKENS.textSecondary,
            boxShadow: `0 1px 3px rgba(0, 0, 0, 0.5)`,
          }}
        >
          ⌥ + Click to inspect element
        </kbd>
      </div>

      {/* Main toolbar pill */}
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="UI Lint toolbar"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          height: TOKENS.pillHeight,
          borderRadius: TOKENS.pillRadius,
          border: `1px solid ${TOKENS.border}`,
          backgroundColor: TOKENS.bgBase,
          backdropFilter: TOKENS.blur,
          WebkitBackdropFilter: TOKENS.blur,
          boxShadow:
            liveScanEnabled && hasIssues
              ? `${TOKENS.shadowMd}, ${TOKENS.shadowGlow(
                  `${TOKENS.warning}30`
                )}`
              : TOKENS.shadowMd,
          overflow: "hidden",
          transition: `box-shadow ${TOKENS.transitionBase}`,
          pointerEvents: "auto", // Re-enable pointer events for interactive toolbar
        }}
      >
        {/* Toggle button - Primary action */}
        <ToolbarButton
          onClick={handleToggleClick}
          active={liveScanEnabled}
          title={liveScanEnabled ? "Stop scanning (⌥S)" : "Start scanning (⌥S)"}
          ariaLabel={
            liveScanEnabled ? "Stop live scanning" : "Start live scanning"
          }
          width="48px"
        >
          {liveScanEnabled ? <Icons.Eye /> : <Icons.EyeOff />}
        </ToolbarButton>

        <Divider />

        {/* Issues button - Shows status, opens panel */}
        <ToolbarButton
          onClick={handleIssuesClick}
          active={showResults && liveScanEnabled}
          variant={issueVariant}
          title={
            !liveScanEnabled
              ? "Click to enable scanning"
              : `${totalIssues} issue${totalIssues !== 1 ? "s" : ""} found`
          }
          ariaLabel={
            !liveScanEnabled
              ? "Enable scanning to see issues"
              : `View ${totalIssues} issues`
          }
          width="auto"
        >
          <span style={{ padding: "0 12px" }}>
            <ScanStatus
              status={autoScanState.status}
              issueCount={totalIssues}
              enabled={liveScanEnabled}
            />
          </span>
        </ToolbarButton>

        <Divider />

        {/* Settings button - Tertiary */}
        <ToolbarButton
          onClick={handleSettingsClick}
          active={showSettings}
          title="Settings"
          ariaLabel="Open settings"
          width="44px"
        >
          <Icons.Settings />
        </ToolbarButton>
      </div>

      {/* Settings popover */}
      {showSettings && (
        <div
          ref={settingsRef}
          className={`uilint-popover ${
            settingsClosing ? "uilint-popover--closing" : ""
          }`}
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: "8px",
            pointerEvents: "auto", // Re-enable pointer events for popover
          }}
        >
          <SettingsPopover settings={settings} />
        </div>
      )}

      {/* Results panel - Now independent of settings */}
      <ScanPanelStack
        show={showResults && liveScanEnabled}
        onClose={() => setShowResults(false)}
      />
    </div>
  );

  return createPortal(content, document.body);
}
