"use client";

/**
 * Scan Results Popover - Shows file-grouped scan results with expandable sections
 *
 * Design:
 * ┌──────────────────────────────────────┐
 * │  3 files with issues                 │
 * ├──────────────────────────────────────┤
 * │  ▼ buttons.tsx                  ●3   │
 * │     <button> :12                ●2   │
 * │     <div> :45                   ●1   │
 * │  ▶ todos/page.tsx               ●2   │
 * │  ▶ profile/page.tsx             ●1   │
 * └──────────────────────────────────────┘
 *
 * - Only files WITH issues are shown
 * - Files are expandable in-place to show elements with issues
 * - Hovering an element highlights it in the DOM
 * - Clicking an element scrolls to it and adds persistent highlight
 */

import React, { useState, useCallback, useMemo } from "react";
import { useUILintContext } from "./UILintProvider";
import { useUILintStore, type UILintStore } from "./store";
import { STYLES, getStatusColor } from "./toolbar-styles";
import { groupBySourceFile } from "./dom-utils";
import { StopIcon, ChevronIcon } from "./toolbar-icons";
import type { ScannedElement, LocatorTarget } from "./types";

interface FileWithIssues {
  path: string;
  displayName: string;
  disambiguatedName: string;
  issueCount: number;
  elementsWithIssues: ElementWithIssues[];
}

interface ElementWithIssues {
  element: ScannedElement;
  issueCount: number;
}

/**
 * Get a disambiguated display name for files with duplicate names
 * Shows "parentDir/fileName" for disambiguation
 */
function getDisambiguatedName(path: string, allPaths: string[]): string {
  const parts = path.split("/");
  const fileName = parts[parts.length - 1] || path;

  // Check if any other file has the same name
  const duplicates = allPaths.filter((p) => {
    const pParts = p.split("/");
    return pParts[pParts.length - 1] === fileName && p !== path;
  });

  if (duplicates.length === 0) {
    return fileName;
  }

  // Include parent directory for disambiguation
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${fileName}`;
  }

  return fileName;
}

export function ScanResultsPopover() {
  const { autoScanState, liveScanEnabled, disableLiveScan } =
    useUILintContext();

  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );

  const setLocatorTarget = useUILintStore(
    (s: UILintStore) => s.setLocatorTarget
  );

  const setInspectedElement = useUILintStore(
    (s: UILintStore) => s.setInspectedElement
  );

  // Track which files are expanded
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const isScanning = autoScanState.status === "scanning";
  const isComplete = autoScanState.status === "complete";

  // Group elements by source file and filter to only those with issues
  const filesWithIssues = useMemo<FileWithIssues[]>(() => {
    const sourceFiles = groupBySourceFile(autoScanState.elements);
    const allPaths = sourceFiles.map((sf) => sf.path);

    const result: FileWithIssues[] = [];

    for (const sf of sourceFiles) {
      const elementsWithIssues: ElementWithIssues[] = [];

      for (const el of sf.elements) {
        const cached = elementIssuesCache.get(el.id);
        const issueCount = cached?.issues.length || 0;
        if (issueCount > 0) {
          elementsWithIssues.push({ element: el, issueCount });
        }
      }

      // Only include files that have elements with issues
      if (elementsWithIssues.length > 0) {
        // Sort elements by line number
        elementsWithIssues.sort(
          (a, b) => a.element.source.lineNumber - b.element.source.lineNumber
        );

        const totalIssues = elementsWithIssues.reduce(
          (sum, e) => sum + e.issueCount,
          0
        );

        result.push({
          path: sf.path,
          displayName: sf.displayName,
          disambiguatedName: getDisambiguatedName(sf.path, allPaths),
          issueCount: totalIssues,
          elementsWithIssues,
        });
      }
    }

    // Sort by issue count (highest first)
    result.sort((a, b) => b.issueCount - a.issueCount);

    return result;
  }, [autoScanState.elements, elementIssuesCache]);

  const totalIssues = filesWithIssues.reduce((sum, f) => sum + f.issueCount, 0);

  // Progress calculation
  const progress =
    autoScanState.totalElements > 0
      ? (autoScanState.currentIndex / autoScanState.totalElements) * 100
      : 0;

  // Toggle file expansion
  const toggleFile = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Handle element hover - show locator overlay
  const handleElementHover = useCallback(
    (element: ScannedElement | null) => {
      if (!element) {
        setLocatorTarget(null);
        return;
      }

      const target: LocatorTarget = {
        element: element.element,
        source: element.source,
        rect: element.element.getBoundingClientRect(),
      };
      setLocatorTarget(target);
    },
    [setLocatorTarget]
  );

  // Handle element click - scroll to element and set persistent highlight
  const handleElementClick = useCallback(
    (element: ScannedElement) => {
      // Scroll to the element
      element.element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      // Set inspected element for persistent highlight
      setInspectedElement({
        element: element.element,
        source: element.source,
        rect: element.element.getBoundingClientRect(),
        scannedElementId: element.id,
      });

      // Clear the hover target
      setLocatorTarget(null);
    },
    [setInspectedElement, setLocatorTarget]
  );

  return (
    <div
      data-ui-lint
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        marginBottom: "8px",
        width: "320px",
        maxHeight: "450px",
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
            {filesWithIssues.length === 0
              ? "No issues found"
              : `${filesWithIssues.length} ${
                  filesWithIssues.length === 1 ? "file" : "files"
                } with ${totalIssues} ${
                  totalIssues === 1 ? "issue" : "issues"
                }`}
          </div>

          {/* Stop/Disable button */}
          {liveScanEnabled && (
            <button
              onClick={disableLiveScan}
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
              title="Disable live scanning"
            >
              <StopIcon />
            </button>
          )}
        </div>

        {/* Progress bar (only when scanning) */}
        {isScanning && (
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
              <span>Scanning...</span>
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
                  backgroundColor: STYLES.accent,
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
          padding: "4px 0",
        }}
        onMouseLeave={() => handleElementHover(null)}
      >
        {filesWithIssues.length === 0 ? (
          <div
            style={{
              padding: "24px 14px",
              textAlign: "center",
              fontSize: "11px",
              color: STYLES.textMuted,
            }}
          >
            {isScanning ? (
              "Scanning page elements..."
            ) : isComplete ? (
              <span style={{ color: STYLES.success }}>✓ No issues found</span>
            ) : (
              "No files scanned"
            )}
          </div>
        ) : (
          filesWithIssues.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              isExpanded={expandedFiles.has(file.path)}
              onToggle={() => toggleFile(file.path)}
              onElementHover={handleElementHover}
              onElementClick={handleElementClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Expandable file row with nested element list
 */
interface FileRowProps {
  file: FileWithIssues;
  isExpanded: boolean;
  onToggle: () => void;
  onElementHover: (element: ScannedElement | null) => void;
  onElementClick: (element: ScannedElement) => void;
}

function FileRow({
  file,
  isExpanded,
  onToggle,
  onElementHover,
  onElementClick,
}: FileRowProps) {
  return (
    <div>
      {/* File header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          cursor: "pointer",
          transition: STYLES.transitionFast,
          backgroundColor: isExpanded
            ? "rgba(59, 130, 246, 0.08)"
            : "transparent",
        }}
        title={file.path}
        onClick={onToggle}
        onMouseEnter={(e) => {
          if (!isExpanded) {
            e.currentTarget.style.backgroundColor = "rgba(55, 65, 81, 0.5)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isExpanded
            ? "rgba(59, 130, 246, 0.08)"
            : "transparent";
        }}
      >
        {/* Expand/collapse chevron */}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "16px",
            height: "16px",
            marginRight: "6px",
            color: STYLES.textMuted,
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease-out",
          }}
        >
          <ChevronIcon />
        </span>

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
          {file.disambiguatedName}
        </span>

        {/* Issue badge */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "22px",
            height: "18px",
            padding: "0 6px",
            borderRadius: "9px",
            backgroundColor: getStatusColor(file.issueCount),
            color: "#FFFFFF",
            fontSize: "10px",
            fontWeight: 700,
          }}
        >
          {file.issueCount}
        </span>
      </div>

      {/* Expanded element list */}
      {isExpanded && (
        <div
          style={{
            backgroundColor: "rgba(17, 24, 39, 0.4)",
            borderTop: `1px solid ${STYLES.border}`,
            borderBottom: `1px solid ${STYLES.border}`,
          }}
        >
          {file.elementsWithIssues.map((item) => (
            <ElementRow
              key={item.element.id}
              item={item}
              onHover={onElementHover}
              onClick={onElementClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Element row within an expanded file
 */
interface ElementRowProps {
  item: ElementWithIssues;
  onHover: (element: ScannedElement | null) => void;
  onClick: (element: ScannedElement) => void;
}

function ElementRow({ item, onHover, onClick }: ElementRowProps) {
  const { element, issueCount } = item;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "6px 12px 6px 34px",
        cursor: "pointer",
        transition: STYLES.transitionFast,
        backgroundColor: "transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.15)";
        onHover(element);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
      onClick={() => onClick(element)}
    >
      {/* Element tag and line number */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          flex: 1,
          marginRight: "12px",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontFamily: STYLES.fontMono,
            color: STYLES.accent,
          }}
        >
          &lt;{element.tagName}&gt;
        </span>
        <span
          style={{
            fontSize: "10px",
            color: STYLES.textDim,
          }}
        >
          :{element.source.lineNumber}
        </span>
      </div>

      {/* Issue count badge */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: "18px",
          height: "16px",
          padding: "0 5px",
          borderRadius: "8px",
          backgroundColor: getStatusColor(issueCount),
          color: "#FFFFFF",
          fontSize: "9px",
          fontWeight: 700,
        }}
      >
        {issueCount}
      </span>
    </div>
  );
}
