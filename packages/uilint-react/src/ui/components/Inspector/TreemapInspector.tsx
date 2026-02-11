/**
 * TreemapInspector - Unified inspector panel for browsing lint issues
 *
 * Two-level master-detail view:
 *   - Root: Scrollable list of rule cards with severity badges and descriptions
 *   - Detail: Expanded rule view with file list, source view, and config
 *
 * Uses the same glassmorphism treatment and visual hierarchy as the command palette.
 */
import React, { useCallback, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
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
  fileGroupsToRuleNodes,
  getFileNodesForRule,
  type FileForRuleNode,
} from "./RuleNodeAdapter";
import { crispEase } from "../HierarchicalTiles/animations/expansion-animations";
import { cn } from "../../../lib/utils";
import type { BaseTileItem } from "../HierarchicalTiles";

// ============================================================================
// Constants
// ============================================================================

const STAGGER_DELAY = 0.02;
const MAX_STAGGER = 0.15;
const TRANSITION_DURATION = 0.25;

// ============================================================================
// Tile Item Adapters
// ============================================================================

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

// ============================================================================
// Severity Badges (matching command palette)
// ============================================================================

function SeverityBadges({
  counts,
}: {
  counts: { error: number; warning: number; info: number };
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {counts.error > 0 && (
        <span className="flex items-center gap-0.5 text-[10px] text-error font-medium tabular-nums">
          <AlertCircle size={10} />
          {counts.error}
        </span>
      )}
      {counts.warning > 0 && (
        <span className="flex items-center gap-0.5 text-[10px] text-warning font-medium tabular-nums">
          <AlertTriangle size={10} />
          {counts.warning}
        </span>
      )}
      {counts.info > 0 && (
        <span className="flex items-center gap-0.5 text-[10px] text-info font-medium tabular-nums">
          <Info size={10} />
          {counts.info}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Severity accent color
// ============================================================================

function getSeverityAccent(severityCounts?: {
  error: number;
  warning: number;
  info: number;
}): string {
  if (!severityCounts) return "bg-foreground/10";
  const { error, warning, info } = severityCounts;
  if (error > 0 && error >= warning && error >= info) return "bg-error";
  if (warning > 0 && warning >= info) return "bg-warning";
  if (info > 0) return "bg-info";
  return "bg-foreground/10";
}

// ============================================================================
// Rule List Item
// ============================================================================

function RuleListItem({
  id,
  label,
  description,
  count,
  fileCount,
  severityCounts,
  index,
  onClick,
}: {
  id: string;
  label: string;
  description?: string;
  count: number;
  fileCount?: number;
  severityCounts?: { error: number; warning: number; info: number };
  index: number;
  onClick: () => void;
}) {
  const issueWord = count === 1 ? "issue" : "issues";
  const fileSuffix =
    fileCount && fileCount > 0
      ? ` in ${fileCount} ${fileCount === 1 ? "file" : "files"}`
      : "";
  const accentClass = getSeverityAccent(severityCounts);

  return (
    <motion.button
      data-rule-item={id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.1,
        ease: crispEase,
        delay: Math.min(index * STAGGER_DELAY, MAX_STAGGER),
      }}
      onClick={onClick}
      className={cn(
        "w-full text-left relative",
        "rounded-xl overflow-hidden",
        "border border-foreground/[0.06]",
        "bg-background/40 backdrop-blur-sm",
        "transition-all duration-100",
        "hover:bg-background/50 hover:border-foreground/[0.1]",
        "cursor-pointer"
      )}
    >
      {/* Severity accent strip */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", accentClass)} />

      <div className="flex items-start gap-3 pl-4 pr-3 py-3">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-foreground/85 truncate">{label}</div>
          {description && (
            <div className="text-[11px] text-muted-foreground/50 truncate mt-0.5">
              {description}
            </div>
          )}
          <div className="text-[11px] text-muted-foreground/40 mt-1 tabular-nums">
            {count} {issueWord}{fileSuffix}
          </div>
        </div>

        {/* Severity badges */}
        {severityCounts && <SeverityBadges counts={severityCounts} />}
      </div>
    </motion.button>
  );
}

// ============================================================================
// File List Item
// ============================================================================

function FileListItem({
  label,
  subtitle,
  count,
  severityCounts,
  index,
  onClick,
}: {
  label: string;
  subtitle?: string;
  count: number;
  severityCounts?: { error: number; warning: number; info: number };
  index: number;
  onClick: () => void;
}) {
  const accentClass = getSeverityAccent(severityCounts);

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.1,
        ease: crispEase,
        delay: Math.min(index * STAGGER_DELAY, MAX_STAGGER),
      }}
      onClick={onClick}
      className={cn(
        "w-full text-left relative",
        "rounded-xl overflow-hidden",
        "border border-foreground/[0.04]",
        "bg-foreground/[0.02]",
        "transition-all duration-100",
        "hover:bg-foreground/[0.04] hover:border-foreground/[0.08]",
        "cursor-pointer"
      )}
    >
      {/* Severity accent strip */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[2px]", accentClass)} />

      <div className="flex items-center gap-2 pl-3.5 pr-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-foreground/80 truncate">{label}</div>
          {subtitle && (
            <div className="text-[10px] text-muted-foreground/40 truncate mt-0.5 font-mono">
              {subtitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {severityCounts && <SeverityBadges counts={severityCounts} />}
          <span className="text-sm font-extralight text-foreground/50 tabular-nums">
            {count}
          </span>
        </div>
      </div>
    </motion.button>
  );
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

  // ===== Navigation state =====
  const fileGroups = useComposedStore(selectFileGroups);
  const expandedRuleId = useComposedStore((s) => s.inspector.expandedRuleId);
  const expandedFilePath = useComposedStore((s) => s.inspector.expandedFilePath);
  const selectedIssueId = useComposedStore((s) => s.inspector.selectedIssueId);
  const showFullSource = useComposedStore((s) => s.inspector.showFullSource);

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

  // ===== Derived data =====
  const ruleNodes = useMemo(() => fileGroupsToRuleNodes(fileGroups), [fileGroups]);

  const availableRulesMap = useMemo(() => {
    const map = new Map<string, AvailableRule>();
    for (const rule of allAvailableRules ?? []) {
      map.set(rule.id, rule);
    }
    return map;
  }, [allAvailableRules]);

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

  // Scroll to top on rule expand
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
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        {fileGroups.length === 0 ? (
          <EmptyState />
        ) : (
          <AnimatePresence mode="wait">
            {!expandedRuleId ? (
              /* ========= Root: Rule list ========= */
              <motion.div
                key="rule-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: TRANSITION_DURATION, ease: crispEase }}
                className="flex flex-col gap-1.5 p-3"
              >
                {ruleNodes.map((rule, index) => {
                  const meta = availableRulesMap.get(rule.id);
                  return (
                    <RuleListItem
                      key={rule.id}
                      id={rule.id}
                      label={rule.label}
                      description={meta?.description ?? getRuleDescription(rule.id)}
                      count={rule.count ?? 0}
                      fileCount={rule.fileCount}
                      severityCounts={rule.severityCounts}
                      index={index}
                      onClick={() => expandRule(rule.id)}
                    />
                  );
                })}
              </motion.div>
            ) : expandedRule ? (
              /* ========= Detail: Expanded rule view ========= */
              <motion.div
                key={`detail-${expandedRuleId}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: TRANSITION_DURATION, ease: crispEase }}
                className="flex flex-col h-full"
              >
                <div
                  className={cn(
                    "rounded-xl mx-3 mt-3",
                    "border border-foreground/[0.05]",
                    "bg-background/80 backdrop-blur-sm",
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
                        ruleMetadata?.category ?? getRuleCategory(expandedRuleId)
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

                    {/* File list or source view */}
                    {!isFileExpanded ? (
                      <div className="flex flex-col gap-1 p-3 overflow-auto">
                        {fileTileItems.map((file, fi) => (
                          <FileListItem
                            key={file.id}
                            label={file.label}
                            subtitle={file.subtitle}
                            count={file.count}
                            severityCounts={file.severityCounts}
                            index={fi}
                            onClick={() => {
                              const fileNode = fileNodes.find(
                                (f) => f.id === file.id
                              );
                              if (fileNode) {
                                expandFileInRule(fileNode.data.filePath);
                              }
                            }}
                          />
                        ))}
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
            ) : null}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

export default TreemapInspector;
