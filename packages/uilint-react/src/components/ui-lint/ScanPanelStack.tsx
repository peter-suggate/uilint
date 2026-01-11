"use client";

/**
 * Scan Panel Stack - Container for scan results and vision issues
 *
 * Renders tabs for ESLint issues and Vision issues.
 */

import React, { useRef, useEffect, useState } from "react";
import { ScanResultsPopover } from "./ScanResultsPopover";
import { VisionIssuesPanel } from "./VisionIssuesPanel";
import { useUILintStore, type UILintStore } from "./store";

interface ScanPanelStackProps {
  show: boolean;
  onClose: () => void;
}

type TabId = "eslint" | "vision";

export function ScanPanelStack({ show, onClose }: ScanPanelStackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTab = useUILintStore((s: UILintStore) => s.activeResultsTab);
  const setActiveTab = useUILintStore((s: UILintStore) => s.setActiveResultsTab);

  const visionIssuesCache = useUILintStore(
    (s: UILintStore) => s.visionIssuesCache
  );
  
  // Count vision issues
  let visionIssueCount = 0;
  visionIssuesCache.forEach((issues) => {
    visionIssueCount += issues.length;
  });

  // Handle click outside to close panel
  useEffect(() => {
    if (!show) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element | null;

      // Don't close if clicking on any UILint element (prevents dismissing app popovers)
      if (target?.closest?.("[data-ui-lint]")) {
        return;
      }

      // Check if click is outside the panel container
      if (
        containerRef.current &&
        !containerRef.current.contains(target as Node)
      ) {
        onClose();
      }
    };

    // Delay adding listener to avoid immediate close from the click that opened it
    // Use capture phase to check before app handlers, but still allow app to see the event
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [show, onClose]);

  // Handle Escape key to close panel
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show, onClose]);

  // Event handlers to prevent UILint interactions from propagating to the app
  const handleUILintInteraction = (
    e: React.MouseEvent | React.KeyboardEvent | React.PointerEvent
  ) => {
    e.stopPropagation();
  };

  if (!show) return null;

  const TOKENS = {
    bg: "rgba(15, 15, 15, 0.92)",
    border: "rgba(255, 255, 255, 0.1)",
    textPrimary: "rgba(255, 255, 255, 0.95)",
    textMuted: "rgba(255, 255, 255, 0.5)",
    accent: "#63b3ed",
    violet: "#8B5CF6",
  };

  return (
    <div
      ref={containerRef}
      data-ui-lint
      onMouseDown={handleUILintInteraction}
      onPointerDown={handleUILintInteraction}
      onClick={handleUILintInteraction}
      onKeyDown={handleUILintInteraction}
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        marginBottom: "8px",
        pointerEvents: "auto",
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          marginBottom: "4px",
        }}
      >
        <button
          onClick={() => setActiveTab("eslint")}
          style={{
            padding: "6px 12px",
            borderRadius: "6px 6px 0 0",
            border: "none",
            backgroundColor: activeTab === "eslint" ? TOKENS.bg : "transparent",
            color: activeTab === "eslint" ? TOKENS.textPrimary : TOKENS.textMuted,
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          ESLint Issues
        </button>
        <button
          onClick={() => setActiveTab("vision")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "6px 6px 0 0",
            border: "none",
            backgroundColor: activeTab === "vision" ? TOKENS.bg : "transparent",
            color: activeTab === "vision" ? TOKENS.violet : TOKENS.textMuted,
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          Vision
          {visionIssueCount > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "16px",
                height: "16px",
                padding: "0 4px",
                borderRadius: "8px",
                backgroundColor: TOKENS.violet,
                color: "#FFFFFF",
                fontSize: "10px",
                fontWeight: 600,
              }}
            >
              {visionIssueCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "eslint" && <ScanResultsPopover onClose={onClose} />}
      {activeTab === "vision" && (
        <VisionIssuesPanel show={true} onClose={onClose} embedded />
      )}
    </div>
  );
}
