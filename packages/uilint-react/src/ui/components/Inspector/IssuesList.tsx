/**
 * IssuesList - Main content component for the unified inspector
 *
 * Orchestrates a two-level tile hierarchy:
 * - Level 0: Rule tiles (aggregated across all files)
 * - Level 1: File tiles (for a specific rule)
 * - Level 2: Source view (for a specific file within a rule)
 *
 * Uses the unified filter model - same source of truth as tiles and heatmap.
 */
import React, { useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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
import {
  TileGrid,
  TileHeader,
  crispEase,
  DURATIONS,
  type BaseTileItem,
} from "../HierarchicalTiles";
import {
  fileGroupsToRuleNodes,
  getFileNodesForRule,
  type RuleNode,
  type FileForRuleNode,
} from "./RuleNodeAdapter";
import { cn } from "../../../lib/utils";

// ============================================================================
// Tile Item Adapters
// ============================================================================

/**
 * Convert RuleNode to BaseTileItem for TileGrid.
 */
function ruleNodeToTileItem(node: RuleNode): BaseTileItem & { data: RuleNode["data"] } {
  return {
    id: node.id,
    label: node.label,
    subtitle: node.subtitle,
    icon: node.icon,
    count: node.count ?? 0,
    severityCounts: node.severityCounts,
    data: node.data,
  };
}

/**
 * Convert FileForRuleNode to BaseTileItem for TileGrid.
 */
function fileNodeToTileItem(node: FileForRuleNode): BaseTileItem & { data: FileForRuleNode["data"] } {
  return {
    id: node.id,
    label: node.label,
    subtitle: node.subtitle,
    count: node.count ?? 0,
    severityCounts: node.severityCounts,
    data: node.data,
  };
}

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
  const expandedRuleId = useComposedStore((s) => s.inspector.expandedRuleId);
  const expandedFilePath = useComposedStore((s) => s.inspector.expandedFilePath);
  const selectedIssueId = useComposedStore((s) => s.inspector.selectedIssueId);
  const ruleConfigExpanded = useComposedStore((s) => s.inspector.ruleConfigExpanded);

  // Store actions
  const removeFilter = useComposedStore((s) => s.removeFilter);
  const expandRule = useComposedStore((s) => s.expandRule);
  const collapseRule = useComposedStore((s) => s.collapseRule);
  const expandFileInRule = useComposedStore((s) => s.expandFileInRule);
  const collapseFileInRule = useComposedStore((s) => s.collapseFileInRule);
  const selectIssue = useComposedStore((s) => s.selectIssue);
  const toggleRuleConfig = useComposedStore((s) => s.toggleRuleConfig);

  // Transform fileGroups to rule nodes
  const ruleNodes = useMemo(() => fileGroupsToRuleNodes(fileGroups), [fileGroups]);

  // Get the expanded rule and its file nodes
  const expandedRule = useMemo(
    () => ruleNodes.find((r) => r.id === expandedRuleId) || null,
    [ruleNodes, expandedRuleId]
  );
  const fileNodes = useMemo(
    () => (expandedRule ? getFileNodesForRule(expandedRule) : []),
    [expandedRule]
  );
  const expandedFile = useMemo(
    () => fileNodes.find((f) => f.data.filePath === expandedFilePath) || null,
    [fileNodes, expandedFilePath]
  );

  // Convert nodes to BaseTileItem format for TileGrid
  const ruleTileItems = useMemo(
    () => ruleNodes.map(ruleNodeToTileItem),
    [ruleNodes]
  );
  const fileTileItems = useMemo(
    () => fileNodes.map(fileNodeToTileItem),
    [fileNodes]
  );

  // Get full issues for the expanded file from fileGroups
  const expandedFileIssues = useMemo(() => {
    if (!expandedFilePath) return [];
    const fileGroup = fileGroups.find((fg) => fg.filePath === expandedFilePath);
    return fileGroup?.issues ?? [];
  }, [expandedFilePath, fileGroups]);

  // Auto-expand first rule with errors on initial load
  const autoExpandedRef = React.useRef(false);
  React.useEffect(() => {
    if (!autoExpandedRef.current && ruleNodes.length > 0 && !expandedRuleId) {
      // Find first rule with errors, or just first rule
      const firstWithErrors = ruleNodes.find((r) => r.data.highestSeverity === "error");
      const ruleToExpand = firstWithErrors || ruleNodes[0];
      if (ruleToExpand) {
        expandRule(ruleToExpand.id);
        autoExpandedRef.current = true;
      }
    }
  }, [ruleNodes, expandedRuleId, expandRule]);

  // Auto-expand rule and file containing selected issue (e.g., from heatmap click)
  useEffect(() => {
    if (!selectedIssueId) return;

    // Find which rule and file contains the selected issue
    for (const rule of ruleNodes) {
      for (const file of rule.data.files) {
        const hasIssue = file.issues.some((issue) => issue.id === selectedIssueId);
        if (hasIssue) {
          // Expand the rule if not already expanded
          if (expandedRuleId !== rule.id) {
            expandRule(rule.id);
          }
          // Then expand the file within the rule
          if (expandedFilePath !== file.filePath) {
            expandFileInRule(file.filePath);
          }
          return;
        }
      }
    }
  }, [selectedIssueId, ruleNodes, expandedRuleId, expandedFilePath, expandRule, expandFileInRule]);

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

      {/* Main content - three-level tile hierarchy */}
      <div className="flex-1 overflow-y-auto">
        {fileGroups.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <AnimatePresence mode="wait">
            {/* Level 0: Rule tiles (no expansion) */}
            {!expandedRuleId && (
              <motion.div
                key="rule-tiles"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: DURATIONS.standard, ease: crispEase }}
                className="p-4"
              >
                <TileGrid
                  items={ruleTileItems}
                  onTileClick={(item) => expandRule(item.id)}
                  selectedIndex={-1}
                  availableWidth={350}
                  padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
                />
              </motion.div>
            )}

            {/* Level 1: File tiles for the expanded rule */}
            {expandedRule && !expandedFilePath && (
              <motion.div
                key="file-tiles"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: DURATIONS.standard, ease: crispEase }}
              >
                <TileHeader
                  label={expandedRule.label}
                  subtitle={expandedRule.data.ruleId}
                  icon={expandedRule.icon}
                  count={expandedRule.count}
                  onBack={collapseRule}
                />
                <div className="p-4">
                  <TileGrid
                    items={fileTileItems}
                    onTileClick={(item) => {
                      // Find the original file node to get the filePath
                      const fileNode = fileNodes.find((f) => f.id === item.id);
                      if (fileNode) {
                        expandFileInRule(fileNode.data.filePath);
                      }
                    }}
                    selectedIndex={-1}
                    availableWidth={350}
                    padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  />
                </div>
              </motion.div>
            )}

            {/* Level 2: Source view for the expanded file */}
            {expandedRule && expandedFile && (
              <motion.div
                key="source-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: DURATIONS.standard, ease: crispEase }}
              >
                <TileHeader
                  label={expandedFile.label}
                  subtitle={expandedFile.subtitle}
                  count={expandedFile.count}
                  onBack={collapseFileInRule}
                  level={1}
                />
                <div className="p-4">
                  <FileSourceView
                    filePath={expandedFile.data.filePath}
                    issues={expandedFileIssues}
                    contextLines={2}
                    selectedIssueId={selectedIssueId}
                    onIssueSelect={handleIssueSelect}
                    enabled={true}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
