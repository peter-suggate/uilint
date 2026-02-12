/**
 * RuleCard - A single rule row in the inspector's rule list.
 *
 * Flat, borderless row matching the CommandPalette's ResultList aesthetic.
 * Uses Radix Accordion for accessible expand/collapse with keyboard nav.
 * Hovering the collapsed row previews matching heatmap elements.
 * Hovering file rows narrows the preview to that specific file.
 */
import React, { useCallback, useMemo, useRef, useEffect } from "react";
import { motion } from "motion/react";
import {
  ChevronDown,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useComposedStore } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import type { RuleCardData } from "../../../core/store/issues-selectors";
import type { ESLintPluginSlice } from "../../../plugins/eslint/slice";
import type { AvailableRule } from "../../../plugins/eslint/types";
import type { Issue, IssueSeverity } from "../../types";
import { FilePill } from "./FilePill";
import { RuleHeader } from "./RuleHeader";
import { IssueSummaryView } from "./IssueSummaryView";
import { FileSourceView } from "./FileSourceView";
import { DuplicateIssueList } from "./DuplicateIssueList";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../Accordion";

// ============================================================================
// Helpers
// ============================================================================

function getRuleDescription(ruleId: string): string | undefined {
  const descriptions: Record<string, string> = {
    "no-unused-vars":
      "Disallow variables that are declared but never used in the code.",
    "@typescript-eslint/no-unused-vars":
      "Disallow variables that are declared but never used in the code.",
    "no-console": "Disallow the use of console methods.",
    "react-hooks/exhaustive-deps":
      "Checks effect dependencies and warns when dependencies are missing.",
    "react-hooks/rules-of-hooks": "Enforces the Rules of Hooks.",
    "no-explicit-any":
      "Disallow the any type to encourage more precise typing.",
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

function SeverityDot({ severity }: { severity: IssueSeverity }) {
  return (
    <span
      className={cn(
        "w-2 h-2 rounded-full shrink-0",
        severity === "error" && "bg-error",
        severity === "warning" && "bg-warning",
        severity === "info" && "bg-info"
      )}
    />
  );
}

function SeverityIcon({
  severity,
  size = 12,
}: {
  severity: IssueSeverity;
  size?: number;
}) {
  switch (severity) {
    case "error":
      return <AlertCircle size={size} className="text-error shrink-0" />;
    case "warning":
      return <AlertTriangle size={size} className="text-warning shrink-0" />;
    case "info":
      return <Info size={size} className="text-info shrink-0" />;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface RuleCardProps {
  card: RuleCardData;
  isExpanded: boolean;
  expandedFilePath: string | null;
  selectedIssueId: string | null;
  showFullSource: boolean;
  ruleMeta?: AvailableRule;
  index: number;
  /** @deprecated Accordion.Root handles expansion via onValueChange. Kept for interface compat. */
  onExpand?: (ruleId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function RuleCard({
  card,
  isExpanded,
  expandedFilePath,
  selectedIssueId,
  showFullSource,
  ruleMeta,
  index,
}: RuleCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Store actions
  const expandFileInRule = useComposedStore((s) => s.expandFileInRule);
  const collapseFileInRule = useComposedStore((s) => s.collapseFileInRule);
  const collapseRule = useComposedStore((s) => s.collapseRule);
  const selectIssue = useComposedStore((s) => s.selectIssue);
  const showFullSourceView = useComposedStore((s) => s.showFullSourceView);
  const setHeatmapPreview = useComposedStore((s) => s.setHeatmapPreview);
  const clearHeatmapPreview = useComposedStore((s) => s.clearHeatmapPreview);
  const expandRule = useComposedStore((s) => s.expandRule);

  // Rule config from ESLint store
  const ruleConfig = useComposedStore((s) => {
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.ruleConfigs) return null;
    return eslintState.ruleConfigs.get(card.ruleId);
  });

  const isRuleUpdating = useComposedStore((s) => {
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.ruleConfigUpdating) return false;
    return eslintState.ruleConfigUpdating.get(card.ruleId) ?? false;
  });

  // Ignore system
  const ignoredIssueIds = useComposedStore((s) => s.ignoredIssueIds);
  const showIgnored = useComposedStore((s) => s.showIgnoredIssues);
  const addIgnore = useComposedStore((s) => s.addIgnoredIssue);
  const removeIgnore = useComposedStore((s) => s.removeIgnoredIssue);
  const toggleShowIgnored = useComposedStore((s) => s.toggleShowIgnoredIssues);

  // Check for custom content renderer (e.g., duplicate-comparison)
  const ruleContentRenderer = useMemo(() => {
    const contribution = pluginRegistry.getRuleContribution(card.ruleId);
    return contribution?.contentRenderer ?? null;
  }, [card.ruleId]);

  // Current rule severity
  const currentRuleSeverity = useMemo(() => {
    if (!ruleConfig?.severity) return "warn" as const;
    return ruleConfig.severity;
  }, [ruleConfig?.severity]);

  // Default options for reset
  const defaultOptions = useMemo(() => {
    if (!ruleMeta?.defaultOptions) return {};
    return Array.isArray(ruleMeta.defaultOptions)
      ? (ruleMeta.defaultOptions[0] as Record<string, unknown>) ?? {}
      : (ruleMeta.defaultOptions as Record<string, unknown>) ?? {};
  }, [ruleMeta?.defaultOptions]);

  // Expanded file data
  const expandedFile = useMemo(() => {
    if (!expandedFilePath) return null;
    return card.files.find((f) => f.filePath === expandedFilePath) ?? null;
  }, [card.files, expandedFilePath]);

  // Issues for the expanded file
  const expandedFileIssues = useMemo((): Issue[] => {
    if (!expandedFile) return [];
    return expandedFile.issues;
  }, [expandedFile]);

  // Ignored count for this rule
  const ruleIgnoredCount = useMemo(() => {
    if (ignoredIssueIds.size === 0) return 0;
    let count = 0;
    for (const file of card.files) {
      for (const issue of file.issues) {
        if (ignoredIssueIds.has(issue.id)) count++;
      }
    }
    return count;
  }, [card.files, ignoredIssueIds]);

  // Handlers
  const handleSeverityChange = useCallback(
    (severity: "off" | "warn" | "error") => {
      const apiSeverity = severity === "warn" ? "warning" : severity;
      pluginRegistry.setRuleSeverity(card.ruleId, apiSeverity);
    },
    [card.ruleId]
  );

  const handleOptionChange = useCallback(
    (key: string, value: unknown) => {
      const currentOptions = ruleConfig?.options ?? {};
      const newOptions = { ...currentOptions, [key]: value };
      pluginRegistry.setRuleConfig(card.ruleId, newOptions);
    },
    [card.ruleId, ruleConfig?.options]
  );

  const handleResetOptions = useCallback(() => {
    if (!ruleMeta?.defaultOptions) return;
    const defaultOpts = Array.isArray(ruleMeta.defaultOptions)
      ? (ruleMeta.defaultOptions[0] as Record<string, unknown>) ?? {}
      : (ruleMeta.defaultOptions as Record<string, unknown>) ?? {};
    pluginRegistry.setRuleConfig(card.ruleId, defaultOpts);
  }, [card.ruleId, ruleMeta?.defaultOptions]);

  const handleIssueSelect = useCallback(
    (issueId: string) => {
      selectIssue(selectedIssueId === issueId ? null : issueId);
    },
    [selectedIssueId, selectIssue]
  );

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

  // Heatmap preview on hover (collapsed row = rule-level preview)
  const handleRowMouseEnter = useCallback(() => {
    if (!isExpanded) {
      setHeatmapPreview(card.ruleId, null);
    }
  }, [isExpanded, setHeatmapPreview, card.ruleId]);

  const handleRowMouseLeave = useCallback(() => {
    if (!isExpanded) {
      clearHeatmapPreview();
    }
  }, [isExpanded, clearHeatmapPreview]);

  // File row hover → heatmap preview (narrowed to file)
  const handleFileRowMouseEnter = useCallback(
    (filePath: string) => {
      setHeatmapPreview(card.ruleId, filePath);
    },
    [setHeatmapPreview, card.ruleId]
  );

  const handleFileRowMouseLeave = useCallback(() => {
    clearHeatmapPreview();
  }, [clearHeatmapPreview]);

  // FilePill click → expand rule and pre-select file
  const handleFilePillClick = useCallback(
    (filePath: string) => {
      if (!isExpanded) {
        expandRule(card.ruleId);
      }
      expandFileInRule(filePath);
    },
    [isExpanded, expandRule, card.ruleId, expandFileInRule]
  );

  // Auto-scroll when expanded
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      const timeoutId = setTimeout(() => {
        cardRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [isExpanded]);

  const description = ruleMeta?.description ?? getRuleDescription(card.ruleId);
  const isFileExpanded = expandedFilePath !== null;

  return (
    <AccordionItem value={card.ruleId} ref={cardRef}>
      {/* Trigger — flat row, no border, no card */}
      <AccordionTrigger
        className={cn(
          "w-full",
          "flex items-start gap-2.5 px-3 py-2.5",
          "transition-colors duration-75",
          "hover:bg-foreground/4",
          "rounded-md",
          isExpanded && "bg-foreground/3"
        )}
        onMouseEnter={handleRowMouseEnter}
        onMouseLeave={handleRowMouseLeave}
      >
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.15,
            delay: Math.min(index * 0.04, 0.3),
          }}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-2 mb-0.5">
            <SeverityDot severity={card.highestSeverity} />
            <span className="font-medium tracking-tight text-foreground text-sm truncate flex-1 min-w-0">
              {card.ruleName}
            </span>
            <span className="text-[11px] text-muted-foreground/70 tabular-nums shrink-0">
              {card.totalCount}
            </span>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0"
            >
              <ChevronDown size={12} className="text-muted-foreground/60" />
            </motion.div>
          </div>

          {/* Description */}
          {description && (
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-1 ml-4 mb-1">
              {description}
            </p>
          )}

          {/* File pills — only when collapsed */}
          {!isExpanded && (
            <div className="flex flex-wrap gap-1 ml-4 mt-1">
              {card.files.slice(0, 3).map((file) => (
                <FilePill
                  key={file.filePath}
                  fileName={file.fileName}
                  filePath={file.filePath}
                  ruleId={card.ruleId}
                  issueCount={file.issueCount}
                  onClick={() => handleFilePillClick(file.filePath)}
                />
              ))}
              {card.files.length > 3 && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] text-muted-foreground/40">
                  +{card.files.length - 3} more
                </span>
              )}
            </div>
          )}
        </motion.div>
      </AccordionTrigger>

      {/* Expanded content — flows below with indent, no card border */}
      <AccordionContent>
        <div className="border-t border-foreground/6">
          {/* Rule header with config */}
          <RuleHeader
            ruleFilter={{ type: "rule", id: card.ruleId, label: card.ruleName }}
            description={description}
            category={ruleMeta?.category ?? getRuleCategory(card.ruleId)}
            docsUrl={ruleMeta?.docs ?? getRuleDocsUrl(card.ruleId)}
            onClear={collapseRule}
            showCloseButton={false}
            highestSeverity={card.highestSeverity}
            issueCount={card.totalCount}
            currentSeverity={currentRuleSeverity}
            onSeverityChange={handleSeverityChange}
            optionSchema={ruleMeta?.optionSchema}
            currentOptions={ruleConfig?.options}
            defaultOptions={defaultOptions}
            onOptionChange={handleOptionChange}
            onResetOptions={handleResetOptions}
            isUpdating={isRuleUpdating}
            ignoredCount={ruleIgnoredCount}
            showIgnored={showIgnored}
            onToggleShowIgnored={toggleShowIgnored}
          />

          {/* File context bar — back navigation when a file is selected */}
          {isFileExpanded && expandedFile && (
            <button
              onClick={() => collapseFileInRule()}
              aria-label="Back to file list"
              className={cn(
                "w-full text-left",
                "flex items-center gap-2 px-3 py-1.5",
                "text-[11px]",
                "transition-colors duration-75",
                "hover:bg-foreground/4",
                "border-b border-foreground/4"
              )}
            >
              <ArrowLeft
                size={11}
                className="text-muted-foreground/70 shrink-0"
              />
              <span className="text-foreground/80 font-medium">
                Back to file list
              </span>
              <span className="text-muted-foreground/60">
                ({card.files.length} file{card.files.length !== 1 ? "s" : ""})
              </span>
              <span className="text-muted-foreground/40">-</span>
              <span className="text-foreground/70 truncate">
                {expandedFile.fileName}
              </span>
            </button>
          )}

          {/* Content: file list or expanded file */}
          {!isFileExpanded ? (
            /* File list — flat rows matching CommandPalette style */
            <div className="py-0.5">
              <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground/60">
                Files with issues
              </div>
              {card.files.map((file) => (
                <button
                  key={file.filePath}
                  onClick={() => expandFileInRule(file.filePath)}
                  onMouseEnter={() => handleFileRowMouseEnter(file.filePath)}
                  onMouseLeave={handleFileRowMouseLeave}
                  className={cn(
                    "w-full text-left",
                    "flex items-center gap-2 px-3 py-2",
                    "transition-colors duration-75",
                    "hover:bg-foreground/4",
                    "group"
                  )}
                >
                  <SeverityIcon severity={file.issues[0]?.severity ?? "info"} />
                  <span className="flex-1 min-w-0 text-xs text-foreground/85 truncate">
                    {file.fileName}
                  </span>
                  <span className="text-[11px] text-muted-foreground/40 tabular-nums shrink-0">
                    {file.issueCount}
                  </span>
                </button>
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
                filePath={expandedFilePath!}
                issues={expandedFileIssues}
                contextLines={2}
                selectedIssueId={selectedIssueId}
                onIssueSelect={handleIssueSelect}
                enabled={true}
              />
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
