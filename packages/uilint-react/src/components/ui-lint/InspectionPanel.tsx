"use client";

/**
 * Inspection Panel - Slide-out sidebar showing element details, source preview,
 * and LLM analysis with clipboard-ready fix prompts
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import { useUILintStore, type UILintStore } from "./store";
import { fetchSourceWithContext } from "./source-fetcher";
import { buildEditorUrl } from "./dom-utils";
import type {
  InspectedElement,
  SourceLocation,
  ElementIssue,
  ESLintIssue,
} from "./types";

/**
 * Design tokens
 */
const STYLES = {
  bg: "rgba(17, 24, 39, 0.95)",
  bgSurface: "rgba(31, 41, 55, 0.9)",
  border: "rgba(75, 85, 99, 0.5)",
  text: "#F9FAFB",
  textMuted: "#9CA3AF",
  textDim: "#6B7280",
  accent: "#3B82F6",
  accentHover: "#2563EB",
  success: "#10B981",
  warning: "#F59E0B",
  shadow: "0 -8px 32px rgba(0, 0, 0, 0.4)",
  blur: "blur(16px)",
  font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
};

const PANEL_WIDTH = 420;

/**
 * Main Inspection Panel Component
 */
export function InspectionPanel() {
  const { inspectedElement, setInspectedElement } = useUILintContext();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "source">("info");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !inspectedElement) return null;

  const content = (
    <div
      data-ui-lint
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: PANEL_WIDTH,
        backgroundColor: STYLES.bg,
        backdropFilter: STYLES.blur,
        WebkitBackdropFilter: STYLES.blur,
        borderLeft: `1px solid ${STYLES.border}`,
        boxShadow: STYLES.shadow,
        fontFamily: STYLES.font,
        color: STYLES.text,
        overflow: "hidden",
        zIndex: 99998,
      }}
    >
      <style>{`
        @keyframes uilint-panel-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes uilint-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          animation: "uilint-panel-slide-in 0.2s ease-out",
        }}
      >
        {/* Header */}
        <PanelHeader
          element={inspectedElement}
          onClose={() => setInspectedElement(null)}
        />

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: `1px solid ${STYLES.border}`,
          }}
        >
          <TabButton
            label="Inspect"
            active={activeTab === "info"}
            onClick={() => setActiveTab("info")}
          />
          <TabButton
            label="Source"
            active={activeTab === "source"}
            onClick={() => setActiveTab("source")}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {activeTab === "info" && <InfoTab element={inspectedElement} />}
          {activeTab === "source" && <SourceTab element={inspectedElement} />}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

/**
 * Panel header with element name and actions
 */
function PanelHeader({
  element,
  onClose,
}: {
  element: InspectedElement;
  onClose: () => void;
}) {
  const tagName = element.element.tagName.toLowerCase();

  const handleOpenInCursor = useCallback(() => {
    if (element.source) {
      const url = buildEditorUrl(element.source, "cursor");
      window.open(url, "_blank");
    }
  }, [element.source]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: `1px solid ${STYLES.border}`,
        backgroundColor: STYLES.bgSurface,
      }}
    >
      <div>
        <div style={{ fontSize: "14px", fontWeight: 600 }}>
          &lt;{tagName}&gt;
        </div>
        {element.source && (
          <div style={{ fontSize: "11px", color: STYLES.textMuted }}>
            {element.source.fileName.split("/").pop()}:
            {element.source.lineNumber}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        {element.source && (
          <button
            onClick={handleOpenInCursor}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: STYLES.accent,
              color: "#FFFFFF",
              fontSize: "11px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = STYLES.accentHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = STYLES.accent;
            }}
            title="Open in Cursor"
          >
            <CursorIcon />
            Open in Cursor
          </button>
        )}

        <button
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: "transparent",
            color: STYLES.textMuted,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = STYLES.bgSurface;
            e.currentTarget.style.color = STYLES.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = STYLES.textMuted;
          }}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

/**
 * Tab button
 */
function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 16px",
        border: "none",
        backgroundColor: "transparent",
        color: active ? STYLES.accent : STYLES.textMuted,
        fontSize: "12px",
        fontWeight: 500,
        cursor: "pointer",
        borderBottom: active
          ? `2px solid ${STYLES.accent}`
          : "2px solid transparent",
        marginBottom: "-1px",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Info tab content - includes scan UI and element details
 */
function InfoTab({ element }: { element: InspectedElement }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Scan Section - prominent at the top */}
      <ScanSection element={element} />

      {/* Element Details - scrollable below */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
        {/* Element details */}
        <Section title="Element">
          <InfoRow
            label="Tag"
            value={`<${element.element.tagName.toLowerCase()}>`}
          />
          {element.element.className && (
            <InfoRow
              label="Classes"
              value={
                typeof element.element.className === "string"
                  ? element.element.className
                  : ""
              }
              mono
            />
          )}
          {element.source && (
            <InfoRow
              label="Location"
              value={`Line ${element.source.lineNumber}${
                element.source.columnNumber
                  ? `, Col ${element.source.columnNumber}`
                  : ""
              }`}
            />
          )}
        </Section>

        {/* File info */}
        {element.source && (
          <Section title="Source File">
            <div
              style={{
                fontSize: "11px",
                color: STYLES.textDim,
                fontFamily: STYLES.fontMono,
                wordBreak: "break-all",
              }}
            >
              {element.source.fileName}
            </div>
          </Section>
        )}

        {/* Dimensions */}
        <Section title="Dimensions">
          <InfoRow
            label="Size"
            value={`${Math.round(element.rect.width)} × ${Math.round(
              element.rect.height
            )}px`}
          />
          <InfoRow
            label="Position"
            value={`(${Math.round(element.rect.left)}, ${Math.round(
              element.rect.top
            )})`}
          />
        </Section>
      </div>
    </div>
  );
}

/**
 * Source tab content with code preview
 */
function SourceTab({ element }: { element: InspectedElement }) {
  const [sourceData, setSourceData] = useState<{
    lines: string[];
    startLine: number;
    highlightLine: number;
    relativePath: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!element.source) {
      setError("No source information available");
      return;
    }

    setLoading(true);
    setError(null);

    fetchSourceWithContext(element.source, 8)
      .then((data) => {
        if (data) {
          setSourceData(data);
        } else {
          setError("Failed to load source file");
        }
      })
      .catch(() => {
        setError("Failed to load source file");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [element.source]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px",
          color: STYLES.textMuted,
          fontSize: "13px",
        }}
      >
        Loading source...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px",
          color: STYLES.textMuted,
          fontSize: "13px",
        }}
      >
        {error}
      </div>
    );
  }

  if (!sourceData) return null;

  return (
    <div style={{ padding: "12px" }}>
      {/* File path */}
      <div
        style={{
          padding: "8px 12px",
          marginBottom: "8px",
          backgroundColor: STYLES.bgSurface,
          borderRadius: "6px",
          fontSize: "11px",
          fontFamily: STYLES.fontMono,
          color: STYLES.textMuted,
          wordBreak: "break-all",
        }}
      >
        {sourceData.relativePath}
      </div>

      {/* Code preview */}
      <div
        style={{
          backgroundColor: STYLES.bgSurface,
          borderRadius: "8px",
          overflow: "hidden",
          border: `1px solid ${STYLES.border}`,
        }}
      >
        <pre
          style={{
            margin: 0,
            padding: "12px 0",
            overflow: "auto",
            fontSize: "12px",
            lineHeight: "1.6",
            fontFamily: STYLES.fontMono,
          }}
        >
          {sourceData.lines.map((line, index) => {
            const lineNumber = sourceData.startLine + index;
            const isHighlight = lineNumber === sourceData.highlightLine;

            return (
              <div
                key={lineNumber}
                style={{
                  display: "flex",
                  backgroundColor: isHighlight
                    ? "rgba(59, 130, 246, 0.2)"
                    : "transparent",
                  borderLeft: isHighlight
                    ? `3px solid ${STYLES.accent}`
                    : "3px solid transparent",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "48px",
                    paddingRight: "12px",
                    textAlign: "right",
                    color: isHighlight ? STYLES.accent : STYLES.textDim,
                    userSelect: "none",
                    flexShrink: 0,
                  }}
                >
                  {lineNumber}
                </span>
                <code
                  style={{
                    color: isHighlight ? STYLES.text : STYLES.textMuted,
                    whiteSpace: "pre",
                  }}
                >
                  {line || " "}
                </code>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

/**
 * Scan section - Displays ESLint issues from auto-scan cache
 * Shows issues prominently at the top of the Info tab
 */
function ScanSection({ element }: { element: InspectedElement }) {
  const { elementIssuesCache, autoScanState } = useUILintContext();

  // Find cached issue for this element from auto-scan
  const cachedIssue = useMemo((): ElementIssue | null => {
    // First try to match by scannedElementId if available
    if (element.scannedElementId) {
      const cached = elementIssuesCache.get(element.scannedElementId);
      if (cached) return cached;
    }

    // Fallback: match by source file path
    if (element.source) {
      for (const [, issue] of elementIssuesCache) {
        // Find elements with matching source file
        const scannedElement = autoScanState.elements.find(
          (el) => el.id === issue.elementId
        );
        if (scannedElement?.source?.fileName === element.source.fileName) {
          return issue;
        }
      }
    }

    return null;
  }, [
    element.scannedElementId,
    element.source,
    elementIssuesCache,
    autoScanState.elements,
  ]);

  // Get ESLint issues for display
  const eslintIssues = useMemo(() => {
    return cachedIssue?.issues || [];
  }, [cachedIssue]);

  // Determine what to show based on cached status
  const showCachedScanning = cachedIssue?.status === "scanning";
  const showCachedPending = cachedIssue?.status === "pending";
  const showCachedError = cachedIssue?.status === "error";
  const showCachedResult = cachedIssue?.status === "complete";
  const showNoScan = !cachedIssue;

  return (
    <div
      style={{
        borderBottom: `1px solid ${STYLES.border}`,
        backgroundColor: STYLES.bgSurface,
      }}
    >
      <div style={{ padding: "16px" }}>
        {/* Cached: scanning in progress */}
        {showCachedScanning && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px 24px",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                border: `3px solid ${STYLES.border}`,
                borderTopColor: STYLES.success,
                borderRadius: "50%",
                animation: "uilint-spin 1s linear infinite",
              }}
            />
            <div style={{ color: STYLES.textMuted, fontSize: "13px" }}>
              Auto-scan in progress...
            </div>
          </div>
        )}

        {/* Cached: pending in queue */}
        {showCachedPending && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "8px",
                backgroundColor: STYLES.bg,
                color: STYLES.textMuted,
                fontSize: "12px",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(156, 163, 175, 0.5)",
                }}
              />
              Waiting in scan queue...
            </div>
          </div>
        )}

        {/* Cached: error occurred */}
        {showCachedError && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: "#EF4444",
              fontSize: "12px",
            }}
          >
            Auto-scan failed for this element
          </div>
        )}

        {/* Cached: show results from auto-scan */}
        {showCachedResult && (
          <div>
            {/* ESLint Issues Section */}
            {eslintIssues.length > 0 && (
              <ESLintIssuesSection issues={eslintIssues} />
            )}

            {eslintIssues.length === 0 && (
              <div
                style={{
                  padding: "16px",
                  textAlign: "center",
                  color: STYLES.textMuted,
                  fontSize: "12px",
                }}
              >
                No issues found
              </div>
            )}
          </div>
        )}

        {/* No scan data */}
        {showNoScan && (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              color: STYLES.textMuted,
              fontSize: "12px",
            }}
          >
            Run auto-scan to analyze this element
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ESLint Issues Section - displays ESLint rule violations
 */
function ESLintIssuesSection({ issues }: { issues: ESLintIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <div style={{ marginBottom: "16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <ESLintIcon />
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: STYLES.text,
          }}
        >
          ESLint Issues ({issues.length})
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {issues.map((issue, index) => (
          <div
            key={index}
            style={{
              padding: "10px 12px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "6px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}
            >
              <WarningIcon />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "12px",
                    color: STYLES.text,
                    lineHeight: 1.4,
                    marginBottom: "4px",
                  }}
                >
                  {issue.message}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    fontSize: "10px",
                    color: STYLES.textDim,
                    fontFamily: STYLES.fontMono,
                  }}
                >
                  {issue.ruleId && (
                    <span
                      style={{
                        padding: "2px 6px",
                        backgroundColor: "rgba(239, 68, 68, 0.15)",
                        borderRadius: "4px",
                        color: "#EF4444",
                      }}
                    >
                      {issue.ruleId}
                    </span>
                  )}
                  <span>
                    Line {issue.line}
                    {issue.column ? `:${issue.column}` : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Section wrapper
 */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: STYLES.textDim,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: "8px",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/**
 * Info row
 */
function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        fontSize: "12px",
        marginBottom: "4px",
      }}
    >
      <span style={{ color: STYLES.textMuted }}>{label}</span>
      <span
        style={{
          color: STYLES.text,
          fontFamily: mono ? STYLES.fontMono : undefined,
          textAlign: "right",
          maxWidth: "200px",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// Icons

function CursorIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ESLintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
        stroke="#EF4444"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0, marginTop: "1px" }}
    >
      <path
        d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="#EF4444"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
