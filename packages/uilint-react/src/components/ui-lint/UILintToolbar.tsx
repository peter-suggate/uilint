"use client";

/**
 * UILint Toolbar - Floating pill-shaped toolbar with mode toggles and settings
 */

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import type { UILintMode } from "./types";

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
 * Mode configuration
 */
const MODES: { id: UILintMode; label: string; icon: string }[] = [
  { id: "off", label: "Off", icon: "○" },
  { id: "sources", label: "Sources", icon: "◉" },
  { id: "inspect", label: "Inspect", icon: "◎" },
];

/**
 * Main Toolbar Component
 */
export function UILintToolbar() {
  const {
    mode,
    setMode,
    scannedElements,
    sourceFiles,
    settings,
    updateSettings,
    rescan,
    isScanning,
  } = useUILintContext();

  const [isExpanded, setIsExpanded] = useState(false);
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
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSettings]);

  if (!mounted) return null;

  const content = (
    <div
      data-ui-lint
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        fontFamily: STYLES.font,
      }}
    >
      {/* Collapsed state - circular button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: `1px solid ${STYLES.border}`,
            backgroundColor: STYLES.bg,
            backdropFilter: STYLES.blur,
            WebkitBackdropFilter: STYLES.blur,
            boxShadow: STYLES.shadow,
            cursor: "pointer",
            transition: "all 0.2s ease-out",
            color: mode === "off" ? STYLES.textMuted : STYLES.accent,
            fontSize: "20px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow =
              "0 12px 40px rgba(0, 0, 0, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = STYLES.shadow;
          }}
          title="UILint (⌘+Shift+D)"
        >
          {isScanning ? <SpinnerIcon /> : <UILintIcon active={mode !== "off"} />}
        </button>
      )}

      {/* Expanded state - pill toolbar */}
      {isExpanded && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "6px",
            borderRadius: "28px",
            border: `1px solid ${STYLES.border}`,
            backgroundColor: STYLES.bg,
            backdropFilter: STYLES.blur,
            WebkitBackdropFilter: STYLES.blur,
            boxShadow: STYLES.shadow,
            animation: "uilint-fade-in 0.2s ease-out",
            minWidth: "380px",
          }}
        >
          <style>{`
            @keyframes uilint-fade-in {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
            @keyframes uilint-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>

          {/* Mode toggle buttons */}
          {MODES.map((m) => (
            <ModeButton
              key={m.id}
              mode={m}
              isActive={mode === m.id}
              onClick={() => setMode(m.id)}
            />
          ))}

          {/* Divider */}
          <div
            style={{
              width: "1px",
              height: "24px",
              backgroundColor: STYLES.border,
              margin: "0 4px",
            }}
          />

          {/* Stats badge */}
          {mode !== "off" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "16px",
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                fontSize: "12px",
                color: STYLES.accent,
                fontWeight: 500,
                minWidth: "120px",
              }}
            >
              {isScanning ? (
                <>
                  <SpinnerIcon size={12} />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <span>{sourceFiles.length} files</span>
                  <span style={{ color: STYLES.textMuted }}>•</span>
                  <span>{scannedElements.length} elements</span>
                </>
              )}
            </div>
          )}

          {/* Rescan button */}
          {mode !== "off" && (
            <button
              onClick={rescan}
              disabled={isScanning}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "transparent",
                color: STYLES.textMuted,
                cursor: isScanning ? "not-allowed" : "pointer",
                opacity: isScanning ? 0.5 : 1,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isScanning) {
                  e.currentTarget.style.backgroundColor = STYLES.bgHover;
                  e.currentTarget.style.color = STYLES.text;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = STYLES.textMuted;
              }}
              title="Rescan page"
            >
              <RefreshIcon />
            </button>
          )}

          {/* Settings button */}
          <div style={{ position: "relative" }} ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: showSettings ? STYLES.bgHover : "transparent",
                color: showSettings ? STYLES.text : STYLES.textMuted,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = STYLES.bgHover;
                e.currentTarget.style.color = STYLES.text;
              }}
              onMouseLeave={(e) => {
                if (!showSettings) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = STYLES.textMuted;
                }
              }}
              title="Settings"
            >
              <SettingsIcon />
            </button>

            {/* Settings popover */}
            {showSettings && (
              <SettingsPopover
                settings={settings}
                onUpdate={updateSettings}
              />
            )}
          </div>

          {/* Collapse button */}
          <button
            onClick={() => setIsExpanded(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "transparent",
              color: STYLES.textMuted,
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
            title="Collapse"
          >
            <ChevronDownIcon />
          </button>
        </div>
      )}

      {/* Keyboard shortcut hint */}
      {!isExpanded && mode === "off" && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "8px",
            padding: "4px 8px",
            borderRadius: "4px",
            backgroundColor: STYLES.bg,
            border: `1px solid ${STYLES.border}`,
            fontSize: "11px",
            color: STYLES.textMuted,
            whiteSpace: "nowrap",
            opacity: 0,
            transition: "opacity 0.2s",
            pointerEvents: "none",
          }}
          className="uilint-hint"
        >
          ⌘+Shift+D
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}

/**
 * Mode toggle button
 */
function ModeButton({
  mode,
  isActive,
  onClick,
}: {
  mode: { id: UILintMode; label: string; icon: string };
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 14px",
        borderRadius: "20px",
        border: "none",
        backgroundColor: isActive ? STYLES.accent : "transparent",
        color: isActive ? "#FFFFFF" : STYLES.textMuted,
        fontSize: "13px",
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s ease-out",
        fontFamily: STYLES.font,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = STYLES.bgHover;
          e.currentTarget.style.color = STYLES.text;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = STYLES.textMuted;
        }
      }}
    >
      <span style={{ fontSize: "14px" }}>{mode.icon}</span>
      <span>{mode.label}</span>
    </button>
  );
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
  return (
    <div
      style={{
        position: "absolute",
        bottom: "100%",
        right: 0,
        marginBottom: "8px",
        width: "280px",
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
      <div style={{ fontSize: "13px", fontWeight: 600, color: STYLES.text, marginBottom: "12px" }}>
        Settings
      </div>

      {/* Show labels toggle */}
      <SettingToggle
        label="Show file labels"
        checked={settings.showLabels}
        onChange={(checked) => onUpdate({ showLabels: checked })}
      />

      {/* Hide node_modules toggle */}
      <SettingToggle
        label="Hide node_modules"
        checked={settings.hideNodeModules}
        onChange={(checked) => onUpdate({ hideNodeModules: checked })}
      />

      {/* Label position */}
      <div style={{ marginTop: "12px" }}>
        <div
          style={{
            fontSize: "12px",
            color: STYLES.textMuted,
            marginBottom: "6px",
          }}
        >
          Label position
        </div>
        <select
          value={settings.labelPosition}
          onChange={(e) =>
            onUpdate({ labelPosition: e.target.value as typeof settings.labelPosition })
          }
          style={{
            width: "100%",
            padding: "6px 8px",
            borderRadius: "6px",
            border: `1px solid ${STYLES.border}`,
            backgroundColor: STYLES.bgHover,
            color: STYLES.text,
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          <option value="top-left">Top Left</option>
          <option value="top-right">Top Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-right">Bottom Right</option>
        </select>
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

function SpinnerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "uilint-spin 1s linear infinite" }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
        fill="none"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 3v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
