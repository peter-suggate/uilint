"use client";

/**
 * UILint Toolbar - Simple floating button with settings popover
 */

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import { useUILintStore, type UILintStore } from "./store";

/**
 * Design tokens
 */
const STYLES = {
  bg: "rgba(17, 24, 39, 0.9)",
  bgHover: "rgba(31, 41, 55, 0.95)",
  border: "rgba(75, 85, 99, 0.5)",
  text: "#F9FAFB",
  textMuted: "#9CA3AF",
  accent: "#3B82F6",
  accentHover: "#2563EB",
  shadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  blur: "blur(12px)",
  font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
};

/**
 * Main Toolbar Component - Simple floating button with settings popover
 */
export function UILintToolbar() {
  const { settings, updateSettings, inspectedElement } = useUILintContext();

  const [showSettings, setShowSettings] = useState(false);
  const [mounted, setMounted] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node)
      ) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSettings]);

  if (!mounted) return null;

  // Hide toolbar when inspection panel is open
  if (inspectedElement) return null;

  const content = (
    <div
      data-ui-lint
      style={{
        position: "fixed",
        top: "24px",
        right: "24px",
        zIndex: 99999,
        fontFamily: STYLES.font,
      }}
    >
      <style>{`
        @keyframes uilint-fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div style={{ position: "relative" }} ref={settingsRef}>
        {/* Main button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: `1px solid ${STYLES.border}`,
            backgroundColor: showSettings ? STYLES.bgHover : STYLES.bg,
            backdropFilter: STYLES.blur,
            WebkitBackdropFilter: STYLES.blur,
            boxShadow: STYLES.shadow,
            cursor: "pointer",
            transition: "all 0.2s ease-out",
            color: showSettings ? STYLES.text : STYLES.textMuted,
            fontSize: "20px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = STYLES.shadow;
          }}
          title="UILint Settings (Alt+Click any element to inspect)"
        >
          <UILintIcon active={showSettings} />
        </button>

        {/* Settings popover */}
        {showSettings && (
          <SettingsPopover settings={settings} onUpdate={updateSettings} />
        )}

        {/* Hint tooltip on hover */}
        <div
          style={{
            position: "absolute",
            left: "100%",
            top: "50%",
            transform: "translateY(-50%)",
            marginLeft: "12px",
            padding: "8px 12px",
            borderRadius: "8px",
            backgroundColor: STYLES.bg,
            border: `1px solid ${STYLES.border}`,
            backdropFilter: STYLES.blur,
            WebkitBackdropFilter: STYLES.blur,
            boxShadow: STYLES.shadow,
            fontSize: "12px",
            color: STYLES.textMuted,
            whiteSpace: "nowrap",
            opacity: 0,
            transition: "opacity 0.2s",
            pointerEvents: "none",
          }}
          className="uilint-hint"
        >
          <span style={{ color: STYLES.text }}>Alt+Click</span> any element to
          inspect
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

/**
 * Settings popover
 */
function SettingsPopover({
  settings,
  onUpdate,
}: {
  settings: ReturnType<typeof useUILintContext>["settings"];
  onUpdate: (partial: Partial<typeof settings>) => void;
}) {
  const {
    autoScanState,
    startAutoScan,
    pauseAutoScan,
    resumeAutoScan,
    stopAutoScan,
  } = useUILintContext();

  const wsConnected = useUILintStore((s: UILintStore) => s.wsConnected);
  const wsUrl = useUILintStore((s: UILintStore) => s.wsUrl);
  const wsLastActivity = useUILintStore((s: UILintStore) => s.wsLastActivity);
  const wsRecentResults = useUILintStore((s: UILintStore) => s.wsRecentResults);
  const connectWebSocket = useUILintStore(
    (s: UILintStore) => s.connectWebSocket
  );
  const disconnectWebSocket = useUILintStore(
    (s: UILintStore) => s.disconnectWebSocket
  );

  const isScanning = autoScanState.status === "scanning";
  const isPaused = autoScanState.status === "paused";
  const isComplete = autoScanState.status === "complete";
  const isActive = isScanning || isPaused || isComplete;

  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        marginTop: "8px",
        width: "300px",
        padding: "16px",
        borderRadius: "12px",
        border: `1px solid ${STYLES.border}`,
        backgroundColor: STYLES.bg,
        backdropFilter: STYLES.blur,
        WebkitBackdropFilter: STYLES.blur,
        boxShadow: STYLES.shadow,
        animation: "uilint-fade-in 0.15s ease-out",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: STYLES.text,
          marginBottom: "12px",
        }}
      >
        UILint Settings
      </div>

      {/* Server status */}
      <div
        style={{
          padding: "10px 12px",
          borderRadius: "10px",
          border: `1px solid ${STYLES.border}`,
          backgroundColor: "rgba(31, 41, 55, 0.65)",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ fontSize: "11px", color: STYLES.textMuted }}>
              Server
            </div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: wsConnected ? "#10B981" : "#EF4444",
              }}
            >
              {wsConnected ? "Connected" : "Disconnected"}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => connectWebSocket(wsUrl)}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: `1px solid ${STYLES.border}`,
                backgroundColor: "transparent",
                color: STYLES.text,
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
              title="Reconnect to WebSocket server"
            >
              Reconnect
            </button>
            <button
              onClick={() => disconnectWebSocket()}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: `1px solid ${STYLES.border}`,
                backgroundColor: "transparent",
                color: STYLES.textMuted,
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
              title="Disconnect from WebSocket server"
            >
              Disconnect
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: "8px",
            fontSize: "10px",
            color: STYLES.textMuted,
            fontFamily: STYLES.fontMono,
            wordBreak: "break-all",
          }}
        >
          {wsUrl}
        </div>
      </div>

      {/* Live lint activity */}
      <div
        style={{
          marginTop: "10px",
          padding: "10px 12px",
          borderRadius: "10px",
          border: `1px solid ${STYLES.border}`,
          backgroundColor: "rgba(31, 41, 55, 0.45)",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <div
            style={{ fontSize: "11px", fontWeight: 700, color: STYLES.text }}
          >
            Live lint
          </div>
          <div style={{ fontSize: "10px", color: STYLES.textMuted }}>
            {wsConnected ? "Streaming" : "Offline"}
          </div>
        </div>

        {wsLastActivity ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ fontSize: "11px", color: STYLES.textMuted }}>
              {wsLastActivity.phase}
            </div>
            <div
              style={{
                fontSize: "11px",
                fontFamily: STYLES.fontMono,
                color: STYLES.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={wsLastActivity.filePath}
            >
              {(wsLastActivity.filePath.split("/").pop() ||
                wsLastActivity.filePath) ??
                ""}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: "11px", color: STYLES.textMuted }}>
            No activity yet
          </div>
        )}

        {wsRecentResults.length > 0 && (
          <div
            style={{
              marginTop: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ fontSize: "10px", color: STYLES.textMuted }}>
              Recent results
            </div>
            {wsRecentResults.slice(0, 5).map((r) => {
              const file = r.filePath.split("/").pop() || r.filePath;
              const color =
                r.issueCount === 0
                  ? "#10B981"
                  : r.issueCount <= 2
                  ? "#F59E0B"
                  : "#EF4444";
              return (
                <div
                  key={r.filePath}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    fontSize: "10px",
                    fontFamily: STYLES.fontMono,
                    color: STYLES.textMuted,
                  }}
                  title={r.filePath}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {file}
                  </span>
                  <span
                    style={{
                      minWidth: "34px",
                      textAlign: "right",
                      fontWeight: 700,
                      color,
                    }}
                  >
                    {r.issueCount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hide node_modules toggle */}
      {/* <SettingToggle
        label="Hide node_modules"
        checked={settings.hideNodeModules}
        onChange={(checked) => onUpdate({ hideNodeModules: checked })}
      /> */}

      {/* Auto-scan section */}
      <div
        style={{
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: `1px solid ${STYLES.border}`,
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: STYLES.text,
            marginBottom: "10px",
          }}
        >
          Auto-Scan Page
        </div>

        {!isActive ? (
          // Start button
          <button
            onClick={startAutoScan}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#10B981",
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#059669";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#10B981";
            }}
          >
            <ScanIcon />
            Scan All Elements
          </button>
        ) : (
          // Progress and controls
          <div>
            {/* Progress bar */}
            <div
              style={{
                marginBottom: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  color: STYLES.textMuted,
                  marginBottom: "4px",
                }}
              >
                <span>
                  {isComplete
                    ? "Complete"
                    : isPaused
                    ? "Paused"
                    : "Scanning..."}
                </span>
                <span>
                  {autoScanState.currentIndex} / {autoScanState.totalElements}
                </span>
              </div>
              <div
                style={{
                  height: "4px",
                  backgroundColor: "rgba(75, 85, 99, 0.5)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${
                      autoScanState.totalElements > 0
                        ? (autoScanState.currentIndex /
                            autoScanState.totalElements) *
                          100
                        : 0
                    }%`,
                    backgroundColor: isComplete ? "#10B981" : STYLES.accent,
                    transition: "width 0.2s ease-out",
                  }}
                />
              </div>
            </div>

            {/* Control buttons */}
            <div style={{ display: "flex", gap: "8px" }}>
              {isScanning && (
                <button
                  onClick={pauseAutoScan}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px",
                    borderRadius: "6px",
                    border: `1px solid ${STYLES.border}`,
                    backgroundColor: "transparent",
                    color: STYLES.text,
                    fontSize: "11px",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = STYLES.bgHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <PauseIcon />
                  Pause
                </button>
              )}

              {isPaused && (
                <button
                  onClick={resumeAutoScan}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: STYLES.accent,
                    color: "#FFFFFF",
                    fontSize: "11px",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = STYLES.accentHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = STYLES.accent;
                  }}
                >
                  <PlayIcon />
                  Resume
                </button>
              )}

              <button
                onClick={stopAutoScan}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "8px",
                  borderRadius: "6px",
                  border: `1px solid ${STYLES.border}`,
                  backgroundColor: "transparent",
                  color: STYLES.textMuted,
                  fontSize: "11px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = STYLES.bgHover;
                  e.currentTarget.style.color = STYLES.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = STYLES.textMuted;
                }}
              >
                <StopIcon />
                {isComplete ? "Clear" : "Stop"}
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: "8px",
            fontSize: "10px",
            color: STYLES.textMuted,
            lineHeight: 1.4,
          }}
        >
          Scan all elements for style issues and show badges
        </div>
      </div>

      {/* Hint */}
      <div
        style={{
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: `1px solid ${STYLES.border}`,
          fontSize: "11px",
          color: STYLES.textMuted,
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: STYLES.text }}>Alt+Click</strong> any element to
        open the inspector sidebar
      </div>
    </div>
  );
}

/**
 * Toggle switch for settings
 */
function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: "12px", color: STYLES.textMuted }}>{label}</span>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: "36px",
          height: "20px",
          borderRadius: "10px",
          backgroundColor: checked ? STYLES.accent : "rgba(75, 85, 99, 0.5)",
          position: "relative",
          transition: "background-color 0.2s",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "2px",
            left: checked ? "18px" : "2px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            backgroundColor: "#FFFFFF",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
          }}
        />
      </div>
    </label>
  );
}

// Icons

function UILintIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        stroke={active ? STYLES.accent : "currentColor"}
        strokeWidth="2"
      />
      <path
        d="M7 12h10M12 7v10"
        stroke={active ? STYLES.accent : "currentColor"}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}
