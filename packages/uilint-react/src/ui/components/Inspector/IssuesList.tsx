/**
 * IssuesList - Main content component for the unified inspector
 *
 * Orchestrates the file-primary issues view:
 * - Shows contextual rule header when a rule filter is active
 * - Shows issues summary
 * - Shows collapsible file sections with issues
 * - Handles filter interactions
 *
 * Uses the unified filter model - same source of truth as tiles and heatmap.
 */
import React, { useCallback, useMemo } from "react";
import { AnimatePresence } from "motion/react";
import { useComposedStore } from "../../../core/store";
import {
  selectFilteredFileGroups,
  selectFileGroupsSummary,
  selectActiveRuleFilter,
} from "../../../core/store/file-groups-selector";
import { IssuesSummary } from "./IssuesSummary";
import { RuleHeader } from "./RuleHeader";
import { RuleConfig } from "./RuleConfig";
import { FileSection } from "./FileSection";
import { cn } from "../../../lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface IssuesListProps {
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-4xl mb-4 opacity-30">
        {hasFilters ? "🔍" : "✨"}
      </div>
      <h3 className="text-lg font-medium text-foreground/80 mb-2">
        {hasFilters ? "No matching issues" : "No issues found"}
      </h3>
      <p className="text-sm text-muted-foreground/60 max-w-xs">
        {hasFilters
          ? "Try adjusting or clearing your filters to see more results."
          : "Great job! Your code looks clean."}
      </p>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function IssuesList({ className }: IssuesListProps) {
  // Store selectors
  const fileGroups = useComposedStore(selectFilteredFileGroups);
  const summary = useComposedStore(selectFileGroupsSummary);
  const ruleFilter = useComposedStore(selectActiveRuleFilter);
  const filters = useComposedStore((s) => s.commandPalette.filters);
  const expandedFiles = useComposedStore((s) => s.inspector.expandedFiles);
  const selectedIssueId = useComposedStore((s) => s.inspector.selectedIssueId);
  const ruleConfigExpanded = useComposedStore((s) => s.inspector.ruleConfigExpanded);

  // Store actions
  const addFilter = useComposedStore((s) => s.addFilter);
  const removeFilter = useComposedStore((s) => s.removeFilter);
  const toggleFileExpanded = useComposedStore((s) => s.toggleFileExpanded);
  const selectIssue = useComposedStore((s) => s.selectIssue);
  const toggleRuleConfig = useComposedStore((s) => s.toggleRuleConfig);

  // Auto-expand first file with errors on initial load
  const autoExpandedRef = React.useRef(false);
  React.useEffect(() => {
    if (!autoExpandedRef.current && fileGroups.length > 0 && expandedFiles.length === 0) {
      // Find first file with errors, or just first file
      const firstWithErrors = fileGroups.find((f) => f.severityCounts.error > 0);
      const fileToExpand = firstWithErrors || fileGroups[0];
      if (fileToExpand) {
        toggleFileExpanded(fileToExpand.filePath);
        autoExpandedRef.current = true;
      }
    }
  }, [fileGroups, expandedFiles.length, toggleFileExpanded]);

  // Handle rule badge click - adds filter
  const handleRuleClick = useCallback(
    (ruleId: string) => {
      // Don't add if already filtered to this rule
      if (ruleFilter?.id === ruleId) return;

      // Get short name for label
      const shortName = ruleId.includes("/") ? ruleId.split("/").pop()! : ruleId;

      addFilter({
        type: "rule",
        id: ruleId,
        label: shortName,
        providerId: "eslint",
      });
    },
    [ruleFilter, addFilter]
  );

  // Handle clear rule filter
  const handleClearRuleFilter = useCallback(() => {
    const ruleFilterIndex = filters.findIndex((f) => f.type === "rule");
    if (ruleFilterIndex !== -1) {
      removeFilter(ruleFilterIndex);
    }
  }, [filters, removeFilter]);

  // Handle issue selection
  const handleIssueSelect = useCallback(
    (issueId: string) => {
      selectIssue(selectedIssueId === issueId ? null : issueId);
    },
    [selectedIssueId, selectIssue]
  );

  // Handle severity change (placeholder - will need ESLint integration)
  const handleSeverityChange = useCallback((severity: "off" | "warn" | "error") => {
    // TODO: Integrate with ESLint config
    console.log("Severity change requested:", severity);
  }, []);

  // Determine current rule severity (placeholder)
  const currentRuleSeverity: "off" | "warn" | "error" = useMemo(() => {
    // TODO: Get from actual ESLint config
    return "warn";
  }, []);

  // Check if has filters
  const hasFilters = filters.length > 0;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Rule header - shown when rule filter is active */}
      <AnimatePresence>
        {ruleFilter && (
          <RuleHeader
            ruleFilter={ruleFilter}
            description={getRuleDescription(ruleFilter.id)}
            category={getRuleCategory(ruleFilter.id)}
            docsUrl={getRuleDocsUrl(ruleFilter.id)}
            configExpanded={ruleConfigExpanded}
            onToggleConfig={toggleRuleConfig}
            onClear={handleClearRuleFilter}
          />
        )}
      </AnimatePresence>

      {/* Rule config - shown when expanded */}
      <AnimatePresence>
        {ruleFilter && ruleConfigExpanded && (
          <RuleConfig
            ruleId={ruleFilter.id}
            currentSeverity={currentRuleSeverity}
            onSeverityChange={handleSeverityChange}
          />
        )}
      </AnimatePresence>

      {/* Summary bar */}
      {fileGroups.length > 0 && (
        <IssuesSummary
          totalIssues={summary.totalIssues}
          totalFiles={summary.totalFiles}
          totalRules={ruleFilter ? undefined : summary.totalRules}
          severityCounts={summary.severityCounts}
        />
      )}

      {/* File cards */}
      <div className="flex-1 overflow-y-auto">
        {fileGroups.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {fileGroups.map((file) => (
              <FileSection
                key={file.filePath}
                file={file}
                isExpanded={expandedFiles.includes(file.filePath)}
                onToggle={() => toggleFileExpanded(file.filePath)}
                onRuleClick={handleRuleClick}
                onIssueSelect={handleIssueSelect}
                selectedIssueId={selectedIssueId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers (placeholder - will need rule metadata integration)
// ============================================================================

/**
 * Get rule description from metadata.
 * TODO: Integrate with ESLint available rules
 */
function getRuleDescription(ruleId: string): string | undefined {
  // Placeholder descriptions for common rules
  const descriptions: Record<string, string> = {
    "no-unused-vars": "Disallow variables that are declared but never used in the code.",
    "@typescript-eslint/no-unused-vars": "Disallow variables that are declared but never used in the code.",
    "no-console": "Disallow the use of console methods.",
    "react-hooks/exhaustive-deps": "Checks effect dependencies and warns when dependencies are missing.",
    "react-hooks/rules-of-hooks": "Enforces the Rules of Hooks.",
    "no-explicit-any": "Disallow the any type to encourage more precise typing.",
    "@typescript-eslint/no-explicit-any": "Disallow the any type to encourage more precise typing.",
  };
  return descriptions[ruleId];
}

/**
 * Get rule category from metadata.
 * TODO: Integrate with ESLint available rules
 */
function getRuleCategory(ruleId: string): string | undefined {
  if (ruleId.startsWith("@typescript-eslint/")) return "TypeScript";
  if (ruleId.startsWith("react-hooks/")) return "React Hooks";
  if (ruleId.startsWith("react/")) return "React";
  return "ESLint";
}

/**
 * Get rule documentation URL.
 */
function getRuleDocsUrl(ruleId: string): string | undefined {
  if (ruleId.startsWith("@typescript-eslint/")) {
    const shortName = ruleId.replace("@typescript-eslint/", "");
    return `https://typescript-eslint.io/rules/${shortName}`;
  }
  if (ruleId.startsWith("react-hooks/")) {
    return "https://reactjs.org/docs/hooks-rules.html";
  }
  if (ruleId.startsWith("react/")) {
    const shortName = ruleId.replace("react/", "");
    return `https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/${shortName}.md`;
  }
  // Default ESLint core rules
  return `https://eslint.org/docs/latest/rules/${ruleId}`;
}

export default IssuesList;
