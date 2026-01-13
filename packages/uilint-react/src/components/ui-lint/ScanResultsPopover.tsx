"use client";

/**
 * Scan Results Popover - Shows file-grouped scan results with expandable sections
 *
 * Refactored to use cult-ui PopoverContent and smaller component modules:
 * - FileTree: Expandable file list
 * - IssueRow: Individual issue display
 * - SearchFilter: Filter input component
 */

import React, { useState, useCallback, useMemo } from "react";
import { useUILintContext } from "./UILintProvider";
import { useUILintStore, type UILintStore } from "./store";
import { groupBySourceFile } from "./dom-utils";
import { getCachedSource, fetchSource } from "./source-fetcher";
import type {
  ScannedElement,
  LocatorTarget,
  ESLintIssue,
  SourceLocation,
} from "./types";
import { FileTree, type FileWithIssues } from "./scan-results/FileTree";
import { SearchFilter } from "./scan-results/SearchFilter";
import { PopoverHeader, PopoverBody } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
  const { autoScanState } = useUILintContext();

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
      const elementsWithIssues: Array<{
        element: ScannedElement;
        issueCount: number;
        ruleIds: string[];
      }> = [];

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

  // Header text
  const headerText =
    allFilesWithIssues.length === 0
      ? "No issues found"
      : searchQuery
      ? `${filesWithIssues.length} of ${allFilesWithIssues.length} files`
      : `${filesWithIssues.length} ${
          filesWithIssues.length === 1 ? "file" : "files"
        } with ${totalAllIssues} ${totalAllIssues === 1 ? "issue" : "issues"}`;

  return (
    <div
      data-ui-lint
      className="flex flex-col w-80 max-h-[450px] overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg"
    >
      {/* Header */}
      <PopoverHeader className="flex items-center justify-between px-3 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          {headerText}
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 p-0 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
          title="Close"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </PopoverHeader>

      {/* Search and Progress */}
      <PopoverBody className="px-3 pt-3 pb-0 space-y-3">
        {/* Search input */}
        {allFilesWithIssues.length > 0 && (
          <SearchFilter value={searchQuery} onChange={setSearchQuery} />
        )}

        {/* Progress bar (only when scanning) */}
        {isScanning && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
              <span>Scanning...</span>
              <span>
                {autoScanState.currentIndex} / {autoScanState.totalElements}
              </span>
            </div>
            <div className="h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </PopoverBody>

      {/* File list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="py-1" onMouseLeave={() => handleElementHover(null)}>
          {filesWithIssues.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
              {isScanning ? (
                "Scanning page elements..."
              ) : searchQuery && allFilesWithIssues.length > 0 ? (
                <span>No matches for "{searchQuery}"</span>
              ) : isComplete ? (
                <span className="text-green-600 dark:text-green-400">
                  ✓ No issues found
                </span>
              ) : (
                "No files scanned"
              )}
            </div>
          ) : (
            <FileTree
              files={filesWithIssues}
              expandedFiles={expandedFiles}
              onToggleFile={toggleFile}
              onElementHover={handleElementHover}
              onElementClick={handleElementClick}
              onFileLevelIssueClick={handleFileLevelIssueClick}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
