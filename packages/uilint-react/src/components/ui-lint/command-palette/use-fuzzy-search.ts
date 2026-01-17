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
 * Hook to perform fuzzy search over items
 * When query is empty, returns items grouped by category
 */
export function useFuzzySearch(
  query: string,
  items: SearchableItem[]
): ScoredSearchResult[] {
  return useMemo(() => {
    if (!query.trim()) {
      // No query - return all items sorted by category priority
      const categoryOrder: CategoryType[] = ["actions", "rules", "captures", "files", "issues"];

      return items
        .map((item) => ({ item, score: 1 }))
        .sort((a, b) => {
          const aOrder = categoryOrder.indexOf(a.item.category);
          const bOrder = categoryOrder.indexOf(b.item.category);
          return aOrder - bOrder;
        });
    }

    // Score all items
    const scored = items
      .map((item) => ({
        item,
        score: fuzzyScore(item.searchText, query),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    return scored;
  }, [query, items]);
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
  for (const [filePath, issues] of fileIssuesCache) {
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
        } as IssueSearchData,
      });
    }
  }

  return items;
}
