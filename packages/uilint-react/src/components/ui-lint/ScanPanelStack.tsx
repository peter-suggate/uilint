"use client";

/**
 * Scan Panel Stack - Container for scan results and vision issues
 *
 * Renders tabs for ESLint issues and Vision issues.
 */

import React from "react";
import { ScanResultsPopover } from "./ScanResultsPopover";
import { VisionIssuesPanel } from "./VisionIssuesPanel";
import { useUILintStore, type UILintStore } from "./store";
import { Expandable, ExpandableContent } from "@/components/ui/expandable";
import { cn } from "@/lib/utils";

interface ScanPanelStackProps {
  show: boolean;
  onClose: () => void;
}

type TabId = "eslint" | "vision";

export function ScanPanelStack({ show, onClose }: ScanPanelStackProps) {
  const activeTab = useUILintStore((s: UILintStore) => s.activeResultsTab);
  const setActiveTab = useUILintStore(
    (s: UILintStore) => s.setActiveResultsTab
  );

  const visionIssuesCache = useUILintStore(
    (s: UILintStore) => s.visionIssuesCache
  );

  // Count vision issues
  let visionIssueCount = 0;
  visionIssuesCache.forEach((issues) => {
    visionIssueCount += issues.length;
  });

  // Handle Escape key to close panel
  React.useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show, onClose]);

  // Design tokens - uses CSS variables for theme support
  const TOKENS = {
    bg: "var(--uilint-backdrop)",
    border: "var(--uilint-border)",
    textPrimary: "var(--uilint-text-primary)",
    textMuted: "var(--uilint-text-muted)",
    accent: "var(--uilint-accent)",
    violet: "oklch(0.585 0.233 283.04)", // Semantic color for vision tab
  };

  return (
    <Expandable
      expanded={show}
      onToggle={onClose}
      className={cn("relative pointer-events-auto")}
      data-ui-lint
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        marginBottom: "8px",
      }}
    >
      <ExpandableContent
        keepMounted
        preset="slide-up"
        className={cn("flex flex-col")}
      >
        {/* Tab bar */}
        <div style={{ display: "flex", gap: "2px", marginBottom: "4px" }}>
          <button
            onClick={() => setActiveTab("eslint")}
            style={{
              padding: "6px 12px",
              borderRadius: "6px 6px 0 0",
              border: "none",
              backgroundColor:
                activeTab === "eslint" ? TOKENS.bg : "transparent",
              color:
                activeTab === "eslint" ? TOKENS.textPrimary : TOKENS.textMuted,
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
              backgroundColor:
                activeTab === "vision" ? TOKENS.bg : "transparent",
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

          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              padding: "6px 10px",
              borderRadius: "6px 6px 0 0",
              border: "none",
              backgroundColor: TOKENS.bg,
              color: TOKENS.textMuted,
              fontSize: "12px",
              cursor: "pointer",
            }}
            title="Close (Esc)"
          >
            Close
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "eslint" && <ScanResultsPopover onClose={onClose} />}
        {activeTab === "vision" && (
          <VisionIssuesPanel show={true} onClose={onClose} embedded />
        )}
      </ExpandableContent>
    </Expandable>
  );
}
