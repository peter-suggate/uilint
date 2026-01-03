"use client";

/**
 * UILint Toolbar - Simple floating button with settings popover
 */

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";

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
  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        marginTop: "8px",
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

      {/* Hide node_modules toggle */}
      <SettingToggle
        label="Hide node_modules"
        checked={settings.hideNodeModules}
        onChange={(checked) => onUpdate({ hideNodeModules: checked })}
      />

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
