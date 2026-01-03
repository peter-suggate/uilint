"use client";

/**
 * Inspection Panel - Slide-out panel showing element details and source preview
 */

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import { fetchSourceWithContext } from "./source-fetcher";
import { buildEditorUrl } from "./fiber-utils";
import type { ScannedElement, SourceLocation } from "./types";

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
  shadow: "0 -8px 32px rgba(0, 0, 0, 0.4)",
  blur: "blur(16px)",
  font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
};

const PANEL_WIDTH = 400;

/**
 * Main Inspection Panel Component
 */
export function InspectionPanel() {
  const { selectedElement, setSelectedElement, sourceFiles } =
    useUILintContext();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "source">("info");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Find the source file for the selected element
  const sourceFile = selectedElement
    ? sourceFiles.find((f) =>
        f.elements.some((e) => e.id === selectedElement.id)
      ) ?? null
    : null;

  if (!mounted) return null;

  const content = (
    <div
      data-ui-lint
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: selectedElement ? PANEL_WIDTH : 0,
        backgroundColor: STYLES.bg,
        backdropFilter: STYLES.blur,
        WebkitBackdropFilter: STYLES.blur,
        borderLeft: `1px solid ${STYLES.border}`,
        boxShadow: selectedElement ? STYLES.shadow : "none",
        fontFamily: STYLES.font,
        color: STYLES.text,
        overflow: "hidden",
        transition: "width 0.2s ease-out",
        zIndex: 99998,
      }}
    >
      <style>{`
        @keyframes uilint-panel-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {selectedElement && (
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
            element={selectedElement}
            sourceFile={sourceFile}
            onClose={() => setSelectedElement(null)}
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
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {activeTab === "info" ? (
              <InfoTab element={selectedElement} sourceFile={sourceFile} />
            ) : (
              <SourceTab element={selectedElement} />
            )}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}

/**
 * Panel header with element name and actions
 */
function PanelHeader({
  element,
  sourceFile,
  onClose,
}: {
  element: ScannedElement;
  sourceFile: ReturnType<typeof useUILintContext>["sourceFiles"][0] | null;
  onClose: () => void;
}) {
  const componentName =
    element.componentStack[0]?.name || element.tagName.toUpperCase();

  const handleOpenInEditor = useCallback(() => {
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
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {sourceFile && (
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: sourceFile.color,
            }}
          />
        )}
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600 }}>
            {componentName}
          </div>
          <div style={{ fontSize: "11px", color: STYLES.textMuted }}>
            &lt;{element.tagName}&gt;
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        {element.source && (
          <button
            onClick={handleOpenInEditor}
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
          >
            <OpenIcon />
            Open
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
 * Info tab content
 */
function InfoTab({
  element,
  sourceFile,
}: {
  element: ScannedElement;
  sourceFile: ReturnType<typeof useUILintContext>["sourceFiles"][0] | null;
}) {
  return (
    <div style={{ padding: "16px" }}>
      {/* Element details */}
      <Section title="Element">
        <InfoRow label="Tag" value={`<${element.tagName}>`} />
        {element.className && (
          <InfoRow label="Classes" value={element.className} mono />
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
      {sourceFile && (
        <Section title="Source File">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: sourceFile.color,
              }}
            />
            <span style={{ fontSize: "12px", fontWeight: 500 }}>
              {sourceFile.displayName}
            </span>
          </div>
          <div
            style={{
              fontSize: "11px",
              color: STYLES.textDim,
              fontFamily: STYLES.fontMono,
              wordBreak: "break-all",
            }}
          >
            {sourceFile.path}
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
function SourceTab({ element }: { element: ScannedElement }) {
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
  component: ScannedElement["componentStack"][0];
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

function OpenIcon() {
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
