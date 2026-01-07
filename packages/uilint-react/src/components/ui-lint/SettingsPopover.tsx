"use client";

/**
 * Settings Popover - Server status and connection settings
 *
 * Simplified to contain only settings-related controls.
 * Scan controls have been moved to ScanResultsPopover.
 */

import React from "react";
import { useUILintContext } from "./UILintProvider";
import { useUILintStore, type UILintStore } from "./store";
import { STYLES } from "./toolbar-styles";

interface SettingsPopoverProps {
  settings: ReturnType<typeof useUILintContext>["settings"];
}

export function SettingsPopover({ settings }: SettingsPopoverProps) {
  const wsConnected = useUILintStore((s: UILintStore) => s.wsConnected);
  const wsUrl = useUILintStore((s: UILintStore) => s.wsUrl);
  const connectWebSocket = useUILintStore(
    (s: UILintStore) => s.connectWebSocket
  );
  const disconnectWebSocket = useUILintStore(
    (s: UILintStore) => s.disconnectWebSocket
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        marginBottom: "8px",
        width: "260px",
        padding: "14px",
        borderRadius: STYLES.popoverRadius,
        border: `1px solid ${STYLES.border}`,
        backgroundColor: STYLES.bgPopover,
        backdropFilter: STYLES.blur,
        WebkitBackdropFilter: STYLES.blur,
        boxShadow: STYLES.shadowLg,
        animation: "uilint-fade-in 0.15s ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: "12px",
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
          borderRadius: STYLES.buttonRadius,
          border: `1px solid ${STYLES.border}`,
          backgroundColor: STYLES.bgSegment,
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Status indicator dot */}
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: wsConnected ? STYLES.success : STYLES.error,
                boxShadow: wsConnected
                  ? `0 0 8px ${STYLES.success}`
                  : `0 0 8px ${STYLES.error}`,
              }}
            />
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: wsConnected ? STYLES.success : STYLES.error,
              }}
            >
              {wsConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Server URL */}
        <div
          style={{
            fontSize: "10px",
            color: STYLES.textDim,
            fontFamily: STYLES.fontMono,
            wordBreak: "break-all",
            marginBottom: "10px",
          }}
        >
          {wsUrl}
        </div>

        {/* Connection buttons */}
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => connectWebSocket(wsUrl)}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: "6px",
              border: `1px solid ${STYLES.border}`,
              backgroundColor: wsConnected ? "transparent" : STYLES.accent,
              color: wsConnected ? STYLES.textMuted : "#FFFFFF",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: STYLES.transitionFast,
            }}
            title="Reconnect to WebSocket server"
          >
            {wsConnected ? "Reconnect" : "Connect"}
          </button>
          <button
            onClick={() => disconnectWebSocket()}
            disabled={!wsConnected}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: `1px solid ${STYLES.border}`,
              backgroundColor: "transparent",
              color: wsConnected ? STYLES.textMuted : STYLES.textDim,
              fontSize: "11px",
              fontWeight: 600,
              cursor: wsConnected ? "pointer" : "not-allowed",
              opacity: wsConnected ? 1 : 0.5,
              transition: STYLES.transitionFast,
            }}
            title="Disconnect from WebSocket server"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Hint */}
      <div
        style={{
          marginTop: "12px",
          fontSize: "11px",
          color: STYLES.textMuted,
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: STYLES.text }}>⌥+Click</strong> any element to
        open the inspector sidebar
      </div>
    </div>
  );
}
