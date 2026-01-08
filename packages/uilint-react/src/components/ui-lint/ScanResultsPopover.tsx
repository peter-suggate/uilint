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
import { ChevronIcon } from "./toolbar-icons";
import { Badge } from "./Badge";
import type {
  ScannedElement,
  LocatorTarget,
  ESLintIssue,
  SourceLocation,
} from "./types";

interface FileWithIssues {
  path: string;
  displayName: string;
  disambiguatedName: string;
  issueCount: number;
  elementsWithIssues: ElementWithIssues[];
  fileLevelIssues: ESLintIssue[];
}

interface ElementWithIssues {
  element: ScannedElement;
  issueCount: number;
  ruleIds: string[];
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

interface ScanResultsPopoverProps {
  onClose: () => void;
}

export function ScanResultsPopover({ onClose }: ScanResultsPopoverProps) {
  const { autoScanState, liveScanEnabled } = useUILintContext();

  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );

  const fileIssuesCache = useUILintStore((s: UILintStore) => s.fileIssuesCache);

  const setLocatorTarget = useUILintStore(
    (s: UILintStore) => s.setLocatorTarget
  );

  const setInspectedElement = useUILintStore(
    (s: UILintStore) => s.setInspectedElement
  );

  // Track which files are expanded
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Search filter state
  const [searchQuery, setSearchQuery] = useState("");

  const isScanning = autoScanState.status === "scanning";
  const isComplete = autoScanState.status === "complete";

  // Group elements by source file and filter to only those with issues
  const allFilesWithIssues = useMemo<FileWithIssues[]>(() => {
    const sourceFiles = groupBySourceFile(autoScanState.elements);
    const allPaths = sourceFiles.map((sf) => sf.path);
    const filePathsSet = new Set(sourceFiles.map((sf) => sf.path));

    const result: FileWithIssues[] = [];

    // Process files with scanned elements
    for (const sf of sourceFiles) {
      const elementsWithIssues: ElementWithIssues[] = [];

      for (const el of sf.elements) {
        const cached = elementIssuesCache.get(el.id);
        const issueCount = cached?.issues.length || 0;
        if (issueCount > 0) {
          const ruleIds = Array.from(
            new Set(
              (cached?.issues || [])
                .map((i) => i.ruleId)
                .filter((r): r is string => typeof r === "string")
            )
          );
          elementsWithIssues.push({ element: el, issueCount, ruleIds });
        }
      }

      const fileLevelIssues = fileIssuesCache.get(sf.path) || [];
      const elementIssueCount = elementsWithIssues.reduce(
        (sum, e) => sum + e.issueCount,
        0
      );
      const totalIssues = elementIssueCount + fileLevelIssues.length;

      // Include files that have either element issues or file-level issues
      if (totalIssues > 0) {
        // Sort elements by line number
        elementsWithIssues.sort(
          (a, b) => a.element.source.lineNumber - b.element.source.lineNumber
        );

        result.push({
          path: sf.path,
          displayName: sf.displayName,
          disambiguatedName: getDisambiguatedName(sf.path, allPaths),
          issueCount: totalIssues,
          elementsWithIssues,
          fileLevelIssues,
        });
      }
    }

    // Also include files that only have file-level issues (no scanned elements)
    for (const [filePath, fileLevelIssues] of fileIssuesCache.entries()) {
      if (!filePathsSet.has(filePath) && fileLevelIssues.length > 0) {
        // Extract display name from path
        const parts = filePath.split("/");
        const displayName = parts[parts.length - 1] || filePath;
        const allPaths = Array.from(filePathsSet).concat([filePath]);

        result.push({
          path: filePath,
          displayName,
          disambiguatedName: getDisambiguatedName(filePath, allPaths),
          issueCount: fileLevelIssues.length,
          elementsWithIssues: [],
          fileLevelIssues,
        });
      }
    }

    // Sort by issue count (highest first)
    result.sort((a, b) => b.issueCount - a.issueCount);

    return result;
  }, [autoScanState.elements, elementIssuesCache, fileIssuesCache]);

  // Apply search filter
  const filesWithIssues = useMemo<FileWithIssues[]>(() => {
    if (!searchQuery.trim()) {
      return allFilesWithIssues;
    }

    const raw = searchQuery.toLowerCase().trim();
    // Support queries like "<div>" by stripping angle brackets.
    const tagQuery = raw.replace(/[<>]/g, "").replace("/", "").trim();
    const query = raw;

    return allFilesWithIssues
      .map((file) => {
        // Check if file path/name matches
        const fileMatches =
          file.path.toLowerCase().includes(query) ||
          file.displayName.toLowerCase().includes(query) ||
          file.disambiguatedName.toLowerCase().includes(query);

        // Filter elements that match by tag name (<div>) or ruleId substring (consistent-spacing)
        const matchingElements = file.elementsWithIssues.filter((item) => {
          const tagMatches = item.element.tagName
            .toLowerCase()
            .includes(tagQuery);
          const ruleMatches = item.ruleIds.some((r) =>
            r.toLowerCase().includes(query)
          );
          return tagMatches || ruleMatches;
        });

        // If file matches, include all its elements
        if (fileMatches) {
          return file;
        }

        // If some elements match, return file with only matching elements
        if (matchingElements.length > 0) {
          const filteredIssueCount = matchingElements.reduce(
            (sum, e) => sum + e.issueCount,
            0
          );
          return {
            ...file,
            elementsWithIssues: matchingElements,
            issueCount: filteredIssueCount,
          };
        }

        return null;
      })
      .filter((file): file is FileWithIssues => file !== null);
  }, [allFilesWithIssues, searchQuery]);

  const totalIssues = filesWithIssues.reduce((sum, f) => sum + f.issueCount, 0);
  const totalAllIssues = allFilesWithIssues.reduce(
    (sum, f) => sum + f.issueCount,
    0
  );

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
        inline: "nearest",
        block: "nearest",
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

  // Handle file-level issue click - open inspection panel
  const handleFileLevelIssueClick = useCallback(
    (filePath: string, issue: ESLintIssue) => {
      // Create a synthetic element for file-level issues
      // We'll use a dummy element positioned off-screen
      const dummyElement = document.createElement("div");
      dummyElement.style.position = "fixed";
      dummyElement.style.top = "-9999px";
      dummyElement.style.left = "-9999px";
      document.body.appendChild(dummyElement);

      const source: SourceLocation = {
        fileName: filePath,
        lineNumber: issue.line,
        columnNumber: issue.column,
      };

      setInspectedElement({
        element: dummyElement,
        source,
        rect: new DOMRect(0, 0, 0, 0),
      });

      // Clean up dummy element when inspection closes
      // (handled by InspectionPanel when it closes)
    },
    [setInspectedElement]
  );

  return (
    <div
      data-ui-lint
      style={{
        position: "relative",
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
            {allFilesWithIssues.length === 0
              ? "No issues found"
              : searchQuery
              ? `${filesWithIssues.length} of ${allFilesWithIssues.length} files`
              : `${filesWithIssues.length} ${
                  filesWithIssues.length === 1 ? "file" : "files"
                } with ${totalAllIssues} ${
                  totalAllIssues === 1 ? "issue" : "issues"
                }`}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "26px",
              height: "26px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "transparent",
              color: STYLES.textMuted,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(55, 65, 81, 0.5)";
              e.currentTarget.style.color = STYLES.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = STYLES.textMuted;
            }}
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Search input */}
        {allFilesWithIssues.length > 0 && (
          <div style={{ marginTop: "10px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 10px",
                backgroundColor: "rgba(17, 24, 39, 0.6)",
                borderRadius: "6px",
                border: `1px solid ${STYLES.border}`,
              }}
            >
              <SearchIcon />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by file or tag..."
                style={{
                  flex: 1,
                  border: "none",
                  backgroundColor: "transparent",
                  color: STYLES.text,
                  fontSize: "11px",
                  fontFamily: STYLES.font,
                  outline: "none",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    border: "none",
                    backgroundColor: "rgba(75, 85, 99, 0.5)",
                    color: STYLES.textMuted,
                    cursor: "pointer",
                    padding: 0,
                  }}
                  title="Clear search"
                >
                  <ClearIcon />
                </button>
              )}
            </div>
          </div>
        )}

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
            ) : searchQuery && allFilesWithIssues.length > 0 ? (
              <span>No matches for "{searchQuery}"</span>
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
              onFileLevelIssueClick={handleFileLevelIssueClick}
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
  onFileLevelIssueClick: (filePath: string, issue: ESLintIssue) => void;
}

function FileRow({
  file,
  isExpanded,
  onToggle,
  onElementHover,
  onElementClick,
  onFileLevelIssueClick,
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
        <Badge count={file.issueCount} size="medium" />
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
          {/* File-level issues section */}
          {file.fileLevelIssues.length > 0 && (
            <>
              <div
                style={{
                  padding: "6px 12px 4px 34px",
                  fontSize: "10px",
                  fontWeight: 600,
                  color: STYLES.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                File-level issues
              </div>
              {file.fileLevelIssues.map((issue, index) => (
                <FileLevelIssueRow
                  key={`${issue.line}-${issue.column}-${index}`}
                  filePath={file.path}
                  issue={issue}
                  onClick={() => onFileLevelIssueClick(file.path, issue)}
                />
              ))}
              {file.elementsWithIssues.length > 0 && (
                <div
                  style={{
                    height: "1px",
                    backgroundColor: STYLES.border,
                    margin: "4px 12px",
                  }}
                />
              )}
            </>
          )}
          {/* Element-level issues */}
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
      <Badge count={issueCount} size="small" />
    </div>
  );
}

/**
 * File-level issue row (no associated DOM element)
 */
interface FileLevelIssueRowProps {
  filePath: string;
  issue: ESLintIssue;
  onClick: () => void;
}

function FileLevelIssueRow({
  filePath,
  issue,
  onClick,
}: FileLevelIssueRowProps) {
  const fileName = filePath.split("/").pop() || filePath;

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
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
      onClick={onClick}
    >
      {/* File name and line number */}
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
            color: STYLES.textMuted,
          }}
        >
          {fileName}
        </span>
        <span
          style={{
            fontSize: "10px",
            color: STYLES.textDim,
          }}
        >
          :{issue.line}
          {issue.column ? `:${issue.column}` : ""}
        </span>
      </div>

      {/* Issue count badge (always 1 for file-level issues) */}
      <Badge count={1} size="small" />
    </div>
  );
}

/**
 * Search icon for filter input
 */
function SearchIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <circle
        cx="11"
        cy="11"
        r="7"
        stroke={STYLES.textMuted}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M21 21l-4.35-4.35"
        stroke={STYLES.textMuted}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Clear icon for search input
 */
function ClearIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Close icon for popover header
 */
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
