"use client";

/**
 * DetailView - Zoomed/expanded view for a selected command palette item
 *
 * Features:
 * - Smooth animated transition from list item
 * - Professional monochrome design
 * - Breadcrumb navigation to return
 * - Source code preview with context
 * - Rich content display with actions
 * - Issue list for rules with hover highlighting
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";
import { fetchSourceWithContext } from "../source-fetcher";
import { useUILintStore, type UILintStore } from "../store";
import type {
  SearchableItem,
  RuleSearchData,
  FileSearchData,
  IssueSearchData,
  CaptureSearchData,
} from "./types";
import type { ESLintIssue, ElementIssue } from "../types";

interface DetailViewProps {
  item: SearchableItem | null;
  onBack: () => void;
  onToggleRule?: (ruleId: string) => void;
  isRuleEnabled?: boolean;
  /** Called when user clicks an issue to drill into it */
  onSelectIssue?: (issueId: string) => void;
}

/**
 * Issue with location info for display
 */
interface IssueWithLocation {
  issue: ESLintIssue;
  elementId?: string;
  filePath: string;
  id: string;
}

/**
 * Breadcrumb component for navigation
 */
function Breadcrumb({
  category,
  title,
  onBack,
}: {
  category: string;
  title: string;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200/50 dark:border-zinc-700/50"
    >
      <button
        onClick={onBack}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg",
          "text-xs text-zinc-500 dark:text-zinc-400",
          "hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200",
          "transition-all duration-150"
        )}
      >
        <Icons.ChevronLeft className="w-3.5 h-3.5" />
        <span className="capitalize">{category}</span>
      </button>
      <Icons.ChevronRight className="w-3 h-3 text-zinc-300 dark:text-zinc-600" />
      <span className="text-xs text-zinc-700 dark:text-zinc-200 font-medium truncate">
        {title}
      </span>
    </motion.div>
  );
}

/**
 * Source code preview component
 */
function SourceCodePreview({
  filePath,
  lineNumber,
  columnNumber,
}: {
  filePath: string;
  lineNumber: number;
  columnNumber?: number;
}) {
  const [sourceData, setSourceData] = useState<{
    lines: string[];
    startLine: number;
    highlightLine: number;
    relativePath: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const result = await fetchSourceWithContext(
          {
            fileName: filePath,
            lineNumber,
            columnNumber,
          },
          3 // Show 3 lines of context above and below
        );
        if (!cancelled && result) {
          setSourceData(result);
        }
      } catch (e) {
        console.error("[DetailView] Failed to fetch source:", e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [filePath, lineNumber, columnNumber]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Icons.Spinner className="w-4 h-4 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!sourceData) {
    return (
      <div className="text-xs text-zinc-400 dark:text-zinc-500 py-4 text-center">
        Unable to load source code
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      className={cn(
        "rounded-lg overflow-hidden",
        "bg-zinc-50 dark:bg-zinc-900",
        "border border-zinc-200/80 dark:border-zinc-700/80"
      )}
    >
      {/* Code content */}
      <div className="overflow-x-auto">
        <pre className="text-[11px] leading-5 font-mono">
          {sourceData.lines.map((line, idx) => {
            const lineNum = sourceData.startLine + idx;
            const isHighlighted = lineNum === sourceData.highlightLine;

            return (
              <div
                key={lineNum}
                className={cn(
                  "flex",
                  isHighlighted
                    ? "bg-zinc-200/70 dark:bg-zinc-700/50"
                    : "hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30"
                )}
              >
                {/* Line number */}
                <span
                  className={cn(
                    "w-10 flex-shrink-0 text-right pr-3 select-none",
                    isHighlighted
                      ? "text-zinc-600 dark:text-zinc-300 font-medium"
                      : "text-zinc-400 dark:text-zinc-500"
                  )}
                >
                  {lineNum}
                </span>
                {/* Code */}
                <code
                  className={cn(
                    "flex-1 pr-4",
                    isHighlighted
                      ? "text-zinc-800 dark:text-zinc-100"
                      : "text-zinc-600 dark:text-zinc-400"
                  )}
                >
                  {line || " "}
                </code>
              </div>
            );
          })}
        </pre>
      </div>
    </motion.div>
  );
}

/**
 * Main detail view with animated content
 */
export function DetailView({
  item,
  onBack,
  onToggleRule,
  isRuleEnabled = true,
  onSelectIssue,
}: DetailViewProps) {
  if (!item) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={item.id}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{
          duration: 0.2,
          ease: [0.32, 0.72, 0, 1],
        }}
        className="flex flex-col h-full"
      >
        {/* Breadcrumb */}
        <Breadcrumb
          category={item.category}
          title={item.title}
          onBack={onBack}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05, ease: [0.32, 0.72, 0, 1] }}
          className="flex-1 overflow-y-auto"
        >
          {item.type === "rule" && (
            <RuleDetailContent
              item={item}
              data={item.data as RuleSearchData}
              onToggle={onToggleRule}
              isEnabled={isRuleEnabled}
              onSelectIssue={onSelectIssue}
            />
          )}
          {item.type === "file" && (
            <FileDetailContent item={item} data={item.data as FileSearchData} />
          )}
          {item.type === "issue" && (
            <IssueDetailContent
              item={item}
              data={item.data as IssueSearchData}
            />
          )}
          {item.type === "capture" && (
            <CaptureDetailContent
              item={item}
              data={item.data as CaptureSearchData}
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Rule detail content with issue list
 */
function RuleDetailContent({
  item,
  data,
  onToggle,
  isEnabled,
  onSelectIssue,
}: {
  item: SearchableItem;
  data: RuleSearchData;
  onToggle?: (ruleId: string) => void;
  isEnabled: boolean;
  onSelectIssue?: (issueId: string) => void;
}) {
  const { rule } = data;
  const fullRuleId = `uilint/${rule.id}`;

  // Get issues from store
  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );
  const fileIssuesCache = useUILintStore(
    (s: UILintStore) => s.fileIssuesCache
  );
  const autoScanElements = useUILintStore(
    (s: UILintStore) => s.autoScanState.elements
  );
  const setHoveredCommandPaletteItemId = useUILintStore(
    (s: UILintStore) => s.setHoveredCommandPaletteItemId
  );

  // Build a map from elementId to filePath from scanned elements
  const elementIdToFilePath = useMemo(() => {
    const map = new Map<string, string>();
    for (const el of autoScanElements) {
      map.set(el.id, el.source.fileName);
    }
    return map;
  }, [autoScanElements]);

  // Collect all issues for this rule
  const issuesForRule = useMemo(() => {
    const issues: IssueWithLocation[] = [];

    // From element issues
    elementIssuesCache.forEach((elementIssue, elementId) => {
      const filePath = elementIdToFilePath.get(elementId);
      if (!filePath) return; // Skip if we can't find the file path

      elementIssue.issues.forEach((issue) => {
        if (issue.ruleId === fullRuleId) {
          const issueId = `issue:${elementId}:${issue.ruleId}:${issue.line}:${issue.column}`;
          issues.push({
            issue,
            elementId,
            filePath,
            id: issueId,
          });
        }
      });
    });

    // From file issues
    fileIssuesCache.forEach((fileIssues, filePath) => {
      fileIssues.forEach((issue) => {
        if (issue.ruleId === fullRuleId) {
          const issueId = `issue:file:${filePath}:${issue.ruleId}:${issue.line}:${issue.column}`;
          issues.push({
            issue,
            filePath,
            id: issueId,
          });
        }
      });
    });

    return issues;
  }, [elementIssuesCache, fileIssuesCache, elementIdToFilePath, fullRuleId]);

  // Handle hover on issue - update hovered item for heatmap highlighting
  const handleIssueHover = useCallback(
    (issueId: string | null) => {
      setHoveredCommandPaletteItemId(issueId);
    },
    [setHoveredCommandPaletteItemId]
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header with toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              "bg-zinc-100 dark:bg-zinc-800"
            )}
          >
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                rule.category === "static" ? "bg-zinc-500" : "bg-zinc-400"
              )}
            />
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {rule.name}
            </h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              {rule.category}
            </p>
          </div>
        </div>

        {/* Toggle button */}
        <button
          onClick={() => onToggle?.(rule.id)}
          className={cn(
            "px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-150",
            "border",
            isEnabled
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent"
              : "bg-transparent text-zinc-500 border-zinc-300 dark:border-zinc-600 hover:border-zinc-400"
          )}
        >
          {isEnabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {rule.description}
      </p>

      {/* Issues list */}
      {issuesForRule.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide font-medium">
            {issuesForRule.length} issue{issuesForRule.length !== 1 ? "s" : ""}{" "}
            found
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {issuesForRule.map((issueWithLoc) => (
              <RuleIssueItem
                key={issueWithLoc.id}
                issueWithLoc={issueWithLoc}
                onHover={handleIssueHover}
                onClick={() => onSelectIssue?.(issueWithLoc.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Rule ID */}
      <div className="pt-1">
        <code className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
          {fullRuleId}
        </code>
      </div>
    </div>
  );
}

/**
 * Individual issue item in the rule detail list
 */
function RuleIssueItem({
  issueWithLoc,
  onHover,
  onClick,
}: {
  issueWithLoc: IssueWithLocation;
  onHover: (issueId: string | null) => void;
  onClick: () => void;
}) {
  const { issue, filePath, id } = issueWithLoc;

  // Extract filename from path
  const fileName = filePath.split("/").pop() || filePath;

  return (
    <div
      className={cn(
        "group px-3 py-2 rounded-lg cursor-pointer",
        "bg-zinc-50 dark:bg-zinc-800/50",
        "border border-transparent",
        "hover:border-zinc-300 dark:hover:border-zinc-600",
        "hover:bg-zinc-100 dark:hover:bg-zinc-800",
        "transition-all duration-100"
      )}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      {/* Issue message */}
      <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-2">
        {issue.message}
      </p>

      {/* Location */}
      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
        <Icons.File className="w-3 h-3" />
        <span className="font-mono">{fileName}</span>
        <span>:</span>
        <span className="font-mono">{issue.line}</span>
        {issue.column && (
          <>
            <span>:</span>
            <span className="font-mono">{issue.column}</span>
          </>
        )}
        <Icons.ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

/**
 * File detail content
 */
function FileDetailContent({
  item,
  data,
}: {
  item: SearchableItem;
  data: FileSearchData;
}) {
  const { sourceFile } = data;

  // Build cursor:// URL
  const cursorUrl = `cursor://file/${sourceFile.path}`;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            "bg-zinc-100 dark:bg-zinc-800"
          )}
        >
          <Icons.File className="w-4 h-4 text-zinc-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {sourceFile.displayName}
          </h3>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate font-mono">
            {sourceFile.path}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {item.issueCount || 0}
          </span>{" "}
          issues
        </span>
        <span>
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {sourceFile.elements.length}
          </span>{" "}
          elements
        </span>
      </div>

      {/* Actions */}
      <div className="pt-1">
        <a
          href={cursorUrl}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-2 rounded-lg",
            "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900",
            "hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors",
            "text-xs font-medium"
          )}
        >
          <Icons.ExternalLink className="w-3.5 h-3.5" />
          Open in Cursor
        </a>
      </div>
    </div>
  );
}

/**
 * Issue detail content with source code preview
 */
function IssueDetailContent({
  item,
  data,
}: {
  item: SearchableItem;
  data: IssueSearchData;
}) {
  const { issue, filePath } = data;

  // Build cursor:// URL
  const cursorUrl =
    filePath && issue.line
      ? `cursor://file/${filePath}:${issue.line}${issue.column ? `:${issue.column}` : ""}`
      : null;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            "bg-zinc-100 dark:bg-zinc-800"
          )}
        >
          <Icons.AlertTriangle className="w-4 h-4 text-zinc-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
            {issue.message}
          </h3>
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Icons.File className="w-3.5 h-3.5" />
        <span className="truncate font-mono text-[11px]">{filePath}</span>
        <span className="text-zinc-300 dark:text-zinc-600">:</span>
        <span className="font-mono">{issue.line}</span>
        {issue.column && (
          <>
            <span className="text-zinc-300 dark:text-zinc-600">:</span>
            <span className="font-mono">{issue.column}</span>
          </>
        )}
      </div>

      {/* Source code preview */}
      {filePath && issue.line && (
        <SourceCodePreview
          filePath={filePath}
          lineNumber={issue.line}
          columnNumber={issue.column}
        />
      )}

      {/* Rule ID */}
      {issue.ruleId && (
        <div>
          <code className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
            {issue.ruleId}
          </code>
        </div>
      )}

      {/* Actions */}
      <div className="pt-1">
        {cursorUrl && (
          <a
            href={cursorUrl}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 rounded-lg",
              "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900",
              "hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors",
              "text-xs font-medium"
            )}
          >
            <Icons.ExternalLink className="w-3.5 h-3.5" />
            Open in Cursor
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Capture detail content
 */
function CaptureDetailContent({
  item,
  data,
}: {
  item: SearchableItem;
  data: CaptureSearchData;
}) {
  const { capture, issues } = data;

  // Get image source
  const imageSrc =
    capture.dataUrl ||
    (capture.filename
      ? `/api/.uilint/screenshots?filename=${encodeURIComponent(capture.filename)}`
      : undefined);

  const timeDisplay = new Date(capture.timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="p-4 space-y-4">
      {/* Thumbnail */}
      <div
        className={cn(
          "relative overflow-hidden rounded-lg",
          "bg-zinc-100 dark:bg-zinc-800",
          "border border-zinc-200/80 dark:border-zinc-700/80"
        )}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={`Capture of ${capture.route}`}
            className="w-full h-36 object-cover object-top"
          />
        ) : (
          <div className="w-full h-36 flex items-center justify-center">
            <Icons.Image className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <p className="text-sm font-medium text-white">{capture.route}</p>
          <p className="text-xs text-white/70">{timeDisplay}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        {issues.length > 0 ? (
          <>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {issues.length}
            </span>
            <span>vision issues detected</span>
          </>
        ) : (
          <>
            <Icons.Check className="w-3.5 h-3.5 text-zinc-500" />
            <span>No issues found</span>
          </>
        )}
      </div>

      {/* Issues list */}
      {issues.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">
            Issues
          </p>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {issues.slice(0, 6).map((issue, i) => (
              <div
                key={i}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs",
                  "bg-zinc-50 dark:bg-zinc-800/50",
                  "border border-zinc-200/50 dark:border-zinc-700/50",
                  "text-zinc-600 dark:text-zinc-400"
                )}
              >
                {issue.message}
              </div>
            ))}
            {issues.length > 6 && (
              <p className="text-[10px] text-zinc-400 pl-3">
                +{issues.length - 6} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
