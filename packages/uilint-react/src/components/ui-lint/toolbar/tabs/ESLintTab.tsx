"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useUILintStore, type UILintStore } from "../../store";
import { useUILintContext } from "../../UILintProvider";
import { groupBySourceFile } from "../../dom-utils";
import { FileTree, type FileWithIssues } from "../../scan-results/FileTree";
import { SearchFilter } from "../../scan-results/SearchFilter";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  ScannedElement,
  LocatorTarget,
  ESLintIssue,
  SourceLocation,
} from "../../types";

/**
 * Get a disambiguated display name for files with duplicate names
 */
function getDisambiguatedName(path: string, allPaths: string[]): string {
  const parts = path.split("/");
  const fileName = parts[parts.length - 1] || path;

  const duplicates = allPaths.filter((p) => {
    const pParts = p.split("/");
    return pParts[pParts.length - 1] === fileName && p !== path;
  });

  if (duplicates.length === 0) {
    return fileName;
  }

  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${fileName}`;
  }

  return fileName;
}

export function ESLintTab() {
  const { autoScanState } = useUILintContext();
  const elementIssuesCache = useUILintStore((s) => s.elementIssuesCache);
  const fileIssuesCache = useUILintStore((s) => s.fileIssuesCache);
  const setLocatorTarget = useUILintStore((s) => s.setLocatorTarget);
  const setInspectedElement = useUILintStore((s) => s.setInspectedElement);

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const isScanning = autoScanState.status === "scanning";
  const isComplete = autoScanState.status === "complete";

  const allFilesWithIssues = useMemo<FileWithIssues[]>(() => {
    const sourceFiles = groupBySourceFile(autoScanState.elements);
    const allPaths = sourceFiles.map((sf) => sf.path);
    const filePathsSet = new Set(allPaths);

    const result: FileWithIssues[] = [];

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
      const totalIssues =
        elementsWithIssues.reduce((sum, e) => sum + e.issueCount, 0) +
        fileLevelIssues.length;

      if (totalIssues > 0) {
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

    for (const [filePath, fileLevelIssues] of fileIssuesCache.entries()) {
      if (!filePathsSet.has(filePath) && fileLevelIssues.length > 0) {
        const parts = filePath.split("/");
        const displayName = parts[parts.length - 1] || filePath;
        result.push({
          path: filePath,
          displayName,
          disambiguatedName: getDisambiguatedName(filePath, [
            ...allPaths,
            filePath,
          ]),
          issueCount: fileLevelIssues.length,
          elementsWithIssues: [],
          fileLevelIssues,
        });
      }
    }

    return result.sort((a, b) => b.issueCount - a.issueCount);
  }, [autoScanState.elements, elementIssuesCache, fileIssuesCache]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return allFilesWithIssues;
    const query = searchQuery.toLowerCase().trim();
    const tagQuery = query.replace(/[<>]/g, "").replace("/", "").trim();

    return allFilesWithIssues
      .map((file) => {
        const fileMatches =
          file.path.toLowerCase().includes(query) ||
          file.displayName.toLowerCase().includes(query);
        const matchingElements = file.elementsWithIssues.filter(
          (item: any) =>
            item.element.tagName.toLowerCase().includes(tagQuery) ||
            item.ruleIds.some((r: string) => r.toLowerCase().includes(query))
        );

        if (fileMatches) return file;
        if (matchingElements.length > 0) {
          return {
            ...file,
            elementsWithIssues: matchingElements,
            issueCount: matchingElements.reduce(
              (sum: number, e: any) => sum + e.issueCount,
              0
            ),
          };
        }
        return null;
      })
      .filter((f): f is FileWithIssues => f !== null);
  }, [allFilesWithIssues, searchQuery]);

  const toggleFile = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleElementHover = useCallback(
    (element: ScannedElement | null) => {
      if (!element) {
        setLocatorTarget(null);
        return;
      }
      setLocatorTarget({
        element: element.element,
        source: element.source,
        rect: element.element.getBoundingClientRect(),
      });
    },
    [setLocatorTarget]
  );

  const handleElementClick = useCallback(
    (element: ScannedElement) => {
      element.element.scrollIntoView({ behavior: "smooth", block: "center" });
      setInspectedElement({
        element: element.element,
        source: element.source,
        rect: element.element.getBoundingClientRect(),
        scannedElementId: element.id,
      });
      setLocatorTarget(null);
    },
    [setInspectedElement, setLocatorTarget]
  );

  const handleFileLevelIssueClick = useCallback(
    (filePath: string, issue: ESLintIssue) => {
      const dummyElement = document.createElement("div");
      dummyElement.style.position = "fixed";
      dummyElement.style.top = "-9999px";
      document.body.appendChild(dummyElement);
      setInspectedElement({
        element: dummyElement,
        source: {
          fileName: filePath,
          lineNumber: issue.line,
          columnNumber: issue.column,
        },
        rect: new DOMRect(0, 0, 0, 0),
      });
    },
    [setInspectedElement]
  );

  const progress =
    autoScanState.totalElements > 0
      ? (autoScanState.currentIndex / autoScanState.totalElements) * 100
      : 0;

  return (
    <div className="space-y-4">
      {allFilesWithIssues.length > 0 && (
        <SearchFilter value={searchQuery} onChange={setSearchQuery} />
      )}

      {isScanning && (
        <div className="space-y-1 px-1">
          <div className="flex justify-between text-[10px] text-zinc-500">
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

      <ScrollArea className="max-h-[300px] -mx-3">
        <div className="px-3" onMouseLeave={() => handleElementHover(null)}>
          {filteredFiles.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              {isScanning
                ? "Scanning page elements..."
                : searchQuery
                ? `No matches for "${searchQuery}"`
                : isComplete
                ? "✓ No issues found"
                : "No files scanned"}
            </div>
          ) : (
            <FileTree
              files={filteredFiles}
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
