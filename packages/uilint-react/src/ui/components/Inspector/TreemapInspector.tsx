/**
 * TreemapInspector - Unified composite view for the inspector panel
 *
 * Replaces the split IssuesList + TreemapGrid architecture with a single
 * component that renders all hierarchy levels with ghost cell animations.
 *
 * Architecture:
 *   Layer 1: Root rule cells (fade out on zoom)
 *   Layer 2: Ghost file cells (invisible, positioned inside rule cells, layoutId anchors)
 *   Layer 3: Zoomed view (ContextStrip + content with layoutId-matched file cells)
 *
 * Ghost cells enable smooth spatial animations: file cells appear to "expand out"
 * of their parent rule cell using Framer Motion's layoutId.
 */
import React, { useCallback, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { useComposedStore } from "../../../core/store";
import { selectFileGroups } from "../../../core/store/file-groups-selector";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import type { ESLintPluginSlice } from "../../../plugins/eslint/slice";
import type { AvailableRule } from "../../../plugins/eslint/types";
import { RuleHeader } from "./RuleHeader";
import { FileSourceView } from "./FileSourceView";
import { IssueSummaryView } from "./IssueSummaryView";
import { DuplicateIssueList } from "./DuplicateIssueList";
import { Breadcrumbs } from "./Breadcrumbs";
import {
  TreemapCell,
  ContextStrip,
  calculateTreemapLayout,
  rootTreemapVariants,
  zoomedViewVariants,
  zoomTransition,
  type BaseTileItem,
  type TreemapItem,
} from "../HierarchicalTiles";
import {
  fileGroupsToRuleNodes,
  getFileNodesForRule,
  type RuleNode,
  type FileForRuleNode,
} from "./RuleNodeAdapter";
import { useTreemapStore } from "./treemap-inspector-store";
import { cn } from "../../../lib/utils";

// ============================================================================
// Constants
// ============================================================================

/** Height for the file treemap within a zoomed rule */
const FILE_TREEMAP_HEIGHT = 200;
const FILE_TREEMAP_GAP = 2;
const TREEMAP_GAP = 2;
const GHOST_GAP = 1;
const CONTEXT_STRIP_HEIGHT = 44;


// ============================================================================
// Tile Item Adapters
// ============================================================================

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

function fileNodeToTileItem(
  node: FileForRuleNode
): BaseTileItem & { data: FileForRuleNode["data"] } {
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

function toTreemapItems(items: BaseTileItem[]): TreemapItem[] {
  return items.map((item) => ({ id: item.id, value: item.count, label: item.label }));
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-4xl mb-4 opacity-30">✨</div>
      <h3 className="text-lg font-medium text-foreground/80 mb-2">No issues found</h3>
      <p className="text-sm text-muted-foreground/60 max-w-xs">
        Great job! Your code looks clean.
      </p>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getRuleDescription(ruleId: string): string | undefined {
  const descriptions: Record<string, string> = {
    "no-unused-vars": "Disallow variables that are declared but never used in the code.",
    "@typescript-eslint/no-unused-vars":
      "Disallow variables that are declared but never used in the code.",
    "no-console": "Disallow the use of console methods.",
    "react-hooks/exhaustive-deps":
      "Checks effect dependencies and warns when dependencies are missing.",
    "react-hooks/rules-of-hooks": "Enforces the Rules of Hooks.",
    "no-explicit-any": "Disallow the any type to encourage more precise typing.",
    "@typescript-eslint/no-explicit-any":
      "Disallow the any type to encourage more precise typing.",
  };
  return descriptions[ruleId];
}

function getRuleCategory(ruleId: string): string | undefined {
  if (ruleId.startsWith("@typescript-eslint/")) return "TypeScript";
  if (ruleId.startsWith("react-hooks/")) return "React Hooks";
  if (ruleId.startsWith("react/")) return "React";
  return "ESLint";
}

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
  return `https://eslint.org/docs/latest/rules/${ruleId}`;
}

// ============================================================================
// Component
// ============================================================================

export interface TreemapInspectorProps {
  className?: string;
}

export function TreemapInspector({ className }: TreemapInspectorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ===== Navigation state (composed store) =====
  const fileGroups = useComposedStore(selectFileGroups);
  const expandedRuleId = useComposedStore((s) => s.inspector.expandedRuleId);
  const expandedFilePath = useComposedStore((s) => s.inspector.expandedFilePath);
  const selectedIssueId = useComposedStore((s) => s.inspector.selectedIssueId);
  const showFullSource = useComposedStore((s) => s.inspector.showFullSource);
  const availableWidth = useComposedStore((s) => s.inspector.layoutAvailableWidth);

  const allAvailableRules = useComposedStore(
    (s) => (s.plugins?.eslint as ESLintPluginSlice | undefined)?.availableRules
  );

  // Actions
  const expandRule = useComposedStore((s) => s.expandRule);
  const collapseRule = useComposedStore((s) => s.collapseRule);
  const expandFileInRule = useComposedStore((s) => s.expandFileInRule);
  const collapseFileInRule = useComposedStore((s) => s.collapseFileInRule);
  const selectIssue = useComposedStore((s) => s.selectIssue);
  const showFullSourceView = useComposedStore((s) => s.showFullSourceView);

  // ===== Treemap-specific state (standalone store) =====
  const containerHeight = useTreemapStore((s) => s.containerHeight);
  const fileItemsByRule = useTreemapStore((s) => s.fileItemsByRule);
  const setContainerSize = useTreemapStore((s) => s.setContainerSize);
  const setFileItemsByRule = useTreemapStore((s) => s.setFileItemsByRule);

  // ===== Derived data =====
  const ruleNodes = useMemo(() => fileGroupsToRuleNodes(fileGroups), [fileGroups]);

  const availableRulesMap = useMemo(() => {
    const map = new Map<string, AvailableRule>();
    for (const rule of allAvailableRules ?? []) {
      map.set(rule.id, rule);
    }
    return map;
  }, [allAvailableRules]);

  const ruleTileItems = useMemo(
    () => ruleNodes.map((node) => ruleNodeToTileItem(node, availableRulesMap.get(node.id))),
    [ruleNodes, availableRulesMap]
  );

  const expandedRule = useMemo(
    () => ruleNodes.find((r) => r.id === expandedRuleId) || null,
    [ruleNodes, expandedRuleId]
  );

  const fileNodes = useMemo(
    () => (expandedRule ? getFileNodesForRule(expandedRule) : []),
    [expandedRule]
  );

  const fileTileItems = useMemo(() => fileNodes.map(fileNodeToTileItem), [fileNodes]);

  const expandedFile = useMemo(
    () => fileNodes.find((f) => f.data.filePath === expandedFilePath) || null,
    [fileNodes, expandedFilePath]
  );

  // Pre-compute file items for ALL rules (for ghost cells)
  const allFileItemsByRule = useMemo(() => {
    const map = new Map<string, BaseTileItem[]>();
    for (const rule of ruleNodes) {
      map.set(rule.id, getFileNodesForRule(rule).map(fileNodeToTileItem));
    }
    return map;
  }, [ruleNodes]);

  // Sync to store
  useEffect(() => {
    setFileItemsByRule(allFileItemsByRule);
  }, [allFileItemsByRule, setFileItemsByRule]);

  // ===== Layout computations =====
  const treemapHeight = Math.max(containerHeight, 200);

  const rootLayout = useMemo(
    () =>
      calculateTreemapLayout(toTreemapItems(ruleTileItems), {
        width: availableWidth,
        height: treemapHeight,
        gap: TREEMAP_GAP,
      }),
    [ruleTileItems, availableWidth, treemapHeight]
  );

  // Ghost layouts: mini file treemaps inside each rule cell
  const ghostLayouts = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateTreemapLayout>>();
    for (const item of ruleTileItems) {
      const cell = rootLayout.cells.get(item.id);
      const children = fileItemsByRule.get(item.id);
      if (!cell || !children?.length) continue;
      map.set(
        item.id,
        calculateTreemapLayout(toTreemapItems(children), {
          width: cell.width,
          height: cell.height,
          gap: GHOST_GAP,
        })
      );
    }
    return map;
  }, [ruleTileItems, rootLayout, fileItemsByRule]);

  // Zoomed file treemap layout (full size)
  const zoomedFileLayout = useMemo(() => {
    if (!expandedRuleId) return null;
    const fileItems = fileTileItems;
    if (!fileItems.length) return null;
    return calculateTreemapLayout(toTreemapItems(fileItems), {
      width: Math.max(availableWidth - 24, 100),
      height: FILE_TREEMAP_HEIGHT,
      gap: FILE_TREEMAP_GAP,
    });
  }, [expandedRuleId, fileTileItems, availableWidth]);

  // ===== Context strip items =====
  const contextStripItems = useMemo(
    () =>
      ruleTileItems.map((item) => ({
        id: item.id,
        label: item.label,
        count: item.count,
        severityCounts: item.severityCounts,
        isActive: item.id === expandedRuleId,
      })),
    [ruleTileItems, expandedRuleId]
  );

  // ===== Issues for expanded file =====
  const expandedFileIssues = useMemo(() => {
    if (!expandedFilePath || !expandedFile || !expandedRule) return [];
    return expandedFile.data.issues.map((issue) => ({
      ...issue,
      ruleId: expandedRule.id,
      pluginId: "eslint",
      filePath: expandedFilePath,
      dataLoc: `${expandedFilePath}:${issue.line}:${issue.column ?? 0}`,
    }));
  }, [expandedFilePath, expandedFile, expandedRule]);

  // ===== Rule config =====
  const ruleConfig = useComposedStore((s) => {
    if (!expandedRuleId) return null;
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.ruleConfigs) return null;
    return eslintState.ruleConfigs.get(expandedRuleId);
  });

  const ruleMetadata = useComposedStore((s) => {
    if (!expandedRuleId) return null;
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.availableRules) return null;
    return eslintState.availableRules.find((r) => r.id === expandedRuleId);
  });

  const isRuleUpdating = useComposedStore((s) => {
    if (!expandedRuleId) return false;
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.ruleConfigUpdating) return false;
    return eslintState.ruleConfigUpdating.get(expandedRuleId) ?? false;
  });

  const currentRuleSeverity: "off" | "warn" | "error" = useMemo(() => {
    if (!ruleConfig?.severity) return "warn";
    return ruleConfig.severity;
  }, [ruleConfig?.severity]);

  const defaultOptions = useMemo(() => {
    if (!ruleMetadata?.defaultOptions) return {};
    return Array.isArray(ruleMetadata.defaultOptions)
      ? (ruleMetadata.defaultOptions[0] as Record<string, unknown>) ?? {}
      : (ruleMetadata.defaultOptions as Record<string, unknown>) ?? {};
  }, [ruleMetadata?.defaultOptions]);

  const ruleContentRenderer = useMemo(() => {
    if (!expandedRuleId) return null;
    const contribution = pluginRegistry.getRuleContribution(expandedRuleId);
    return contribution?.contentRenderer ?? null;
  }, [expandedRuleId]);

  // ===== Ignore system =====
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

  const ruleIgnoredCount = useMemo(() => {
    if (!expandedRuleId || ignoredIssueIds.size === 0) return 0;
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

  // ===== Callbacks =====
  const handleSeverityChange = useCallback(
    (severity: "off" | "warn" | "error") => {
      if (!expandedRuleId) return;
      const apiSeverity = severity === "warn" ? "warning" : severity;
      pluginRegistry.setRuleSeverity(expandedRuleId, apiSeverity);
    },
    [expandedRuleId]
  );

  const handleOptionChange = useCallback(
    (key: string, value: unknown) => {
      if (!expandedRuleId) return;
      const currentOptions = ruleConfig?.options ?? {};
      const newOptions = { ...currentOptions, [key]: value };
      pluginRegistry.setRuleConfig(expandedRuleId, newOptions);
    },
    [expandedRuleId, ruleConfig?.options]
  );

  const handleResetOptions = useCallback(() => {
    if (!expandedRuleId || !ruleMetadata?.defaultOptions) return;
    const defaultOpts = Array.isArray(ruleMetadata.defaultOptions)
      ? (ruleMetadata.defaultOptions[0] as Record<string, unknown>) ?? {}
      : (ruleMetadata.defaultOptions as Record<string, unknown>) ?? {};
    pluginRegistry.setRuleConfig(expandedRuleId, defaultOpts);
  }, [expandedRuleId, ruleMetadata?.defaultOptions]);

  const handleIssueSelect = useCallback(
    (issueId: string) => {
      selectIssue(selectedIssueId === issueId ? null : issueId);
    },
    [selectedIssueId, selectIssue]
  );

  // ===== Effects =====

  // Auto-expand from heatmap/command palette
  useEffect(() => {
    if (!selectedIssueId) return;
    for (const rule of ruleNodes) {
      for (const file of rule.data.files) {
        const hasIssue = file.issues.some((issue) => issue.id === selectedIssueId);
        if (hasIssue) {
          if (expandedRuleId !== rule.id) expandRule(rule.id);
          if (expandedFilePath !== file.filePath) expandFileInRule(file.filePath);
          return;
        }
      }
    }
  }, [selectedIssueId, ruleNodes, expandedRuleId, expandedFilePath, expandRule, expandFileInRule]);

  // Measure container
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) setContainerSize(availableWidth, h - 32);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [availableWidth, setContainerSize]);

  // Scroll to top on rule zoom
  useEffect(() => {
    if (!expandedRuleId || !scrollContainerRef.current) return;
    if (typeof scrollContainerRef.current.scrollTo === "function") {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [expandedRuleId]);

  // ===== Render =====
  const isFileExpanded = expandedFilePath !== null;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div ref={scrollContainerRef} className="flex-1 p-4 overflow-auto">
        {fileGroups.length === 0 ? (
          <EmptyState />
        ) : (
          <LayoutGroup>
            <div
              className="relative"
              style={{ width: availableWidth, height: treemapHeight }}
            >
              {/* ========= Layer 1: Root rule cells ========= */}
              <AnimatePresence>
                {!expandedRuleId && (
                  <motion.div
                    key="root-rules"
                    variants={rootTreemapVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={zoomTransition}
                    className="absolute inset-0"
                  >
                    {ruleTileItems.map((item, index) => {
                      const cell = rootLayout.cells.get(item.id);
                      if (!cell) return null;
                      return (
                        <TreemapCell
                          key={item.id}
                          id={item.id}
                          label={item.label}
                          count={item.count}
                          fileCount={item.fileCount}
                          severityCounts={item.severityCounts}
                          x={cell.x}
                          y={cell.y}
                          width={cell.width}
                          height={cell.height}
                          areaFraction={cell.areaFraction}
                          index={index}
                          onClick={() => expandRule(item.id)}
                        />
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ========= Layer 2: Ghost file cells ========= */}
              <AnimatePresence>
                {!expandedRuleId &&
                  ruleTileItems.flatMap((item) => {
                    const parentCell = rootLayout.cells.get(item.id);
                    const ghostLayout = ghostLayouts.get(item.id);
                    const children = fileItemsByRule.get(item.id);
                    if (!parentCell || !ghostLayout || !children) return [];
                    return children.map((child) => {
                      const gc = ghostLayout.cells.get(child.id);
                      if (!gc) return null;
                      return (
                        <TreemapCell
                          key={`ghost-${child.id}`}
                          layoutId={`treemap-file-${child.id}`}
                          ghost={true}
                          id={child.id}
                          label={child.label}
                          count={child.count}
                          severityCounts={child.severityCounts}
                          x={parentCell.x + gc.x}
                          y={parentCell.y + gc.y}
                          width={gc.width}
                          height={gc.height}
                          areaFraction={gc.areaFraction}
                          onClick={() => {}}
                        />
                      );
                    });
                  })}
              </AnimatePresence>

              {/* ========= Layer 3: Zoomed view ========= */}
              <AnimatePresence>
                {expandedRuleId && expandedRule && (
                  <motion.div
                    key={`zoomed-${expandedRuleId}`}
                    variants={zoomedViewVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={zoomTransition}
                    className="absolute inset-0 flex flex-col"
                  >
                    {/* Context strip for sibling rule navigation */}
                    <div
                      className="shrink-0 px-1"
                      style={{ height: CONTEXT_STRIP_HEIGHT }}
                    >
                      <ContextStrip
                        items={contextStripItems}
                        activeId={expandedRuleId}
                        onItemClick={(id) => {
                          if (id === expandedRuleId) {
                            collapseRule();
                          } else {
                            expandRule(id);
                          }
                        }}
                      />
                    </div>

                    {/* Zoomed content */}
                    <div
                      data-tile-id={expandedRuleId}
                      className={cn(
                        "rounded-xl",
                        "border border-foreground/[0.05]",
                        "bg-background/80",
                        "overflow-hidden",
                        "shadow-sm",
                        "flex-1 flex flex-col"
                      )}
                    >
                      <Breadcrumbs
                        variant="embedded"
                        expandedRuleName={expandedRule.label ?? null}
                        expandedFileName={expandedFile?.label ?? null}
                        onCollapseToRoot={collapseRule}
                        onCollapseFile={collapseFileInRule}
                      />

                      <div className="flex-1 flex flex-col overflow-hidden">
                        <RuleHeader
                          ruleFilter={{
                            type: "rule",
                            id: expandedRuleId,
                            label: expandedRule.label,
                          }}
                          description={
                            ruleMetadata?.description ??
                            getRuleDescription(expandedRuleId)
                          }
                          category={
                            ruleMetadata?.category ??
                            getRuleCategory(expandedRuleId)
                          }
                          docsUrl={
                            ruleMetadata?.docs ?? getRuleDocsUrl(expandedRuleId)
                          }
                          onClear={collapseRule}
                          showCloseButton={false}
                          highestSeverity={expandedRule.data.highestSeverity}
                          issueCount={expandedRule.count}
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

                        {/* File treemap with layoutId OR file source view */}
                        {!isFileExpanded ? (
                          <div className="p-3">
                            <div
                              className="relative"
                              style={{
                                width: Math.max(availableWidth - 24, 100),
                                height: FILE_TREEMAP_HEIGHT,
                              }}
                            >
                              {fileTileItems.map((file, fi) => {
                                const cell = zoomedFileLayout?.cells.get(
                                  file.id
                                );
                                if (!cell) return null;
                                return (
                                  <TreemapCell
                                    key={file.id}
                                    layoutId={`treemap-file-${file.id}`}
                                    id={file.id}
                                    label={file.label}
                                    subtitle={file.subtitle}
                                    count={file.count}
                                    severityCounts={file.severityCounts}
                                    x={cell.x}
                                    y={cell.y}
                                    width={cell.width}
                                    height={cell.height}
                                    areaFraction={cell.areaFraction}
                                    index={fi}
                                    onClick={() => {
                                      const fileNode = fileNodes.find(
                                        (f) => f.id === file.id
                                      );
                                      if (fileNode) {
                                        expandFileInRule(
                                          fileNode.data.filePath
                                        );
                                      }
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ) : ruleContentRenderer === "duplicate-comparison" ? (
                          <div className="flex-1 overflow-auto">
                            <DuplicateIssueList
                              issues={expandedFileIssues}
                              selectedIssueId={selectedIssueId}
                              onIssueClick={(issue) => selectIssue(issue.id)}
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        )}
      </div>
    </div>
  );
}

export default TreemapInspector;
