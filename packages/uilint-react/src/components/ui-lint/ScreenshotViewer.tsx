"use client";

/**
 * Screenshot Viewer Component
 *
 * Debug component to view captured screenshots and their associated analysis results.
 * Useful for debugging vision analysis issues.
 */

import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintStore, type UILintStore } from "./store";

/**
 * Design tokens
 */
const STYLES = {
  bg: "rgba(17, 24, 39, 0.98)",
  bgSurface: "rgba(31, 41, 55, 0.95)",
  border: "rgba(75, 85, 99, 0.6)",
  text: "#F9FAFB",
  textMuted: "#9CA3AF",
  textDim: "#6B7280",
  accent: "#3B82F6",
  shadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
  blur: "blur(12px)",
  font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
};

interface ScreenshotViewerProps {
  show: boolean;
  onClose: () => void;
}

/**
 * Screenshot Viewer Component
 */
export function ScreenshotViewer({ show, onClose }: ScreenshotViewerProps) {
  const screenshotHistory = useUILintStore(
    (s: UILintStore) => s.screenshotHistory
  );
  const visionIssuesCache = useUILintStore(
    (s: UILintStore) => s.visionIssuesCache
  );
  const visionResult = useUILintStore((s: UILintStore) => s.visionResult);

  // Selected screenshot route
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  // Get all routes with screenshots
  const routes = Array.from(screenshotHistory.keys());

  // Get selected screenshot data
  const selectedScreenshot = selectedRoute
    ? screenshotHistory.get(selectedRoute)
    : routes.length > 0
    ? screenshotHistory.get(routes[0]!)
    : null;

  const currentRoute = selectedRoute || (routes.length > 0 ? routes[0] : null);
  const currentIssues = currentRoute
    ? visionIssuesCache.get(currentRoute) || []
    : [];

  const handleDownload = useCallback(() => {
    if (!selectedScreenshot || !currentRoute) return;

    const link = document.createElement("a");
    link.download = `uilint-screenshot-${currentRoute.replace(/\//g, "-")}-${selectedScreenshot.timestamp}.png`;
    link.href = selectedScreenshot.dataUrl;
    link.click();
  }, [selectedScreenshot, currentRoute]);

  const handleUILintInteraction = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent | React.PointerEvent) => {
      e.stopPropagation();
    },
    []
  );

  if (!show) return null;

  const content = (
    <div
      data-ui-lint
      onMouseDown={handleUILintInteraction}
      onPointerDown={handleUILintInteraction}
      onClick={handleUILintInteraction}
      onKeyDown={handleUILintInteraction}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
      }}
    >
      <style>{`
        @keyframes uilint-viewer-appear {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        style={{
          width: "90vw",
          maxWidth: "1200px",
          maxHeight: "90vh",
          backgroundColor: STYLES.bg,
          backdropFilter: STYLES.blur,
          WebkitBackdropFilter: STYLES.blur,
          border: `1px solid ${STYLES.border}`,
          borderRadius: "16px",
          boxShadow: STYLES.shadow,
          fontFamily: STYLES.font,
          color: STYLES.text,
          overflow: "hidden",
          animation: "uilint-viewer-appear 0.2s ease-out",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: `1px solid ${STYLES.border}`,
            backgroundColor: STYLES.bgSurface,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={STYLES.accent}
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span style={{ fontSize: "16px", fontWeight: 600 }}>
              Screenshot Viewer
            </span>
            <span
              style={{
                fontSize: "12px",
                color: STYLES.textMuted,
                fontFamily: STYLES.fontMono,
              }}
            >
              {routes.length} screenshot{routes.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {selectedScreenshot && (
              <button
                onClick={handleDownload}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${STYLES.border}`,
                  backgroundColor: "transparent",
                  color: STYLES.textMuted,
                  fontSize: "12px",
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
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "8px",
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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Sidebar - Route list */}
          <div
            style={{
              width: "200px",
              borderRight: `1px solid ${STYLES.border}`,
              backgroundColor: STYLES.bgSurface,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                padding: "12px",
                fontSize: "11px",
                fontWeight: 600,
                color: STYLES.textDim,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Routes
            </div>

            {routes.length === 0 && (
              <div
                style={{
                  padding: "16px",
                  textAlign: "center",
                  color: STYLES.textMuted,
                  fontSize: "12px",
                }}
              >
                No screenshots captured yet
              </div>
            )}

            {routes.map((route) => {
              const isSelected = route === currentRoute;
              const screenshot = screenshotHistory.get(route);
              const issues = visionIssuesCache.get(route) || [];

              return (
                <button
                  key={route}
                  onClick={() => setSelectedRoute(route)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    width: "100%",
                    padding: "10px 12px",
                    border: "none",
                    backgroundColor: isSelected ? STYLES.bg : "transparent",
                    borderLeft: isSelected
                      ? `2px solid ${STYLES.accent}`
                      : "2px solid transparent",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? STYLES.text : STYLES.textMuted,
                      fontFamily: STYLES.fontMono,
                    }}
                  >
                    {route}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "11px",
                      color: STYLES.textDim,
                    }}
                  >
                    {screenshot && (
                      <span>
                        {new Date(screenshot.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                    {issues.length > 0 && (
                      <span
                        style={{
                          padding: "1px 5px",
                          borderRadius: "4px",
                          backgroundColor: "#F59E0B20",
                          color: "#F59E0B",
                        }}
                      >
                        {issues.length}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Main content - Screenshot preview */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {selectedScreenshot ? (
              <>
                {/* Screenshot */}
                <div
                  style={{
                    flex: 1,
                    padding: "20px",
                    overflow: "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#0a0a0a",
                  }}
                >
                  <img
                    src={selectedScreenshot.dataUrl}
                    alt={`Screenshot of ${currentRoute}`}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                      borderRadius: "8px",
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
                    }}
                  />
                </div>

                {/* Info bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 20px",
                    borderTop: `1px solid ${STYLES.border}`,
                    backgroundColor: STYLES.bgSurface,
                    fontSize: "12px",
                    color: STYLES.textMuted,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span>
                      <strong>Route:</strong>{" "}
                      <span style={{ fontFamily: STYLES.fontMono }}>
                        {currentRoute}
                      </span>
                    </span>
                    <span>
                      <strong>Captured:</strong>{" "}
                      {new Date(selectedScreenshot.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>
                      <strong>Issues:</strong> {currentIssues.length}
                    </span>
                    {visionResult?.analysisTime && (
                      <span>
                        <strong>Analysis:</strong> {visionResult.analysisTime}ms
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "16px",
                  color: STYLES.textMuted,
                }}
              >
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={STYLES.textDim}
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p style={{ margin: 0, fontSize: "14px" }}>
                  No screenshots captured yet
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: STYLES.textDim,
                    maxWidth: "300px",
                    textAlign: "center",
                  }}
                >
                  Click the camera button in the toolbar to capture and analyze
                  the current page
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
