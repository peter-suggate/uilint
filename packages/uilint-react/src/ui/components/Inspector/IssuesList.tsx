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
import React, { useCallback, useMemo, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { useComposedStore } from "../../../core/store";
import {
  selectFilteredFileGroups,
  selectFileGroupsSummary,
  selectActiveRuleFilter,
} from "../../../core/store/file-groups-selector";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import type { ESLintPluginSlice } from "../../../plugins/eslint/slice";
import { IssuesSummary } from "./IssuesSummary";
import { RuleHeader } from "./RuleHeader";
import { RuleConfig } from "./RuleConfig";
import { FileSourceView } from "./FileSourceView";
import { ExpandableContainer } from "../HierarchicalTiles";
import { fileGroupsToNodes, FileCardHeader, type FileNode } from "./FileNodeAdapter";
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
  const expandedFileNode = useComposedStore((s) => s.inspector.expandedFileNode);
  const selectedIssueId = useComposedStore((s) => s.inspector.selectedIssueId);
  const ruleConfigExpanded = useComposedStore((s) => s.inspector.ruleConfigExpanded);

  // Store actions
  const removeFilter = useComposedStore((s) => s.removeFilter);
  const expandFileNode = useComposedStore((s) => s.expandFileNode);
  const collapseFileNode = useComposedStore((s) => s.collapseFileNode);
  const selectIssue = useComposedStore((s) => s.selectIssue);
  const toggleRuleConfig = useComposedStore((s) => s.toggleRuleConfig);

  // Create fileNodes from fileGroups using the adapter
  const fileNodes = useMemo(() => fileGroupsToNodes(fileGroups), [fileGroups]);

  // Auto-expand first file with errors on initial load
  const autoExpandedRef = React.useRef(false);
  React.useEffect(() => {
    if (!autoExpandedRef.current && fileGroups.length > 0 && !expandedFileNode) {
      // Find first file with errors, or just first file
      const firstWithErrors = fileGroups.find((f) => f.severityCounts.error > 0);
      const fileToExpand = firstWithErrors || fileGroups[0];
      if (fileToExpand) {
        expandFileNode(fileToExpand.filePath);
        autoExpandedRef.current = true;
      }
    }
  }, [fileGroups, expandedFileNode, expandFileNode]);

  // Auto-expand file containing selected issue (e.g., from heatmap click)
  useEffect(() => {
    if (!selectedIssueId) return;

    // Find which file contains the selected issue
    for (const fileGroup of fileGroups) {
      const hasIssue = fileGroup.issues.some((issue) => issue.id === selectedIssueId);
      if (hasIssue) {
        // Expand this file if not already expanded
        if (expandedFileNode !== fileGroup.filePath) {
          expandFileNode(fileGroup.filePath);
        }
        break;
      }
    }
  }, [selectedIssueId, fileGroups, expandedFileNode, expandFileNode]);

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

  // Get current rule config from ESLint store
  const ruleConfig = useComposedStore((s) => {
    if (!ruleFilter?.id) return null;
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.ruleConfigs) return null;
    return eslintState.ruleConfigs.get(ruleFilter.id);
  });

  // Get rule metadata including optionSchema
  const ruleMetadata = useComposedStore((s) => {
    if (!ruleFilter?.id) return null;
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.availableRules) return null;
    return eslintState.availableRules.find((r) => r.id === ruleFilter.id);
  });

  // Get isUpdating state
  const isRuleUpdating = useComposedStore((s) => {
    if (!ruleFilter?.id) return false;
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.ruleConfigUpdating) return false;
    return eslintState.ruleConfigUpdating.get(ruleFilter.id) ?? false;
  });

  // Handle severity change - calls plugin registry to update ESLint config
  const handleSeverityChange = useCallback(
    (severity: "off" | "warn" | "error") => {
      if (!ruleFilter?.id) return;
      // Map "warn" to "warning" for plugin registry API
      const apiSeverity = severity === "warn" ? "warning" : severity;
      pluginRegistry.setRuleSeverity(ruleFilter.id, apiSeverity);
    },
    [ruleFilter?.id]
  );

  // Handle option change - calls plugin registry to update ESLint config
  const handleOptionChange = useCallback(
    (key: string, value: unknown) => {
      if (!ruleFilter?.id) return;
      // Merge the changed option with current options
      const currentOptions = ruleConfig?.options ?? {};
      const newOptions = { ...currentOptions, [key]: value };
      pluginRegistry.setRuleConfig(ruleFilter.id, newOptions);
    },
    [ruleFilter?.id, ruleConfig?.options]
  );

  // Handle reset to defaults
  const handleResetOptions = useCallback(() => {
    if (!ruleFilter?.id || !ruleMetadata?.defaultOptions) return;
    // defaultOptions is typically an array with the first element being the options object
    const defaultOpts = Array.isArray(ruleMetadata.defaultOptions)
      ? (ruleMetadata.defaultOptions[0] as Record<string, unknown>) ?? {}
      : (ruleMetadata.defaultOptions as Record<string, unknown>) ?? {};
    pluginRegistry.setRuleConfig(ruleFilter.id, defaultOpts);
  }, [ruleFilter?.id, ruleMetadata?.defaultOptions]);

  // Determine current rule severity from ESLint config
  const currentRuleSeverity: "off" | "warn" | "error" = useMemo(() => {
    if (!ruleConfig?.severity) return "warn";
    return ruleConfig.severity;
  }, [ruleConfig?.severity]);

  // Get default options for the rule
  const defaultOptions = useMemo(() => {
    if (!ruleMetadata?.defaultOptions) return {};
    return Array.isArray(ruleMetadata.defaultOptions)
      ? (ruleMetadata.defaultOptions[0] as Record<string, unknown>) ?? {}
      : (ruleMetadata.defaultOptions as Record<string, unknown>) ?? {};
  }, [ruleMetadata?.defaultOptions]);

  // Check if has filters
  const hasFilters = filters.length > 0;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Rule header - shown when rule filter is active */}
      <AnimatePresence>
        {ruleFilter && (
          <RuleHeader
            ruleFilter={ruleFilter}
            description={ruleMetadata?.description ?? getRuleDescription(ruleFilter.id)}
            category={ruleMetadata?.category ?? getRuleCategory(ruleFilter.id)}
            docsUrl={ruleMetadata?.docs ?? getRuleDocsUrl(ruleFilter.id)}
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
            optionSchema={ruleMetadata?.optionSchema}
            currentOptions={ruleConfig?.options}
            defaultOptions={defaultOptions}
            onOptionChange={handleOptionChange}
            onResetOptions={handleResetOptions}
            isUpdating={isRuleUpdating}
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
            {fileNodes.map((node) => (
              <ExpandableContainer
                key={node.id}
                node={node}
                isExpanded={expandedFileNode === node.id}
                onExpand={() => expandFileNode(node.id)}
                onCollapse={() => collapseFileNode()}
                renderHeader={(n) => <FileCardHeader node={n as FileNode} isExpanded={expandedFileNode === n.id} />}
                renderChildren={(n) => (
                  <FileSourceView
                    filePath={(n as FileNode).data.fileGroup.filePath}
                    issues={(n as FileNode).data.fileGroup.issues}
                    contextLines={2}
                    selectedIssueId={selectedIssueId}
                    onIssueSelect={handleIssueSelect}
                    enabled={true}
                  />
                )}
                layout="list"
                showSiblingStrip={false}
                className="mb-3"
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
