"use client";

/**
 * Inspection Panel - Slide-out sidebar showing element details, source preview,
 * and LLM analysis with clipboard-ready fix prompts
 */

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import { fetchSourceWithContext } from "./source-fetcher";
import { buildEditorUrl } from "./fiber-utils";
import type { InspectedElement, SourceLocation, ComponentInfo } from "./types";

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
  const [activeTab, setActiveTab] = useState<"info" | "source" | "scan">(
    "info"
  );

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
            label="Info"
            active={activeTab === "info"}
            onClick={() => setActiveTab("info")}
          />
          <TabButton
            label="Source"
            active={activeTab === "source"}
            onClick={() => setActiveTab("source")}
          />
          <TabButton
            label="Scan"
            active={activeTab === "scan"}
            onClick={() => setActiveTab("scan")}
            accent
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {activeTab === "info" && <InfoTab element={inspectedElement} />}
          {activeTab === "source" && <SourceTab element={inspectedElement} />}
          {activeTab === "scan" && <ScanTab element={inspectedElement} />}
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
  const componentName =
    element.componentStack[0]?.name || element.element.tagName.toLowerCase();

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
        <div style={{ fontSize: "14px", fontWeight: 600 }}>{componentName}</div>
        <div style={{ fontSize: "11px", color: STYLES.textMuted }}>
          &lt;{element.element.tagName.toLowerCase()}&gt;
        </div>
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
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 16px",
        border: "none",
        backgroundColor: "transparent",
        color: active
          ? accent
            ? STYLES.success
            : STYLES.accent
          : STYLES.textMuted,
        fontSize: "12px",
        fontWeight: 500,
        cursor: "pointer",
        borderBottom: active
          ? `2px solid ${accent ? STYLES.success : STYLES.accent}`
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
 * Info tab content
 */
function InfoTab({ element }: { element: InspectedElement }) {
  return (
    <div style={{ padding: "16px" }}>
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

      {/* Component stack */}
      {element.componentStack.length > 0 && (
        <Section title="Component Stack">
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {element.componentStack.slice(0, 10).map((comp, index) => (
              <ComponentStackItem
                key={index}
                component={comp}
                index={index}
                isFirst={index === 0}
              />
            ))}
            {element.componentStack.length > 10 && (
              <div
                style={{
                  fontSize: "11px",
                  color: STYLES.textDim,
                  marginTop: "4px",
                }}
              >
                ...and {element.componentStack.length - 10} more
              </div>
            )}
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
 * Scan tab - LLM analysis with clipboard-ready fix prompt
 */
function ScanTab({ element }: { element: InspectedElement }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixPrompt, setFixPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Get component context for focused analysis
  const componentName =
    element.componentStack[0]?.name || element.element.tagName.toLowerCase();
  const componentLine = element.source?.lineNumber;

  const handleScan = useCallback(async () => {
    if (!element.source) {
      setError("No source information available");
      return;
    }

    setScanning(true);
    setError(null);
    setFixPrompt(null);

    try {
      // Fetch the source code
      const sourceResponse = await fetch(
        `/api/.uilint/source?path=${encodeURIComponent(element.source.fileName)}`
      );

      if (!sourceResponse.ok) {
        throw new Error("Failed to fetch source code");
      }

      const sourceData = await sourceResponse.json();
      const sourceCode = sourceData.content;
      const relativePath = sourceData.relativePath || element.source.fileName;

      // Send to analyze route with component context
      const analyzeResponse = await fetch("/api/.uilint/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCode,
          filePath: relativePath,
          componentName,
          componentLine,
        }),
      });

      if (!analyzeResponse.ok) {
        throw new Error("Failed to analyze source code");
      }

      const result = await analyzeResponse.json();
      const issues = result.issues || [];

      // Generate the clipboard-ready prompt with component focus
      if (issues.length === 0) {
        setFixPrompt(
          `No style issues found in the \`${componentName}\` component in \`${relativePath}\`. The component appears to follow the styleguide.`
        );
      } else {
        const issueList = issues
          .map((issue: { line?: number; message: string }) => {
            const lineInfo = issue.line ? `Line ${issue.line}: ` : "";
            return `- ${lineInfo}${issue.message}`;
          })
          .join("\n");

        setFixPrompt(
          `Fix the following style issues in the \`${componentName}\` component in \`${relativePath}\`:

Issues found:
${issueList}

Please update this component to match our styleguide.`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred during scanning"
      );
    } finally {
      setScanning(false);
    }
  }, [element.source, componentName, componentLine]);

  const handleCopy = useCallback(async () => {
    if (!fixPrompt) return;

    try {
      await navigator.clipboard.writeText(fixPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy to clipboard");
    }
  }, [fixPrompt]);

  return (
    <div style={{ padding: "16px" }}>
      {/* Scan button */}
      {!fixPrompt && !scanning && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <button
            onClick={handleScan}
            disabled={!element.source}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: element.source ? STYLES.success : STYLES.textDim,
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: 600,
              cursor: element.source ? "pointer" : "not-allowed",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (element.source) {
                e.currentTarget.style.backgroundColor = "#059669";
              }
            }}
            onMouseLeave={(e) => {
              if (element.source) {
                e.currentTarget.style.backgroundColor = STYLES.success;
              }
            }}
          >
            <ScanIcon />
            Scan with LLM
          </button>

          <div
            style={{
              marginTop: "12px",
              fontSize: "12px",
              color: STYLES.textMuted,
            }}
          >
            Analyze this component for style issues
          </div>

          {!element.source && (
            <div
              style={{
                marginTop: "8px",
                fontSize: "11px",
                color: STYLES.warning,
              }}
            >
              No source information available
            </div>
          )}
        </div>
      )}

      {/* Scanning state */}
      {scanning && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
            gap: "16px",
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
            Analyzing source code...
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: "16px",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            color: "#EF4444",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      {/* Fix prompt result */}
      {fixPrompt && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: STYLES.text,
              }}
            >
              Fix Prompt
            </div>
            <button
              onClick={handleCopy}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: copied ? STYLES.success : STYLES.accent,
                color: "#FFFFFF",
                fontSize: "11px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {copied ? (
                <>
                  <CheckIcon />
                  Copied!
                </>
              ) : (
                <>
                  <CopyIcon />
                  Copy to Clipboard
                </>
              )}
            </button>
          </div>

          <div
            style={{
              padding: "12px",
              backgroundColor: STYLES.bgSurface,
              border: `1px solid ${STYLES.border}`,
              borderRadius: "8px",
              fontFamily: STYLES.fontMono,
              fontSize: "12px",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              color: STYLES.text,
              maxHeight: "300px",
              overflow: "auto",
            }}
          >
            {fixPrompt}
          </div>

          <div
            style={{
              marginTop: "12px",
              fontSize: "11px",
              color: STYLES.textMuted,
              textAlign: "center",
            }}
          >
            Paste this prompt into Cursor to fix the issues
          </div>

          {/* Rescan button */}
          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <button
              onClick={() => {
                setFixPrompt(null);
                handleScan();
              }}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: `1px solid ${STYLES.border}`,
                backgroundColor: "transparent",
                color: STYLES.textMuted,
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = STYLES.accent;
                e.currentTarget.style.color = STYLES.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = STYLES.border;
                e.currentTarget.style.color = STYLES.textMuted;
              }}
            >
              Scan Again
            </button>
          </div>
        </div>
      )}
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

/**
 * Component stack item
 */
function ComponentStackItem({
  component,
  index,
  isFirst,
}: {
  component: ComponentInfo;
  index: number;
  isFirst: boolean;
}) {
  const handleClick = useCallback(() => {
    if (component.source) {
      const url = buildEditorUrl(component.source, "cursor");
      window.open(url, "_blank");
    }
  }, [component.source]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 8px",
        marginLeft: index * 8,
        backgroundColor: isFirst ? "rgba(59, 130, 246, 0.1)" : "transparent",
        borderRadius: "4px",
        cursor: component.source ? "pointer" : "default",
        transition: "background-color 0.15s",
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (component.source) {
          e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.15)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isFirst
          ? "rgba(59, 130, 246, 0.1)"
          : "transparent";
      }}
    >
      <span
        style={{
          fontSize: "12px",
          fontWeight: isFirst ? 600 : 400,
          color: isFirst ? STYLES.accent : STYLES.textMuted,
        }}
      >
        {component.name}
      </span>
      {component.source && (
        <span
          style={{
            fontSize: "10px",
            color: STYLES.textDim,
            fontFamily: STYLES.fontMono,
          }}
        >
          :{component.source.lineNumber}
        </span>
      )}
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

function ScanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect
        x="9"
        y="9"
        width="13"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
