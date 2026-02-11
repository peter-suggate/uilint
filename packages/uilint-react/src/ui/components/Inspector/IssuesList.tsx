/**
 * IssuesList - Main content component for the unified inspector
 *
 * Orchestrates a two-level tile hierarchy with zoom-based navigation:
 * - Level 0: Rule treemap (area = issue count, color = severity)
 * - Level 1: File treemap (zoomed into a rule, with ContextStrip for siblings)
 * - Level 2: Source view (for a specific file within a rule)
 *
 * Uses a zoomable treemap: clicking a cell zooms in with a crossfade,
 * while the ContextStrip at top preserves sibling context and navigation.
 */
import React, { useCallback, useMemo, useEffect, useRef, useState } from "react";
import { useComposedStore } from "../../../core/store";
import {
  selectFileGroups,
} from "../../../core/store/file-groups-selector";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import type { ESLintPluginSlice } from "../../../plugins/eslint/slice";
import type { AvailableRule } from "../../../plugins/eslint/types";
import { RuleHeader } from "./RuleHeader";
import { FileSourceView } from "./FileSourceView";
import { IssueSummaryView } from "./IssueSummaryView";
import { DuplicateIssueList } from "./DuplicateIssueList";
import { Breadcrumbs } from "./Breadcrumbs";
import {
  TreemapGrid,
  TreemapCell,
  calculateTreemapLayout,
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
 * Optionally attaches rule config metadata for config tag display.
 */
function ruleNodeToTileItem(
  node: RuleNode,
  ruleMeta?: AvailableRule
): BaseTileItem & { data: RuleNode["data"] } {
  return {
    id: node.id,
    label: node.label,
    count: node.count ?? 0,
    fileCount: node.fileCount,
    metadata: {
      isRule: true,
      ruleId: node.id,
      tileType: "rule" as const,
      category: ruleMeta?.category,
      currentSeverity: ruleMeta?.currentSeverity,
      defaultSeverity: ruleMeta?.defaultSeverity,
      currentOptions: ruleMeta?.currentOptions,
      optionSchema: ruleMeta?.optionSchema,
    },
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
    tileType: node.tileType,
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
// File Treemap Sub-component
// ============================================================================

/** Height for the file treemap within a zoomed rule */
const FILE_TREEMAP_HEIGHT = 200;
const FILE_TREEMAP_GAP = 2;

function FileTreemap({
  items,
  availableWidth,
  onFileClick,
}: {
  items: BaseTileItem[];
  availableWidth: number;
  onFileClick: (item: BaseTileItem) => void;
}) {
  const layout = useMemo(() => {
    if (items.length === 0 || availableWidth <= 0) return null;
    return calculateTreemapLayout(
      items.map((item) => ({ id: item.id, value: item.count, label: item.label })),
      { width: availableWidth, height: FILE_TREEMAP_HEIGHT, gap: FILE_TREEMAP_GAP }
    );
  }, [items, availableWidth]);

  if (!layout || items.length === 0) return null;

  return (
    <div className="p-3">
      <div className="relative" style={{ width: availableWidth, height: FILE_TREEMAP_HEIGHT }}>
        {items.map((item, index) => {
          const cell = layout.cells.get(item.id);
          if (!cell) return null;
          return (
            <TreemapCell
              key={item.id}
              id={item.id}
              label={item.label}
              subtitle={item.subtitle}
              count={item.count}
              severityCounts={item.severityCounts}
              x={cell.x}
              y={cell.y}
              width={cell.width}
              height={cell.height}
              areaFraction={cell.areaFraction}
              index={index}
              onClick={() => onFileClick(item)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Constants
// ============================================================================

/** Default height when container measurement is not yet available */
const DEFAULT_TREEMAP_HEIGHT = 400;

// ============================================================================
// Component
// ============================================================================

export function IssuesList({ className }: IssuesListProps) {
  // Ref for scrolling and height measurement
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(DEFAULT_TREEMAP_HEIGHT);

  // Store selectors
  const fileGroups = useComposedStore(selectFileGroups);
  const expandedRuleId = useComposedStore((s) => s.inspector.expandedRuleId);
  const expandedFilePath = useComposedStore((s) => s.inspector.expandedFilePath);
  const selectedIssueId = useComposedStore((s) => s.inspector.selectedIssueId);
  const showFullSource = useComposedStore((s) => s.inspector.showFullSource);
  const availableWidth = useComposedStore((s) => s.inspector.layoutAvailableWidth);

  // Available rules for config tag metadata
  const allAvailableRules = useComposedStore(
    (s) => (s.plugins?.eslint as ESLintPluginSlice | undefined)?.availableRules
  );

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

  // Build a lookup map for available rules
  const availableRulesMap = useMemo(() => {
    const map = new Map<string, AvailableRule>();
    for (const rule of allAvailableRules ?? []) {
      map.set(rule.id, rule);
    }
    return map;
  }, [allAvailableRules]);

  // Convert nodes to BaseTileItem format for TileGrid
  const ruleTileItems = useMemo(
    () => ruleNodes.map((node) => ruleNodeToTileItem(node, availableRulesMap.get(node.id))),
    [ruleNodes, availableRulesMap]
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

  // Measure container height for treemap layout
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (height > 0) {
          setContainerHeight(height - 32); // Subtract padding
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Scroll to top when zooming into a rule
  useEffect(() => {
    if (!expandedRuleId || !scrollContainerRef.current) return;
    if (typeof scrollContainerRef.current.scrollTo === "function") {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [expandedRuleId]);

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

  // Check if the expanded rule has a custom content renderer
  const ruleContentRenderer = useMemo(() => {
    if (!expandedRuleId) return null;
    const contribution = pluginRegistry.getRuleContribution(expandedRuleId);
    return contribution?.contentRenderer ?? null;
  }, [expandedRuleId]);

  // Ignore system state
  const ignoredIssueIds = useComposedStore((s) => s.ignoredIssueIds);
  const showIgnored = useComposedStore((s) => s.showIgnoredIssues);
  const addIgnore = useComposedStore((s) => s.addIgnoredIssue);
  const removeIgnore = useComposedStore((s) => s.removeIgnoredIssue);
  const toggleShowIgnored = useComposedStore((s) => s.toggleShowIgnoredIssues);

  const handleIgnoreIssue = useCallback(
    (issueId: string) => {
      if (ignoredIssueIds.has(issueId)) {
        removeIgnore(issueId);
      } else {
        addIgnore(issueId);
      }
    },
    [ignoredIssueIds, addIgnore, removeIgnore]
  );

  // Count ignored issues for the expanded rule
  const ruleIgnoredCount = useMemo(() => {
    if (!expandedRuleId || ignoredIssueIds.size === 0) return 0;
    // Count how many issues in all files of this rule are ignored
    const rule = ruleNodes.find((r) => r.id === expandedRuleId);
    if (!rule) return 0;
    let count = 0;
    for (const file of rule.data.files) {
      for (const issue of file.issues) {
        if (ignoredIssueIds.has(issue.id)) count++;
      }
    }
    return count;
  }, [expandedRuleId, ruleNodes, ignoredIssueIds]);

  // Custom render function for zoomed rule content
  // Renders Breadcrumbs + RuleHeader + either file tiles or file content
  const renderZoomedContent = useCallback(
    (
      item: BaseTileItem,
      children: BaseTileItem[],
      zoomedAvailableWidth: number,
      _zoomedAvailableHeight: number
    ) => {
      const isFileExpanded = expandedFilePath !== null;

      return (
        <div
          data-tile-id={item.id}
          className={cn(
            "rounded-xl",
            "border border-foreground/[0.05]",
            "bg-background/80",
            "overflow-hidden",
            "shadow-sm",
            "h-full flex flex-col"
          )}
        >
          {/* Breadcrumb navigation */}
          <Breadcrumbs
            variant="embedded"
            expandedRuleName={expandedRule?.label ?? null}
            expandedFileName={expandedFile?.label ?? null}
            onCollapseToRoot={collapseRule}
            onCollapseFile={collapseFileInRule}
          />

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
              highestSeverity={expandedRule?.data.highestSeverity}
              issueCount={expandedRule?.count}
              currentSeverity={currentRuleSeverity}
              onSeverityChange={handleSeverityChange}
              optionSchema={ruleMetadata?.optionSchema}
              currentOptions={ruleConfig?.options}
              defaultOptions={defaultOptions}
              onOptionChange={handleOptionChange}
              onResetOptions={handleResetOptions}
              isUpdating={isRuleUpdating}
              ignoredCount={ruleIgnoredCount}
              showIgnored={showIgnored}
              onToggleShowIgnored={toggleShowIgnored}
            />

            {/* Content: either file treemap or file content */}
            {!isFileExpanded ? (
              <FileTreemap
                items={children}
                availableWidth={zoomedAvailableWidth - 24}
                onFileClick={(fileItem) => {
                  const fileNode = fileNodes.find((f) => f.id === fileItem.id);
                  if (fileNode) {
                    expandFileInRule(fileNode.data.filePath);
                  }
                }}
              />
            ) : ruleContentRenderer === "duplicate-comparison" ? (
              <div className="flex-1 overflow-auto">
                <DuplicateIssueList
                  issues={expandedFileIssues}
                  selectedIssueId={selectedIssueId}
                  onIssueClick={(issue) => {
                    selectIssue(issue.id);
                  }}
                  ignoredIssueIds={ignoredIssueIds}
                  onIgnore={handleIgnoreIssue}
                  showIgnored={showIgnored}
                />
              </div>
            ) : !showFullSource ? (
              <div className="flex-1 overflow-auto">
                <IssueSummaryView
                  issues={expandedFileIssues}
                  selectedIssueId={selectedIssueId}
                  onIssueClick={(issue) => {
                    selectIssue(issue.id);
                    showFullSourceView();
                  }}
                  onShowFullSource={showFullSourceView}
                />
              </div>
            ) : (
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
        </div>
      );
    },
    [
      collapseRule,
      collapseFileInRule,
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
      expandedRule,
      expandedFile,
      ruleContentRenderer,
      ignoredIssueIds,
      showIgnored,
      handleIgnoreIssue,
      ruleIgnoredCount,
      toggleShowIgnored,
    ]
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Main content - zoomable treemap with zoom-based navigation */}
      <div ref={scrollContainerRef} className="flex-1 p-4 overflow-auto">
        {fileGroups.length === 0 ? (
          <EmptyState />
        ) : (
          <TreemapGrid
            items={ruleTileItems}
            zoomedId={expandedRuleId}
            zoomedChildren={fileTileItems}
            onCellClick={(item) => expandRule(item.id)}
            onChildClick={(item) => {
              const fileNode = fileNodes.find((f) => f.id === item.id);
              if (fileNode) {
                expandFileInRule(fileNode.data.filePath);
              }
            }}
            onBack={collapseRule}
            availableWidth={availableWidth}
            availableHeight={containerHeight}
            renderZoomedContent={renderZoomedContent}
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
