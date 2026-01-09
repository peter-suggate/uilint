"use client";

/**
 * UILint Toolbar - Simplified Mode-Based Design
 *
 * Three distinct modes:
 * 1. Disconnected: Minimal pill with settings only
 * 2. Connected/Idle: Two-segment pill (Start Scanning + Settings)
 * 3. Scanning: Compact floating UI with hint, status dropdown, and stop button
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import { useUILintStore, type UILintStore } from "./store";
import { SettingsPopover } from "./SettingsPopover";
import { ScanPanelStack } from "./ScanPanelStack";
import { Badge, BADGE_COLORS } from "./Badge";

// ============================================================================
// Design Tokens
// ============================================================================
const TOKENS = {
  // Colors
  bgBase: "rgba(15, 15, 15, 0.92)",
  bgElevated: "rgba(25, 25, 25, 0.95)",
  bgHover: "rgba(255, 255, 255, 0.08)",
  bgActive: "rgba(255, 255, 255, 0.12)",

  border: "rgba(255, 255, 255, 0.1)",
  borderFocus: "rgba(99, 179, 237, 0.6)",

  textPrimary: "rgba(255, 255, 255, 0.95)",
  textSecondary: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.4)",
  textDisabled: "rgba(255, 255, 255, 0.25)",

  accent: "#63b3ed",
  success: BADGE_COLORS.success,
  warning: BADGE_COLORS.warning,
  error: "#f56565",

  fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
  fontMono: `"SF Mono", Monaco, "Cascadia Code", monospace`,

  pillHeight: "40px",
  pillRadius: "20px",
  buttonMinWidth: "40px",

  blur: "blur(16px)",
  shadowMd: "0 4px 20px rgba(0, 0, 0, 0.4)",
  shadowGlow: (color: string) => `0 0 16px ${color}`,

  transitionFast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
  transitionBase: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  transitionSlow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

// ============================================================================
// Icons
// ============================================================================
const Icons = {
  Eye: () => (
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
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Settings: () => (
    <svg
      width="15"
      height="15"
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
  Check: () => (
    <svg
      width="12"
      height="12"
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
      width="12"
      height="12"
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
  ChevronDown: () => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  X: () => (
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Unplug: () => (
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
      <path d="M19 5l3-3" />
      <path d="M2 22l3-3" />
      <path d="M6.3 6.3a10 10 0 0 1 13.4 1.3" />
      <path d="M17.7 17.7a10 10 0 0 1-13.4-1.3" />
      <path d="m8 15 8-8" />
    </svg>
  ),
  Scan: () => (
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
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  ),
};

// ============================================================================
// Global Styles
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
    50% { opacity: 0.6; }
  }
  
  @keyframes uilint-slide-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .uilint-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 100%;
    padding: 0 14px;
    border: none;
    background: transparent;
    color: ${TOKENS.textSecondary};
    font-family: ${TOKENS.fontFamily};
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: 
      background-color ${TOKENS.transitionFast},
      color ${TOKENS.transitionFast};
    outline: none;
    white-space: nowrap;
  }
  
  .uilint-btn:hover:not(:disabled) {
    background: ${TOKENS.bgHover};
    color: ${TOKENS.textPrimary};
  }
  
  .uilint-btn:active:not(:disabled) {
    background: ${TOKENS.bgActive};
  }
  
  .uilint-btn:focus-visible {
    box-shadow: inset 0 0 0 2px ${TOKENS.borderFocus};
  }
  
  .uilint-btn:disabled {
    cursor: not-allowed;
    color: ${TOKENS.textDisabled};
  }
  
  .uilint-btn--icon {
    padding: 0;
    min-width: ${TOKENS.buttonMinWidth};
  }
  
  .uilint-btn--primary {
    color: ${TOKENS.textPrimary};
  }
  
  .uilint-btn--accent {
    color: ${TOKENS.accent};
  }
  
  .uilint-btn--warning {
    color: ${TOKENS.warning};
  }
  
  .uilint-btn--success {
    color: ${TOKENS.success};
  }
  
  .uilint-popover {
    animation: uilint-fade-in ${TOKENS.transitionSlow} forwards;
  }
  
  .uilint-popover--closing {
    animation: uilint-fade-out ${TOKENS.transitionBase} forwards;
  }
  
  .uilint-scanning-bar {
    animation: uilint-slide-up ${TOKENS.transitionSlow} forwards;
  }
  
  .uilint-scanning-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${TOKENS.accent};
    animation: uilint-pulse 1.5s ease-in-out infinite;
  }

  /* Scrollbar styling */
  [data-ui-lint] * {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) rgba(15, 15, 15, 0.3);
  }
  
  [data-ui-lint] *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  [data-ui-lint] *::-webkit-scrollbar-track {
    background: rgba(15, 15, 15, 0.3);
    border-radius: 4px;
  }
  
  [data-ui-lint] *::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
  }
  
  [data-ui-lint] *::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
  }
`;

// ============================================================================
// Shared Components
// ============================================================================
const PillContainer = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    glow?: string;
    style?: React.CSSProperties;
  }
>(({ children, glow, style }, ref) => (
  <div
    ref={ref}
    style={{
      display: "inline-flex",
      alignItems: "center",
      height: TOKENS.pillHeight,
      borderRadius: TOKENS.pillRadius,
      border: `1px solid ${TOKENS.border}`,
      backgroundColor: TOKENS.bgBase,
      backdropFilter: TOKENS.blur,
      WebkitBackdropFilter: TOKENS.blur,
      boxShadow: glow
        ? `${TOKENS.shadowMd}, ${TOKENS.shadowGlow(glow)}`
        : TOKENS.shadowMd,
      overflow: "hidden",
      transition: `box-shadow ${TOKENS.transitionBase}`,
      ...style,
    }}
  >
    {children}
  </div>
));
PillContainer.displayName = "PillContainer";

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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 6px",
        borderRadius: "4px",
        backgroundColor: TOKENS.bgElevated,
        border: `1px solid ${TOKENS.border}`,
        fontSize: "11px",
        fontFamily: TOKENS.fontMono,
        color: TOKENS.textSecondary,
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
      }}
    >
      {children}
    </kbd>
  );
}

// ============================================================================
// Mode 1: Disconnected Toolbar
// ============================================================================
interface DisconnectedToolbarProps {
  onSettingsClick: () => void;
  showSettings: boolean;
}

function DisconnectedToolbar({
  onSettingsClick,
  showSettings,
}: DisconnectedToolbarProps) {
  return (
    <PillContainer>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "0 12px",
          color: TOKENS.textMuted,
          fontSize: "12px",
        }}
      >
        <Icons.Unplug />
        <span>Not connected</span>
      </div>
      <Divider />
      <button
        className={`uilint-btn uilint-btn--icon ${
          showSettings ? "uilint-btn--accent" : ""
        }`}
        onClick={onSettingsClick}
        title="Settings"
        aria-label="Open settings"
        aria-pressed={showSettings}
      >
        <Icons.Settings />
      </button>
    </PillContainer>
  );
}

// ============================================================================
// Mode 2: Idle Toolbar (Connected, not scanning)
// ============================================================================
interface IdleToolbarProps {
  onStartScan: () => void;
  onSettingsClick: () => void;
  showSettings: boolean;
}

function IdleToolbar({
  onStartScan,
  onSettingsClick,
  showSettings,
}: IdleToolbarProps) {
  return (
    <PillContainer>
      <button
        className="uilint-btn uilint-btn--primary"
        onClick={onStartScan}
        title="Start scanning (⌥S)"
        aria-label="Start live scanning"
      >
        <Icons.Eye />
        <span>Start Scanning</span>
      </button>
      <Divider />
      <button
        className={`uilint-btn uilint-btn--icon ${
          showSettings ? "uilint-btn--accent" : ""
        }`}
        onClick={onSettingsClick}
        title="Settings"
        aria-label="Open settings"
        aria-pressed={showSettings}
      >
        <Icons.Settings />
      </button>
    </PillContainer>
  );
}

// ============================================================================
// Mode 3: Scanning Toolbar (Active scanning)
// ============================================================================
interface ScanningToolbarProps {
  issueCount: number;
  isScanning: boolean;
  showResults: boolean;
  onToggleResults: () => void;
  onStopScan: () => void;
}

function ScanningToolbar({
  issueCount,
  isScanning,
  showResults,
  onToggleResults,
  onStopScan,
}: ScanningToolbarProps) {
  const hasIssues = issueCount > 0;

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
          <Badge count={issueCount} />
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
      style={{ display: "flex", alignItems: "center", gap: "10px" }}
    >
      {/* Status pill */}
      <PillContainer glow={glowColor}>
        {/* Status dropdown trigger */}
        <button
          className={`uilint-btn uilint-btn--${statusVariant}`}
          onClick={onToggleResults}
          title={
            hasIssues
              ? `${issueCount} issue${issueCount !== 1 ? "s" : ""} found`
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

        {/* Stop button */}
        <button
          className="uilint-btn uilint-btn--icon"
          onClick={onStopScan}
          title="Stop scanning (⌥S)"
          aria-label="Stop scanning"
        >
          <Icons.X />
        </button>
      </PillContainer>

      {/* Keyboard hint */}
      <Kbd>⌥ + Click</Kbd>
      <span style={{ fontSize: "12px", color: TOKENS.textMuted }}>
        to inspect
      </span>
    </div>
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
  const wsConnected = useUILintStore((s: UILintStore) => s.wsConnected);

  // Local state
  const [showSettings, setShowSettings] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [nextjsOverlayVisible, setNextjsOverlayVisible] = useState(false);

  // Refs
  const toolbarRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

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

  const totalIssues = elementIssues + fileLevelIssues;

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
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.("[data-ui-lint]")) return;

      if (showSettings && settingsRef.current && toolbarRef.current) {
        if (
          !settingsRef.current.contains(target as Node) &&
          !toolbarRef.current.contains(target as Node)
        ) {
          handleCloseSettings();
        }
      }

      if (showResults) {
        setShowResults(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSettings) handleCloseSettings();
        if (showResults) setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showSettings, showResults]);

  // Handlers
  const handleStartScan = useCallback(() => {
    enableLiveScan();
    setShowSettings(false);
  }, [enableLiveScan]);

  const handleStopScan = useCallback(() => {
    disableLiveScan();
    setShowResults(false);
  }, [disableLiveScan]);

  const handleSettingsClick = useCallback(() => {
    if (showSettings) {
      handleCloseSettings();
    } else {
      setShowSettings(true);
    }
  }, [showSettings]);

  const handleCloseSettings = useCallback(() => {
    setSettingsClosing(true);
    setTimeout(() => {
      setShowSettings(false);
      setSettingsClosing(false);
    }, 150);
  }, []);

  const handleToggleResults = useCallback(() => {
    setShowResults((prev) => !prev);
  }, []);

  // Prevent event propagation
  const handleUILintInteraction = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent | React.PointerEvent) => {
      e.stopPropagation();
    },
    []
  );

  if (!mounted) return null;

  const bottomPosition = nextjsOverlayVisible ? "80px" : "20px";

  // Determine which mode to render
  const renderToolbar = () => {
    if (!wsConnected) {
      return (
        <DisconnectedToolbar
          onSettingsClick={handleSettingsClick}
          showSettings={showSettings}
        />
      );
    }

    if (!liveScanEnabled) {
      return (
        <IdleToolbar
          onStartScan={handleStartScan}
          onSettingsClick={handleSettingsClick}
          showSettings={showSettings}
        />
      );
    }

    return (
      <ScanningToolbar
        issueCount={totalIssues}
        isScanning={isScanning}
        showResults={showResults}
        onToggleResults={handleToggleResults}
        onStopScan={handleStopScan}
      />
    );
  };

  const content = (
    <div
      data-ui-lint
      onMouseDown={handleUILintInteraction}
      onPointerDown={handleUILintInteraction}
      onClick={handleUILintInteraction}
      onKeyDown={handleUILintInteraction}
      style={{
        position: "fixed",
        bottom: bottomPosition,
        left: "20px",
        zIndex: 99999,
        fontFamily: TOKENS.fontFamily,
        transition: `bottom ${TOKENS.transitionSlow}`,
        pointerEvents: "none",
      }}
    >
      <style>{globalStyles}</style>

      {/* Main toolbar area */}
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="UI Lint toolbar"
        style={{ pointerEvents: "auto" }}
      >
        {renderToolbar()}
      </div>

      {/* Settings popover - for disconnected and idle modes */}
      {showSettings && !liveScanEnabled && (
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
            pointerEvents: "auto",
          }}
        >
          <SettingsPopover settings={settings} />
        </div>
      )}

      {/* Results panel - for scanning mode */}
      <ScanPanelStack
        show={showResults && liveScanEnabled}
        onClose={() => setShowResults(false)}
      />
    </div>
  );

  return createPortal(content, document.body);
}
