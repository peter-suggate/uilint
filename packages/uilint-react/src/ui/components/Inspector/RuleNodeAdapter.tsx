/**
 * RuleNodeAdapter - Transform issues into rule-first hierarchy
 *
 * Converts flat issue data into a two-level hierarchy:
 * Level 0: Rules (aggregated across all files)
 * Level 1: Files (for each rule, which files have issues)
 */

import type { HierarchyNode, SeverityCounts } from "../HierarchicalTiles";
import type { FileGroup } from "../../../core/store/file-groups-selector";
import type { AvailableRule } from "../../../plugins/eslint/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Data payload for rule hierarchy nodes.
 * Contains aggregated rule information across all files.
 */
export interface RuleData {
  ruleId: string;
  ruleName: string;
  highestSeverity: "error" | "warning" | "info";
  files: FileForRule[];
}

/**
 * File information within a rule's hierarchy.
 * Represents a single file that has issues for a specific rule.
 */
export interface FileForRule {
  filePath: string;
  fileName: string;
  directory: string;
  issueCount: number;
  severityCounts: SeverityCounts;
  issues: Array<{
    id: string;
    message: string;
    severity: "error" | "warning" | "info";
    line: number;
    column?: number;
  }>;
}

/**
 * Type alias for rule-based hierarchy nodes.
 * Represents a rule in the hierarchical tiles structure.
 */
export type RuleNode = HierarchyNode<RuleData>;

/**
 * Type alias for file nodes within a rule's hierarchy.
 * Represents a file containing issues for a specific rule.
 */
export type FileForRuleNode = HierarchyNode<FileForRule>;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format count text: "X issues in Y files" or "X issue in Y file"
 */
function formatCountText(issueCount: number, fileCount: number): string {
  if (issueCount === 0) return "No issues";
  const issuePlural = issueCount === 1 ? "issue" : "issues";
  const filePlural = fileCount === 1 ? "file" : "files";
  return `${issueCount} ${issuePlural} in ${fileCount} ${filePlural}`;
}

/**
 * Get a short rule name from a potentially namespaced rule ID.
 * Handles namespaced rules like "@typescript-eslint/no-unused-vars".
 */
function getShortRuleName(ruleId: string): string {
  if (ruleId.includes("/")) {
    return ruleId.split("/").pop() || ruleId;
  }
  return ruleId;
}

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform FileGroup[] into RuleNode[] (rule-first hierarchy)
 *
 * Aggregates issues by rule across all files, creating a two-level structure:
 * - Level 0: Rules sorted by severity (errors first), then by count
 * - Level 1: Files for each rule, also sorted by severity then count
 *
 * When availableRules is provided, rules with zero issues are also included
 * so users can discover and configure them.
 *
 * @param fileGroups - Array of FileGroup objects from the selector
 * @param availableRules - Optional array of all available rules (to include zero-issue rules)
 * @returns Array of RuleNode objects ready for HierarchicalTiles
 */
export function fileGroupsToRuleNodes(
  fileGroups: FileGroup[],
  availableRules: AvailableRule[] = []
): RuleNode[] {
  // Aggregate issues by rule across all files
  const ruleMap = new Map<
    string,
    {
      ruleId: string;
      ruleName: string;
      totalCount: number;
      severityCounts: SeverityCounts;
      highestSeverity: "error" | "warning" | "info";
      files: Map<string, FileForRule>;
    }
  >();

  for (const fileGroup of fileGroups) {
    for (const issue of fileGroup.issues) {
      const ruleId = issue.ruleId || "unknown";
      const ruleName = getShortRuleName(ruleId);

      if (!ruleMap.has(ruleId)) {
        ruleMap.set(ruleId, {
          ruleId,
          ruleName,
          totalCount: 0,
          severityCounts: { error: 0, warning: 0, info: 0 },
          highestSeverity: "info",
          files: new Map(),
        });
      }

      const rule = ruleMap.get(ruleId)!;
      rule.totalCount++;
      rule.severityCounts[issue.severity]++;

      // Update highest severity
      if (issue.severity === "error") {
        rule.highestSeverity = "error";
      } else if (issue.severity === "warning" && rule.highestSeverity !== "error") {
        rule.highestSeverity = "warning";
      }

      // Add to file map
      if (!rule.files.has(fileGroup.filePath)) {
        rule.files.set(fileGroup.filePath, {
          filePath: fileGroup.filePath,
          fileName: fileGroup.fileName,
          directory: fileGroup.directory,
          issueCount: 0,
          severityCounts: { error: 0, warning: 0, info: 0 },
          issues: [],
        });
      }

      const file = rule.files.get(fileGroup.filePath)!;
      file.issueCount++;
      file.severityCounts[issue.severity]++;
      file.issues.push({
        id: issue.id,
        message: issue.message,
        severity: issue.severity,
        line: issue.line,
        column: issue.column,
      });
    }
  }

  // Add available rules that have no issues yet
  for (const rule of availableRules) {
    if (!ruleMap.has(rule.id)) {
      ruleMap.set(rule.id, {
        ruleId: rule.id,
        ruleName: rule.name || getShortRuleName(rule.id),
        totalCount: 0,
        severityCounts: { error: 0, warning: 0, info: 0 },
        highestSeverity: "info",
        files: new Map(),
      });
    }
  }

  // Convert to RuleNode array, sorted by severity then count
  const ruleNodes: RuleNode[] = Array.from(ruleMap.values())
    .sort((a, b) => {
      // Sort by severity first (error > warning > info)
      const severityOrder = { error: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[a.highestSeverity] - severityOrder[b.highestSeverity];
      if (severityDiff !== 0) return severityDiff;
      // Then by count
      return b.totalCount - a.totalCount;
    })
    .map((rule) => {
      // Gather top preview messages from issues across all files
      const allIssues = Array.from(rule.files.values()).flatMap((f) => f.issues);
      const previewMessages = allIssues.slice(0, 3).map((i) => i.message);

      return {
        id: rule.ruleId,
        label: rule.ruleName,
        subtitle: formatCountText(rule.totalCount, rule.files.size),
        count: rule.totalCount,
        previewMessages,
        fileCount: rule.files.size,
        data: {
          ruleId: rule.ruleId,
          ruleName: rule.ruleName,
          highestSeverity: rule.highestSeverity,
          files: Array.from(rule.files.values()),
        },
        hasChildren: true,
        isLeaf: false,
      };
    });

  return ruleNodes;
}

/**
 * Get file nodes for a specific rule.
 *
 * Transforms a RuleNode's file data into FileForRuleNode[] for
 * rendering the second level of the hierarchy.
 *
 * @param ruleNode - The RuleNode to extract file nodes from
 * @returns Array of FileForRuleNode objects sorted by severity then count
 */
export function getFileNodesForRule(ruleNode: RuleNode): FileForRuleNode[] {
  return ruleNode.data.files
    .sort((a, b) => {
      // Sort by severity first, then count
      const severityOrder = { error: 0, warning: 1, info: 2 };
      const aHighest =
        a.severityCounts.error > 0 ? "error" : a.severityCounts.warning > 0 ? "warning" : "info";
      const bHighest =
        b.severityCounts.error > 0 ? "error" : b.severityCounts.warning > 0 ? "warning" : "info";
      const severityDiff = severityOrder[aHighest] - severityOrder[bHighest];
      if (severityDiff !== 0) return severityDiff;
      return b.issueCount - a.issueCount;
    })
    .map((file) => ({
      id: `${ruleNode.id}:${file.filePath}`,
      label: file.fileName,
      subtitle: file.filePath,
      tileType: "file" as const,
      count: file.issueCount,
      severityCounts: file.severityCounts,
      data: file,
      isLeaf: true,
    }));
}
