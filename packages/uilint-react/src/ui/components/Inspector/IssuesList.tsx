/**
 * IssuesList - Main content component for the unified inspector
 *
 * Orchestrates a two-level tile hierarchy with in-place expansion:
 * - Level 0: Rule tiles (aggregated across all files)
 * - Level 1: File tiles (for a specific rule) - shown INSIDE expanded rule tile
 * - Level 2: Source view (for a specific file within a rule) - shown below expanded file
 *
 * Uses the additive selection model - all tiles visible, expanded ones emphasized.
 * Tiles expand IN PLACE using the mosaic layout algorithm, keeping siblings visible.
 */
import React, { useCallback, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import { useComposedStore } from "../../../core/store";
import {
  selectFileGroups,
} from "../../../core/store/file-groups-selector";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import type { ESLintPluginSlice } from "../../../plugins/eslint/slice";
import { RuleHeader } from "./RuleHeader";
import { FileSourceView } from "./FileSourceView";
import { IssueSummaryView } from "./IssueSummaryView";
import { Breadcrumbs } from "./Breadcrumbs";
import {
  ExpandableTileGrid,
  TileGrid,
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
    count: node.count ?? 0,
    previewMessages: node.previewMessages,
    fileCount: node.fileCount,
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-4xl mb-4 opacity-30">✨</div>
      <h3 className="text-lg font-medium text-foreground/80 mb-2">
        No issues found
      </h3>
      <p className="text-sm text-muted-foreground/60 max-w-xs">
        Great job! Your code looks clean.
      </p>
    </div>
  );
}

// ============================================================================
// Constants for height calculation
// ============================================================================

/** Approximate height of compact RuleHeader component */
const RULE_HEADER_HEIGHT = 40;

/** Height for file content area when showing inline (issue summary or source view) */
const FILE_CONTENT_MIN_HEIGHT = 300;

// ============================================================================
// Component
// ============================================================================

export function IssuesList({ className }: IssuesListProps) {
  // Store selectors
  const fileGroups = useComposedStore(selectFileGroups);
  const expandedRuleId = useComposedStore((s) => s.inspector.expandedRuleId);
  const expandedFilePath = useComposedStore((s) => s.inspector.expandedFilePath);
  const selectedIssueId = useComposedStore((s) => s.inspector.selectedIssueId);
  const showFullSource = useComposedStore((s) => s.inspector.showFullSource);
  const availableWidth = useComposedStore((s) => s.inspector.layoutAvailableWidth);

  // Store actions
  const expandRule = useComposedStore((s) => s.expandRule);
  const collapseRule = useComposedStore((s) => s.collapseRule);
  const expandFileInRule = useComposedStore((s) => s.expandFileInRule);
  const collapseFileInRule = useComposedStore((s) => s.collapseFileInRule);
  const selectIssue = useComposedStore((s) => s.selectIssue);
  const showFullSourceView = useComposedStore((s) => s.showFullSourceView);

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

  // Get issues for the expanded file, FILTERED by the expanded rule
  // Uses expandedFile.data.issues which contains only issues for this rule
   
  const expandedFileIssues = useMemo(() => {
    if (!expandedFilePath || !expandedFile || !expandedRule) return [];
    // Enrich the simplified issue data with full Issue fields
    return expandedFile.data.issues.map((issue) => ({
      ...issue,
      ruleId: expandedRule.id,
      pluginId: "eslint",
      filePath: expandedFilePath,
      dataLoc: `${expandedFilePath}:${issue.line}:${issue.column ?? 0}`,
    }));
  }, [expandedFilePath, expandedFile, expandedRule]);

  // No auto-expand - user must click to expand a rule

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

  // Handle issue selection
  const handleIssueSelect = useCallback(
    (issueId: string) => {
      selectIssue(selectedIssueId === issueId ? null : issueId);
    },
    [selectedIssueId, selectIssue]
  );

  // Get current rule config from ESLint store
  const ruleConfig = useComposedStore((s) => {
    if (!expandedRuleId) return null;
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.ruleConfigs) return null;
    return eslintState.ruleConfigs.get(expandedRuleId);
  });

  // Get rule metadata including optionSchema
  const ruleMetadata = useComposedStore((s) => {
    if (!expandedRuleId) return null;
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.availableRules) return null;
    return eslintState.availableRules.find((r) => r.id === expandedRuleId);
  });

  // Get isUpdating state
  const isRuleUpdating = useComposedStore((s) => {
    if (!expandedRuleId) return false;
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.ruleConfigUpdating) return false;
    return eslintState.ruleConfigUpdating.get(expandedRuleId) ?? false;
  });

  // Handle severity change - calls plugin registry to update ESLint config
  const handleSeverityChange = useCallback(
    (severity: "off" | "warn" | "error") => {
      if (!expandedRuleId) return;
      // Map "warn" to "warning" for plugin registry API
      const apiSeverity = severity === "warn" ? "warning" : severity;
      pluginRegistry.setRuleSeverity(expandedRuleId, apiSeverity);
    },
    [expandedRuleId]
  );

  // Handle option change - calls plugin registry to update ESLint config
  const handleOptionChange = useCallback(
    (key: string, value: unknown) => {
      if (!expandedRuleId) return;
      // Merge the changed option with current options
      const currentOptions = ruleConfig?.options ?? {};
      const newOptions = { ...currentOptions, [key]: value };
      pluginRegistry.setRuleConfig(expandedRuleId, newOptions);
    },
    [expandedRuleId, ruleConfig?.options]
  );

  // Handle reset to defaults
  const handleResetOptions = useCallback(() => {
    if (!expandedRuleId || !ruleMetadata?.defaultOptions) return;
    // defaultOptions is typically an array with the first element being the options object
    const defaultOpts = Array.isArray(ruleMetadata.defaultOptions)
      ? (ruleMetadata.defaultOptions[0] as Record<string, unknown>) ?? {}
      : (ruleMetadata.defaultOptions as Record<string, unknown>) ?? {};
    pluginRegistry.setRuleConfig(expandedRuleId, defaultOpts);
  }, [expandedRuleId, ruleMetadata?.defaultOptions]);

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

  // Extra height for expanded tile
  // When showing file content inline, we need more height
  const extraExpandedHeight = expandedFilePath
    ? RULE_HEADER_HEIGHT + FILE_CONTENT_MIN_HEIGHT
    : RULE_HEADER_HEIGHT;

  // Custom render function for expanded rule tile content
  // Renders RuleHeader (with config popover) and either file tiles or file content INSIDE the expanded tile
  const renderExpandedRuleContent = useCallback(
    (
      item: BaseTileItem,
      children: BaseTileItem[],
      childrenHeight: number,
      tileAvailableWidth: number
    ) => {
      // Check if a file is expanded within this rule
      const isFileExpanded = expandedFilePath !== null;

      return (
        <motion.div
          layoutId={`tile-${item.id}`}
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.9 }}
          transition={{ duration: DURATIONS.expand, ease: crispEase }}
          className={cn(
            "rounded-xl",
            "border border-foreground/[0.05]",
            "bg-background/80",
            "overflow-hidden",
            "shadow-sm",
            "h-full flex flex-col"
          )}
        >
          {/* Content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Rule description & config popover */}
            <RuleHeader
              ruleFilter={{ type: "rule", id: item.id, label: item.label }}
              description={ruleMetadata?.description ?? getRuleDescription(item.id)}
              category={ruleMetadata?.category ?? getRuleCategory(item.id)}
              docsUrl={ruleMetadata?.docs ?? getRuleDocsUrl(item.id)}
              onClear={collapseRule}
              showCloseButton={false}
              // Config props for popover
              currentSeverity={currentRuleSeverity}
              onSeverityChange={handleSeverityChange}
              optionSchema={ruleMetadata?.optionSchema}
              currentOptions={ruleConfig?.options}
              defaultOptions={defaultOptions}
              onOptionChange={handleOptionChange}
              onResetOptions={handleResetOptions}
              isUpdating={isRuleUpdating}
            />

            {/* Content: either file tiles or file content */}
            {!isFileExpanded ? (
              /* File tiles grid - when no file is expanded */
              <div className="p-3">
                <TileGrid
                  items={children}
                  onTileClick={(fileItem) => {
                    const fileNode = fileNodes.find((f) => f.id === fileItem.id);
                    if (fileNode) {
                      expandFileInRule(fileNode.data.filePath);
                    }
                  }}
                  selectedIndex={-1}
                  availableWidth={tileAvailableWidth - 24} // Account for padding
                  padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
                />
              </div>
            ) : !showFullSource ? (
              /* Issue summary view - when file is expanded but not showing full source */
              <div className="flex-1 overflow-auto">
                <IssueSummaryView
                  issues={expandedFileIssues}
                  selectedIssueId={selectedIssueId}
                  onIssueClick={(issue) => {
                    selectIssue(issue.id);
                    // After selecting, go to full source view
                    showFullSourceView();
                  }}
                  onShowFullSource={showFullSourceView}
                />
              </div>
            ) : (
              /* Full source view - when file is expanded and showing full source */
              <div className="flex-1 overflow-auto p-3">
                <FileSourceView
                  filePath={expandedFilePath}
                  issues={expandedFileIssues}
                  contextLines={2}
                  selectedIssueId={selectedIssueId}
                  onIssueSelect={handleIssueSelect}
                  enabled={true}
                />
              </div>
            )}
          </div>
        </motion.div>
      );
    },
    [
      collapseRule,
      ruleMetadata,
      currentRuleSeverity,
      handleSeverityChange,
      ruleConfig?.options,
      defaultOptions,
      handleOptionChange,
      handleResetOptions,
      isRuleUpdating,
      fileNodes,
      expandFileInRule,
      expandedFilePath,
      showFullSource,
      expandedFileIssues,
      selectedIssueId,
      selectIssue,
      showFullSourceView,
      handleIssueSelect,
    ]
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Breadcrumb navigation - shows when rule or file is expanded */}
      <Breadcrumbs
        expandedRuleName={expandedRule?.label ?? null}
        expandedFileName={expandedFile?.label ?? null}
        onCollapseToRoot={collapseRule}
        onCollapseFile={collapseFileInRule}
      />

      {/* Main content - mosaic tile grid with in-place expansion */}
      {/* File views are now rendered INSIDE the expanded rule tile via renderExpandedContent */}
      <div className="flex-1 p-4 overflow-auto">
        {fileGroups.length === 0 ? (
          <EmptyState />
        ) : (
          <ExpandableTileGrid
            items={ruleTileItems}
            expandedId={expandedRuleId}
            expandedChildren={fileTileItems}
            onTileClick={(item) => expandRule(item.id)}
            onExpandedChildClick={(item) => {
              // Find the original file node to get the filePath
              const fileNode = fileNodes.find((f) => f.id === item.id);
              if (fileNode) {
                expandFileInRule(fileNode.data.filePath);
              }
            }}
            onBack={collapseRule}
            availableWidth={availableWidth}
            extraExpandedHeight={extraExpandedHeight}
            padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
            renderExpandedContent={renderExpandedRuleContent}
          />
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
