/**
 * ESLint Search Provider
 *
 * Implements getSearchItems and getPreviewPanel hooks for the
 * two-panel command palette. Reuses existing tile-provider helpers.
 */

import { createElement } from "react";
import type {
  SearchItem,
  PreviewPanelResult,
  PluginServices,
} from "../../core/plugin-system/types";
import { getAllIssues, getAvailableRules, countSeverities } from "./tile-provider";
import type { Issue } from "../../ui/types";
import { RulePreviewPanel } from "./panels/RulePreviewPanel";
import { FilePreviewPanel } from "./panels/FilePreviewPanel";

/**
 * Get searchable items for the two-panel command palette.
 * Groups issues by rule and by file, populating search fields for fuzzy matching.
 */
export function getSearchItems(services: PluginServices): SearchItem[] {
  const allIssues = getAllIssues(services);
  const availableRules = getAvailableRules(services);
  const items: SearchItem[] = [];

  // --- Rule items ---
  const issuesByRule = new Map<string, Issue[]>();
  for (const issue of allIssues) {
    const existing = issuesByRule.get(issue.ruleId) || [];
    issuesByRule.set(issue.ruleId, [...existing, issue]);
  }

  const ruleMetadata = new Map(availableRules.map((r) => [r.id, r]));

  for (const [ruleId, ruleIssues] of issuesByRule) {
    const meta = ruleMetadata.get(ruleId);
    const shortName = ruleId.includes("/") ? ruleId.split("/").pop()! : ruleId;
    const uniqueFiles = new Set(ruleIssues.map((i) => i.filePath));

    items.push({
      id: `rule:${ruleId}`,
      section: "rules",
      label: meta?.name || shortName,
      subtitle: ruleId,
      severityCounts: countSeverities(ruleIssues),
      count: ruleIssues.length,
      fileCount: uniqueFiles.size,
      searchFields: {
        label: meta?.name || shortName,
        subtitle: meta?.description,
        keywords: [ruleId, shortName, meta?.category || ""].filter(Boolean),
        extra: ruleIssues.slice(0, 20).map((i) => i.message),
      },
      metadata: { ruleId, tileType: "rule" },
    });
  }

  // --- File items ---
  const issuesByFile = new Map<string, Issue[]>();
  for (const issue of allIssues) {
    const existing = issuesByFile.get(issue.filePath) || [];
    issuesByFile.set(issue.filePath, [...existing, issue]);
  }

  for (const [filePath, fileIssues] of issuesByFile) {
    const fileName = filePath.split("/").pop() || filePath;
    const uniqueRules = new Set(fileIssues.map((i) => i.ruleId));

    items.push({
      id: `file:${filePath}`,
      section: "files",
      label: fileName,
      subtitle: filePath,
      severityCounts: countSeverities(fileIssues),
      count: fileIssues.length,
      fileCount: uniqueRules.size,
      searchFields: {
        label: fileName,
        subtitle: filePath,
        keywords: Array.from(uniqueRules),
        extra: fileIssues.slice(0, 20).map((i) => i.message),
      },
      metadata: { filePath, tileType: "file" },
    });
  }

  // Sort: errors first, then by count
  items.sort((a, b) => {
    const aErr = a.severityCounts?.error ?? 0;
    const bErr = b.severityCounts?.error ?? 0;
    if (aErr !== bErr) return bErr - aErr;
    return (b.count ?? 0) - (a.count ?? 0);
  });

  return items;
}

/**
 * Get a preview panel element for a selected search item.
 * Routes to RulePreviewPanel or FilePreviewPanel based on item type.
 */
export function getPreviewPanel(
  item: SearchItem,
  services: PluginServices
): PreviewPanelResult {
  const tileType = item.metadata?.tileType as string | undefined;

  if (tileType === "rule") {
    const ruleId = item.metadata?.ruleId as string;
    return {
      element: createElement(RulePreviewPanel, { ruleId, services }),
    };
  }

  if (tileType === "file") {
    const filePath = item.metadata?.filePath as string;
    return {
      element: createElement(FilePreviewPanel, { filePath, services }),
    };
  }

  return null;
}
