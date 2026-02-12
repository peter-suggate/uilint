/**
 * Issues Selectors
 *
 * Zustand selectors for computing derived issue state.
 * Used by useIssues hook and components that display issues.
 */

import type { ComposedState } from "./composed-store";
import type { Issue, IssueSeverity } from "../../ui/types";

// ============================================================================
// Types
// ============================================================================

export interface SeverityCounts {
  error: number;
  warning: number;
  info: number;
}

// ============================================================================
// Stable Empty Values (prevent unnecessary re-renders)
// ============================================================================

const EMPTY_ISSUES: Issue[] = [];
const EMPTY_BY_FILE = new Map<string, Issue[]>();
const EMPTY_BY_DATALOC = new Map<string, Issue[]>();
const ZERO_SEVERITY_COUNTS: SeverityCounts = { error: 0, warning: 0, info: 0 };

// ============================================================================
// Selectors
// ============================================================================

/**
 * Selector to get the raw issues Map from the ESLint plugin state.
 * Returns the Map keyed by dataLoc, or an empty Map if not available.
 *
 * @param state - The composed store state
 * @returns Map of dataLoc to Issue[]
 */
export function selectIssuesMap(state: ComposedState): Map<string, Issue[]> {
  return state.plugins?.eslint?.issues ?? EMPTY_BY_DATALOC;
}

/**
 * Selector to get all issues as a flat array.
 * Flattens the Map values into a single Issue[].
 *
 * @param state - The composed store state
 * @returns All issues from all dataLocs
 */
export function selectAllIssues(state: ComposedState): Issue[] {
  const issuesMap = state.plugins?.eslint?.issues;
  if (!issuesMap || issuesMap.size === 0) {
    return EMPTY_ISSUES;
  }

  const allIssues: Issue[] = [];
  for (const issues of issuesMap.values()) {
    allIssues.push(...issues);
  }

  return allIssues;
}

/**
 * Selector to get issues grouped by file path.
 * Reorganizes issues from dataLoc-keyed to filePath-keyed Map.
 *
 * @param state - The composed store state
 * @returns Map of filePath to Issue[]
 */
export function selectIssuesByFile(state: ComposedState): Map<string, Issue[]> {
  const issuesMap = state.plugins?.eslint?.issues;
  if (!issuesMap || issuesMap.size === 0) {
    return EMPTY_BY_FILE;
  }

  const byFile = new Map<string, Issue[]>();

  for (const issues of issuesMap.values()) {
    for (const issue of issues) {
      const existing = byFile.get(issue.filePath);
      if (existing) {
        existing.push(issue);
      } else {
        byFile.set(issue.filePath, [issue]);
      }
    }
  }

  return byFile;
}

/**
 * Selector to get the total count of all issues.
 *
 * @param state - The composed store state
 * @returns Total number of issues across all dataLocs
 */
export function selectTotalIssueCount(state: ComposedState): number {
  const issuesMap = state.plugins?.eslint?.issues;
  if (!issuesMap || issuesMap.size === 0) {
    return 0;
  }

  let count = 0;
  for (const issues of issuesMap.values()) {
    count += issues.length;
  }

  return count;
}

/**
 * Selector to get issue counts grouped by severity.
 *
 * @param state - The composed store state
 * @returns Object with error, warning, and info counts
 */
export function selectSeverityCounts(state: ComposedState): SeverityCounts {
  const issuesMap = state.plugins?.eslint?.issues;
  if (!issuesMap || issuesMap.size === 0) {
    return ZERO_SEVERITY_COUNTS;
  }

  const counts: SeverityCounts = { error: 0, warning: 0, info: 0 };

  for (const issues of issuesMap.values()) {
    for (const issue of issues) {
      counts[issue.severity]++;
    }
  }

  return counts;
}

/**
 * Selector to check if there are any issues.
 *
 * @param state - The composed store state
 * @returns true if there are any issues
 */
export function selectHasIssues(state: ComposedState): boolean {
  const issuesMap = state.plugins?.eslint?.issues;
  if (!issuesMap || issuesMap.size === 0) {
    return false;
  }

  for (const issues of issuesMap.values()) {
    if (issues.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Selector to check if there are any errors (highest severity).
 *
 * @param state - The composed store state
 * @returns true if there are any error-severity issues
 */
export function selectHasErrors(state: ComposedState): boolean {
  const issuesMap = state.plugins?.eslint?.issues;
  if (!issuesMap || issuesMap.size === 0) {
    return false;
  }

  for (const issues of issuesMap.values()) {
    for (const issue of issues) {
      if (issue.severity === "error") {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Rule Card Data
// ============================================================================

/**
 * Data for a single rule card in the inspector.
 */
export interface RuleCardData {
  ruleId: string;
  ruleName: string;
  totalCount: number;
  highestSeverity: Issue["severity"];
  severityCounts: SeverityCounts;
  files: Array<{
    filePath: string;
    fileName: string;
    issueCount: number;
    issues: Issue[];
  }>;
}

const EMPTY_RULE_CARDS: RuleCardData[] = [];
let cachedRuleCardsIssuesMap: Map<string, Issue[]> | null = null;
let cachedRuleCardsRuleConfigs: Map<
  string,
  { severity?: "off" | "warn" | "error" }
> | null = null;
let cachedRuleCards: RuleCardData[] = EMPTY_RULE_CARDS;

function getEffectiveSeverity(
  issue: Issue,
  ruleConfigs: Map<string, { severity?: "off" | "warn" | "error" }> | null
): IssueSeverity {
  const configured = ruleConfigs?.get(issue.ruleId)?.severity;
  if (configured === "error") return "error";
  if (configured === "warn") return "warning";
  return issue.severity;
}

/**
 * Selector to get rule card data for the inspector.
 * Groups issues by rule, sorted by severity then count.
 */
export function selectRuleCards(state: ComposedState): RuleCardData[] {
  const issuesMap = state.plugins?.eslint?.issues;
  const ruleConfigs =
    (
      state.plugins?.eslint as
        | { ruleConfigs?: Map<string, { severity?: "off" | "warn" | "error" }> }
        | undefined
    )?.ruleConfigs ?? null;

  if (
    issuesMap === cachedRuleCardsIssuesMap &&
    ruleConfigs === cachedRuleCardsRuleConfigs
  ) {
    return cachedRuleCards;
  }

  cachedRuleCardsIssuesMap = issuesMap ?? null;
  cachedRuleCardsRuleConfigs = ruleConfigs;

  if (!issuesMap || issuesMap.size === 0) {
    cachedRuleCards = EMPTY_RULE_CARDS;
    return cachedRuleCards;
  }

  const ruleMap = new Map<
    string,
    {
      ruleId: string;
      totalCount: number;
      severityCounts: SeverityCounts;
      highestSeverity: Issue["severity"];
      files: Map<
        string,
        {
          filePath: string;
          fileName: string;
          issueCount: number;
          issues: Issue[];
        }
      >;
    }
  >();

  for (const issues of issuesMap.values()) {
    for (const issue of issues) {
      const ruleId = issue.ruleId || "unknown";
      const effectiveSeverity = getEffectiveSeverity(issue, ruleConfigs);

      if (!ruleMap.has(ruleId)) {
        ruleMap.set(ruleId, {
          ruleId,
          totalCount: 0,
          severityCounts: { error: 0, warning: 0, info: 0 },
          highestSeverity: "info",
          files: new Map(),
        });
      }

      const rule = ruleMap.get(ruleId)!;
      rule.totalCount++;
      rule.severityCounts[effectiveSeverity]++;

      if (effectiveSeverity === "error") {
        rule.highestSeverity = "error";
      } else if (
        effectiveSeverity === "warning" &&
        rule.highestSeverity !== "error"
      ) {
        rule.highestSeverity = "warning";
      }

      if (!rule.files.has(issue.filePath)) {
        const parts = issue.filePath.split("/");
        rule.files.set(issue.filePath, {
          filePath: issue.filePath,
          fileName: parts[parts.length - 1] || issue.filePath,
          issueCount: 0,
          issues: [],
        });
      }

      const file = rule.files.get(issue.filePath)!;
      file.issueCount++;
      file.issues.push(issue);
    }
  }

  const severityOrder = { error: 0, warning: 1, info: 2 };
  const cards: RuleCardData[] = Array.from(ruleMap.values())
    .sort((a, b) => {
      const sd =
        severityOrder[a.highestSeverity] - severityOrder[b.highestSeverity];
      if (sd !== 0) return sd;
      return b.totalCount - a.totalCount;
    })
    .map((rule) => {
      const shortName = rule.ruleId.includes("/")
        ? rule.ruleId.split("/").pop() || rule.ruleId
        : rule.ruleId;
      return {
        ruleId: rule.ruleId,
        ruleName: shortName,
        totalCount: rule.totalCount,
        highestSeverity: rule.highestSeverity,
        severityCounts: rule.severityCounts,
        files: Array.from(rule.files.values()).sort(
          (a, b) => b.issueCount - a.issueCount
        ),
      };
    });

  cachedRuleCards = cards.length > 0 ? cards : EMPTY_RULE_CARDS;
  return cachedRuleCards;
}

// ============================================================================
// Rule Contribution Segments Selector
// ============================================================================

export interface RuleContributionSegment {
  id: string;
  count: number;
  severity: IssueSeverity;
}

const EMPTY_SEGMENTS: RuleContributionSegment[] = [];
let cachedSegmentsSource: RuleCardData[] | null = null;
let cachedSegments: RuleContributionSegment[] = EMPTY_SEGMENTS;

/**
 * Selector that derives per-rule contribution segments from rule cards.
 * Each segment carries the rule id, its total issue count, and its highest severity.
 * Suitable for feeding directly into SeverityBar.
 */
export function selectRuleContributionSegments(
  state: ComposedState
): RuleContributionSegment[] {
  const ruleCards = selectRuleCards(state);
  if (ruleCards === cachedSegmentsSource) return cachedSegments;
  cachedSegmentsSource = ruleCards;

  if (ruleCards.length === 0) {
    cachedSegments = EMPTY_SEGMENTS;
    return cachedSegments;
  }

  cachedSegments = ruleCards.map((card) => ({
    id: card.ruleId,
    count: card.totalCount,
    severity: card.highestSeverity,
  }));
  return cachedSegments;
}

const EMPTY_GROUPED: Map<string, Issue[]> = new Map();

/**
 * Get all issues for a specific dataLoc, grouped by rule.
 */
export function selectIssuesByDataLocGroupedByRule(
  state: ComposedState,
  dataLoc: string
): Map<string, Issue[]> {
  const issuesMap = state.plugins?.eslint?.issues;
  if (!issuesMap) return EMPTY_GROUPED;

  const locIssues = issuesMap.get(dataLoc);
  if (!locIssues || locIssues.length === 0) return EMPTY_GROUPED;

  const grouped = new Map<string, Issue[]>();
  for (const issue of locIssues) {
    const existing = grouped.get(issue.ruleId);
    if (existing) {
      existing.push(issue);
    } else {
      grouped.set(issue.ruleId, [issue]);
    }
  }

  return grouped;
}
