/**
 * Fuzzy search hook for command palette
 */

import { useMemo } from "react";
import type {
  SearchableItem,
  ScoredSearchResult,
  RuleSearchData,
  FileSearchData,
  CaptureSearchData,
  IssueSearchData,
  CategoryType,
  CommandPaletteFilter,
} from "./types";
import type { ScannedElement, ElementIssue, ESLintIssue, ScreenshotCapture } from "../types";
import { groupBySourceFile } from "../dom-utils";

/**
 * Calculate fuzzy match score between text and query
 * Higher score = better match
 */
function fuzzyScore(text: string, query: string): number {
  if (!query) return 1; // Empty query matches everything
  if (!text) return 0;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match gets highest score
  if (lowerText === lowerQuery) return 100;

  // Starts with query gets high score
  if (lowerText.startsWith(lowerQuery)) return 80;

  // Contains exact query gets good score
  if (lowerText.includes(lowerQuery)) return 60;

  // Fuzzy matching: all query chars must appear in order
  let score = 0;
  let textIndex = 0;
  let prevMatchIndex = -1;

  for (const char of lowerQuery) {
    const foundIndex = lowerText.indexOf(char, textIndex);
    if (foundIndex === -1) return 0; // Query char not found

    // Bonus for consecutive matches
    if (foundIndex === prevMatchIndex + 1) {
      score += 3;
    }

    // Bonus for word boundary matches (after space, /, -, _, .)
    if (
      foundIndex === 0 ||
      " /-_.".includes(lowerText[foundIndex - 1] || "")
    ) {
      score += 5;
    }

    // Base score for finding the character
    score += 1;

    prevMatchIndex = foundIndex;
    textIndex = foundIndex + 1;
  }

  // Penalize long texts slightly (prefer shorter matches)
  const lengthPenalty = Math.max(0, (text.length - query.length) * 0.05);

  return Math.max(0, score - lengthPenalty);
}

/**
 * Apply a single filter to items
 */
function applyFilter(
  items: SearchableItem[],
  filter: CommandPaletteFilter
): SearchableItem[] {
  switch (filter.type) {
    case "rule": {
      // Filter to items with this ruleId OR issues from that rule
      const fullRuleId = filter.value.startsWith("uilint/")
        ? filter.value
        : `uilint/${filter.value}`;
      return items.filter((item) => {
        if (item.type === "rule") {
          const ruleData = item.data as RuleSearchData;
          return (
            ruleData.rule.id === filter.value ||
            `uilint/${ruleData.rule.id}` === fullRuleId
          );
        }
        if (item.type === "issue") {
          const issueData = item.data as IssueSearchData;
          return issueData.issue.ruleId === fullRuleId;
        }
        return false;
      });
    }

    case "loc": {
      // Filter to items at a specific source location (filePath:line:column)
      // This matches issues that belong to elements at that source location
      // The filter value format is: filePath:line or filePath:line:column
      const locValue = filter.value;

      // Helper to check if a loc string matches the filter value
      // Handles both exact match and match without column
      const matchesLoc = (loc: string): boolean => {
        if (loc === locValue) {
          return true;
        }
        // Check if filter (without column) matches the loc's file:line portion
        const lastIdx = loc.lastIndexOf(":");
        const secondLastIdx = loc.lastIndexOf(":", lastIdx - 1);
        if (secondLastIdx >= 0) {
          const fileAndLine = loc.slice(0, lastIdx);
          if (fileAndLine === locValue) {
            return true;
          }
        }
        return false;
      };

      // Parse filePath:line:column from a loc string
      const parseLocParts = (loc: string): { filePath: string; line: number; column?: number } | null => {
        const lastIdx = loc.lastIndexOf(":");
        const secondLastIdx = loc.lastIndexOf(":", lastIdx - 1);
        if (secondLastIdx < 0) return null;

        const filePath = loc.slice(0, secondLastIdx);
        const line = parseInt(loc.slice(secondLastIdx + 1, lastIdx), 10);
        const column = parseInt(loc.slice(lastIdx + 1), 10);

        if (isNaN(line)) return null;
        return { filePath, line, column: isNaN(column) ? undefined : column };
      };

      return items.filter((item) => {
        if (item.type === "issue") {
          const issueData = item.data as IssueSearchData;

          // Method 1: Check if the issue's dataLoc matches the filter value
          // dataLoc format is: filePath:line:column
          if (issueData.issue.dataLoc && matchesLoc(issueData.issue.dataLoc)) {
            return true;
          }

          // Method 2: Check if the elementId contains the location
          // elementId format is: loc:path:line:column#occurrence
          if (issueData.elementId) {
            // Extract location from elementId (remove "loc:" prefix and "#occurrence" suffix)
            const withoutPrefix = issueData.elementId.replace(/^loc:/, "");
            const withoutOccurrence = withoutPrefix.replace(/#\d+$/, "");
            if (matchesLoc(withoutOccurrence)) {
              return true;
            }
          }

          // Method 3: For file-level issues, check the elementLoc (first element in file)
          if (issueData.elementLoc && matchesLoc(issueData.elementLoc)) {
            return true;
          }

          // Method 4: Check if the issue's own line:column matches the filter value
          // The issue has its own line/column (where the issue occurs within the element)
          // which may differ from the element's dataLoc (where the element starts)
          const filterParts = parseLocParts(locValue);
          if (filterParts && issueData.issue.line === filterParts.line) {
            // Check if filePath matches
            if (issueData.filePath === filterParts.filePath) {
              // If filter has column, check column match too
              if (filterParts.column === undefined || issueData.issue.column === filterParts.column) {
                return true;
              }
            }
          }

          return false;
        }
        return false;
      });
    }

    case "file": {
      // Filter to items from a specific file
      return items.filter((item) => {
        if (item.type === "file") {
          const fileData = item.data as FileSearchData;
          return fileData.sourceFile.path === filter.value;
        }
        if (item.type === "issue") {
          const issueData = item.data as IssueSearchData;
          return issueData.filePath === filter.value;
        }
        return false;
      });
    }

    case "issue": {
      // Filter to a specific issue (show expanded)
      return items.filter((item) => item.id === `issue:${filter.value}`);
    }

    case "capture": {
      // Filter to a specific capture and its issues
      return items.filter((item) => {
        if (item.type === "capture") {
          const captureData = item.data as CaptureSearchData;
          return captureData.capture.id === filter.value;
        }
        return false;
      });
    }

    default:
      return items;
  }
}

/**
 * Apply all filters to items
 * - Filters of the SAME type use UNION (OR) logic
 * - Filters of DIFFERENT types use INTERSECTION (AND) logic
 */
function applyFilters(
  items: SearchableItem[],
  filters: CommandPaletteFilter[]
): SearchableItem[] {
  if (filters.length === 0) return items;

  // Group filters by type
  const filtersByType = new Map<CommandPaletteFilter["type"], CommandPaletteFilter[]>();
  for (const filter of filters) {
    const existing = filtersByType.get(filter.type) || [];
    existing.push(filter);
    filtersByType.set(filter.type, existing);
  }

  // Apply union logic within each type, intersection across types
  let filteredItems = items;
  for (const [, typeFilters] of filtersByType) {
    if (typeFilters.length === 1) {
      // Single filter of this type - apply directly
      filteredItems = applyFilter(filteredItems, typeFilters[0]);
    } else {
      // Multiple filters of same type - union (OR) logic
      const unionResults = new Set<SearchableItem>();
      for (const filter of typeFilters) {
        const matchingItems = applyFilter(filteredItems, filter);
        matchingItems.forEach((item) => unionResults.add(item));
      }
      filteredItems = Array.from(unionResults);
    }
  }

  return filteredItems;
}

/**
 * Hook to perform fuzzy search over items with optional filters
 * When query is empty, returns items grouped by category
 */
export function useFuzzySearch(
  query: string,
  items: SearchableItem[],
  filters: CommandPaletteFilter[] = []
): ScoredSearchResult[] {
  return useMemo(() => {
    // First apply filters
    const filteredItems = applyFilters(items, filters);

    if (!query.trim()) {
      // No query - return all items sorted by category priority
      const categoryOrder: CategoryType[] = ["actions", "rules", "captures", "files", "issues"];

      return filteredItems
        .map((item) => ({ item, score: 1 }))
        .sort((a, b) => {
          const aOrder = categoryOrder.indexOf(a.item.category);
          const bOrder = categoryOrder.indexOf(b.item.category);
          return aOrder - bOrder;
        });
    }

    // Score all items
    const scored = filteredItems
      .map((item) => ({
        item,
        score: fuzzyScore(item.searchText, query),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    return scored;
  }, [query, items, filters]);
}

/**
 * Get display name for a file path (just the filename)
 */
function getDisplayName(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}

/**
 * Build searchable items from store data
 * Includes rules, files, captures, and issues (but not actions - those are built separately)
 */
export function buildSearchableItems(
  elements: ScannedElement[],
  elementIssuesCache: Map<string, ElementIssue>,
  fileIssuesCache: Map<string, ESLintIssue[]>,
  rules: Array<{
    id: string;
    name: string;
    description: string;
    category: "static" | "semantic";
    defaultSeverity: "error" | "warn" | "off";
  }>,
  disabledRules: Set<string>,
  screenshotHistory: Map<string, ScreenshotCapture>
): SearchableItem[] {
  const items: SearchableItem[] = [];

  // Group elements by source file
  const sourceFiles = groupBySourceFile(elements);

  // Count issues per rule (for rule items)
  const issueCountsByRule = new Map<string, number>();
  for (const [, elementIssue] of elementIssuesCache) {
    for (const issue of elementIssue.issues) {
      if (issue.ruleId) {
        const ruleId = issue.ruleId.replace("uilint/", "");
        issueCountsByRule.set(ruleId, (issueCountsByRule.get(ruleId) || 0) + 1);
      }
    }
  }
  for (const [, issues] of fileIssuesCache) {
    for (const issue of issues) {
      if (issue.ruleId) {
        const ruleId = issue.ruleId.replace("uilint/", "");
        issueCountsByRule.set(ruleId, (issueCountsByRule.get(ruleId) || 0) + 1);
      }
    }
  }

  // Add rules (always show, even without issues)
  for (const rule of rules) {
    const issueCount = issueCountsByRule.get(rule.id) || 0;
    items.push({
      type: "rule",
      category: "rules",
      id: `rule:${rule.id}`,
      searchText: `${rule.name} ${rule.id} ${rule.description}`,
      title: rule.name,
      subtitle: rule.description,
      issueCount,
      data: {
        type: "rule",
        rule,
        enabled: !disabledRules.has(rule.id),
      } as RuleSearchData,
    });
  }

  // Add captures/screenshots
  const sortedScreenshots = Array.from(screenshotHistory.values()).sort(
    (a, b) => b.timestamp - a.timestamp
  );
  for (const capture of sortedScreenshots) {
    const issueCount = capture.issues?.length || 0;
    const routeDisplay = capture.route === "/" ? "/home" : capture.route;
    const timeDisplay = new Date(capture.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    items.push({
      type: "capture",
      category: "captures",
      id: `capture:${capture.id}`,
      searchText: `${capture.route} screenshot capture vision ${timeDisplay}`,
      title: routeDisplay,
      subtitle: `${issueCount} issues - ${timeDisplay}`,
      issueCount,
      data: {
        type: "capture",
        capture,
        issues: capture.issues || [],
      } as CaptureSearchData,
    });
  }

  // Add files with issues
  for (const file of sourceFiles) {
    let issueCount = 0;

    // Count element issues
    for (const el of file.elements) {
      const cached = elementIssuesCache.get(el.id);
      if (cached) {
        issueCount += cached.issues.length;
      }
    }

    // Count file-level issues
    const fileIssues = fileIssuesCache.get(file.path);
    if (fileIssues) {
      issueCount += fileIssues.length;
    }

    // Only add files that have issues
    if (issueCount > 0) {
      items.push({
        type: "file",
        category: "files",
        id: `file:${file.path}`,
        searchText: `${file.displayName} ${file.path}`,
        title: file.displayName,
        subtitle: file.path,
        issueCount,
        data: {
          type: "file",
          sourceFile: file,
          issueCount,
        } as FileSearchData,
      });
    }
  }

  // Add individual issues (for search)
  for (const [elementId, elementIssue] of elementIssuesCache) {
    for (const issue of elementIssue.issues) {
      // Find the element to get its file
      const element = elements.find((el) => el.id === elementId);
      const filePath = element?.source.fileName || "";

      items.push({
        type: "issue",
        category: "issues",
        id: `issue:${elementId}:${issue.ruleId}:${issue.line}:${issue.column}`,
        searchText: `${issue.message} ${issue.ruleId} ${getDisplayName(filePath)}`,
        title: issue.message,
        subtitle: `${issue.ruleId} - ${getDisplayName(filePath)}`,
        data: {
          type: "issue",
          issue,
          elementId,
          filePath,
        } as IssueSearchData,
      });
    }
  }

  // Add file-level issues
  // For loc filter matching, find the first element in each file to use as the display location
  const firstElementByFile = new Map<string, ScannedElement>();
  for (const element of elements) {
    const existing = firstElementByFile.get(element.source.fileName);
    if (
      !existing ||
      element.source.lineNumber < existing.source.lineNumber ||
      (element.source.lineNumber === existing.source.lineNumber &&
        (element.source.columnNumber || 0) < (existing.source.columnNumber || 0))
    ) {
      firstElementByFile.set(element.source.fileName, element);
    }
  }

  for (const [filePath, issues] of fileIssuesCache) {
    // Get the first element's location for this file (used for loc filter matching)
    const firstElement = firstElementByFile.get(filePath);
    const elementLoc = firstElement
      ? `${firstElement.source.fileName}:${firstElement.source.lineNumber}${firstElement.source.columnNumber ? `:${firstElement.source.columnNumber}` : ""}`
      : undefined;

    for (const issue of issues) {
      items.push({
        type: "issue",
        category: "issues",
        id: `issue:file:${filePath}:${issue.ruleId}:${issue.line}:${issue.column}`,
        searchText: `${issue.message} ${issue.ruleId} ${getDisplayName(filePath)}`,
        title: issue.message,
        subtitle: `${issue.ruleId} - ${getDisplayName(filePath)}`,
        data: {
          type: "issue",
          issue,
          filePath,
          elementLoc,
        } as IssueSearchData,
      });
    }
  }

  return items;
}
