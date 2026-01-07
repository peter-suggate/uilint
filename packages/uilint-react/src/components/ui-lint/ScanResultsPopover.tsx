"use client";

/**
 * Scan Results Popover - Shows file-grouped scan results
 *
 * Design:
 * ┌──────────────────────────────────────┐
 * │  12 files · 5 issues                 │
 * ├──────────────────────────────────────┤
 * │  buttons.tsx                    ●3   │
 * │  cards.tsx                      ●2   │
 * │  layout.tsx                     ○0   │
 * │  ...                                 │
 * └──────────────────────────────────────┘
 */

import React from "react";
import { useUILintContext } from "./UILintProvider";
import { useUILintStore, type UILintStore } from "./store";
import { STYLES, getStatusColor } from "./toolbar-styles";
import { groupBySourceFile } from "./dom-utils";
import { PauseIcon, PlayIcon, StopIcon } from "./toolbar-icons";

interface FileResult {
  path: string;
  displayName: string;
  issueCount: number;
  elementCount: number;
}

export function ScanResultsPopover() {
  const {
    autoScanState,
    pauseAutoScan,
    resumeAutoScan,
    stopAutoScan,
  } = useUILintContext();

  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );

  const isScanning = autoScanState.status === "scanning";
  const isPaused = autoScanState.status === "paused";
  const isComplete = autoScanState.status === "complete";

  // Group elements by source file and calculate issues
  const sourceFiles = groupBySourceFile(autoScanState.elements);

  const fileResults: FileResult[] = sourceFiles.map((sf) => {
    let issueCount = 0;
    for (const el of sf.elements) {
      const cached = elementIssuesCache.get(el.id);
      if (cached) {
        issueCount += cached.issues.length;
      }
    }
    return {
      path: sf.path,
      displayName: sf.displayName,
      issueCount,
      elementCount: sf.elements.length,
    };
  });

  // Sort by issue count (highest first), then by name
  fileResults.sort((a, b) => {
    if (b.issueCount !== a.issueCount) {
      return b.issueCount - a.issueCount;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  const totalFiles = fileResults.length;
  const totalIssues = fileResults.reduce((sum, f) => sum + f.issueCount, 0);
  const filesWithIssues = fileResults.filter((f) => f.issueCount > 0).length;

  // Progress calculation
  const progress =
    autoScanState.totalElements > 0
      ? (autoScanState.currentIndex / autoScanState.totalElements) * 100
      : 0;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "100%",
        right: 0,
        marginBottom: "8px",
        width: "280px",
        maxHeight: "400px",
        borderRadius: STYLES.popoverRadius,
        border: `1px solid ${STYLES.border}`,
        backgroundColor: STYLES.bgPopover,
        backdropFilter: STYLES.blur,
        WebkitBackdropFilter: STYLES.blur,
        boxShadow: STYLES.shadowLg,
        animation: "uilint-fade-in 0.15s ease-out",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${STYLES.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: STYLES.text,
            }}
          >
            {totalFiles} files · {totalIssues} issues
          </div>

          {/* Controls for scanning/paused state */}
          {(isScanning || isPaused) && (
            <div style={{ display: "flex", gap: "4px" }}>
              {isScanning && (
                <button
                  onClick={pauseAutoScan}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    border: `1px solid ${STYLES.border}`,
                    backgroundColor: "transparent",
                    color: STYLES.textMuted,
                    cursor: "pointer",
                    transition: STYLES.transitionFast,
                  }}
                  title="Pause scan"
                >
                  <PauseIcon />
                </button>
              )}
              {isPaused && (
                <button
                  onClick={resumeAutoScan}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: STYLES.accent,
                    color: "#FFFFFF",
                    cursor: "pointer",
                    transition: STYLES.transitionFast,
                  }}
                  title="Resume scan"
                >
                  <PlayIcon />
                </button>
              )}
              <button
                onClick={stopAutoScan}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  border: `1px solid ${STYLES.border}`,
                  backgroundColor: "transparent",
                  color: STYLES.textMuted,
                  cursor: "pointer",
                  transition: STYLES.transitionFast,
                }}
                title="Stop scan"
              >
                <StopIcon />
              </button>
            </div>
          )}

          {/* Clear button for complete state */}
          {isComplete && (
            <button
              onClick={stopAutoScan}
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                border: `1px solid ${STYLES.border}`,
                backgroundColor: "transparent",
                color: STYLES.textMuted,
                fontSize: "10px",
                fontWeight: 500,
                cursor: "pointer",
                transition: STYLES.transitionFast,
              }}
              title="Clear results"
            >
              Clear
            </button>
          )}
        </div>

        {/* Progress bar (only when scanning or paused) */}
        {(isScanning || isPaused) && (
          <div style={{ marginTop: "10px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                color: STYLES.textMuted,
                marginBottom: "4px",
              }}
            >
              <span>{isPaused ? "Paused" : "Scanning..."}</span>
              <span>
                {autoScanState.currentIndex} / {autoScanState.totalElements}
              </span>
            </div>
            <div
              style={{
                height: "3px",
                backgroundColor: "rgba(75, 85, 99, 0.5)",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  backgroundColor: isPaused ? STYLES.warning : STYLES.accent,
                  transition: "width 0.2s ease-out",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* File list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "6px 0",
        }}
      >
        {fileResults.length === 0 ? (
          <div
            style={{
              padding: "20px 14px",
              textAlign: "center",
              fontSize: "11px",
              color: STYLES.textMuted,
            }}
          >
            {isScanning ? "Scanning page elements..." : "No files scanned"}
          </div>
        ) : (
          fileResults.map((file) => (
            <div
              key={file.path}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 14px",
                cursor: "default",
                transition: STYLES.transitionFast,
              }}
              title={file.path}
            >
              {/* File name */}
              <span
                style={{
                  fontSize: "12px",
                  fontFamily: STYLES.fontMono,
                  color: STYLES.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  marginRight: "12px",
                }}
              >
                {file.displayName}
              </span>

              {/* Issue badge */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "24px",
                  height: "20px",
                  padding: "0 6px",
                  borderRadius: "10px",
                  backgroundColor:
                    file.issueCount > 0
                      ? getStatusColor(file.issueCount)
                      : "rgba(75, 85, 99, 0.4)",
                  color: file.issueCount > 0 ? "#FFFFFF" : STYLES.textMuted,
                  fontSize: "10px",
                  fontWeight: 700,
                }}
              >
                {file.issueCount}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Summary footer */}
      {isComplete && totalFiles > 0 && (
        <div
          style={{
            padding: "10px 14px",
            borderTop: `1px solid ${STYLES.border}`,
            fontSize: "10px",
            color: STYLES.textMuted,
          }}
        >
          {totalIssues === 0 ? (
            <span style={{ color: STYLES.success }}>
              ✓ No issues found across {totalFiles} files
            </span>
          ) : (
            <span>
              {filesWithIssues} of {totalFiles} files have issues
            </span>
          )}
        </div>
      )}
    </div>
  );
}
