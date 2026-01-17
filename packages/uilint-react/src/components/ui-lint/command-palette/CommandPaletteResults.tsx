"use client";

import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "./icons";
import {
  CommandPaletteItem,
  CommandPaletteSectionHeader,
} from "./CommandPaletteItem";
import type {
  ScoredSearchResult,
  CategoryType,
  RuleSearchData,
  ActionSearchData,
  CaptureSearchData,
  IssueSearchData,
  FileSearchData,
  CommandPaletteFilter,
} from "./types";

interface CommandPaletteResultsProps {
  results: ScoredSearchResult[];
  selectedIndex: number;
  /** ID of the currently selected/pinned item (persists across interactions) */
  selectedItemId: string | null;
  onSelect: (index: number) => void;
  onHover: (itemId: string | null) => void;
  onToggleRule: (ruleId: string) => void;
  disabledRules: Set<string>;
  /** Called when a filter should be added (e.g., clicking a rule adds rule filter) */
  onAddFilter?: (filter: CommandPaletteFilter) => void;
}

/**
 * Category display names and order
 */
const CATEGORY_CONFIG: Record<CategoryType, { name: string; icon: React.ReactNode }> = {
  actions: { name: "Suggested Actions", icon: <Icons.Zap className="w-3.5 h-3.5" /> },
  rules: { name: "Rules", icon: <Icons.Settings className="w-3.5 h-3.5" /> },
  captures: { name: "Captures", icon: <Icons.Camera className="w-3.5 h-3.5" /> },
  files: { name: "Files", icon: <Icons.File className="w-3.5 h-3.5" /> },
  issues: { name: "Issues", icon: <Icons.AlertTriangle className="w-3.5 h-3.5" /> },
};

const CATEGORY_ORDER: CategoryType[] = ["actions", "rules", "captures", "files", "issues"];

/**
 * Results list for command palette - unified view with category sections
 */
export function CommandPaletteResults({
  results,
  selectedIndex,
  selectedItemId,
  onSelect,
  onHover,
  onToggleRule,
  disabledRules,
  onAddFilter,
}: CommandPaletteResultsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected item
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const selectedEl = container.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups = new Map<CategoryType, Array<{ result: ScoredSearchResult; index: number }>>();

    // Initialize empty groups
    for (const cat of CATEGORY_ORDER) {
      groups.set(cat, []);
    }

    // Group results by category, preserving their global index
    results.forEach((result, index) => {
      const category = result.item.category;
      const group = groups.get(category);
      if (group) {
        group.push({ result, index });
      }
    });

    return groups;
  }, [results]);

  // Check if all categories are empty
  const isEmpty = results.length === 0;

  if (isEmpty) {
    return (
      <div className="py-8">
        <EmptyState message="No results found" />
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[400px]" ref={scrollRef}>
      <div className="py-1">
        {CATEGORY_ORDER.map((category) => {
          const items = groupedResults.get(category) || [];
          if (items.length === 0) return null;

          const config = CATEGORY_CONFIG[category];

          return (
            <React.Fragment key={category}>
              <CommandPaletteSectionHeader icon={config.icon}>
                {config.name} ({items.length})
              </CommandPaletteSectionHeader>

              {items.map(({ result, index }) => (
                <ResultItem
                  key={result.item.id}
                  result={result}
                  index={index}
                  isSelected={selectedIndex === index}
                  isPinned={selectedItemId === result.item.id}
                  onSelect={onSelect}
                  onHover={onHover}
                  onToggleRule={onToggleRule}
                  disabledRules={disabledRules}
                  onAddFilter={onAddFilter}
                />
              ))}
            </React.Fragment>
          );
        })}
      </div>
    </ScrollArea>
  );
}

/**
 * Single result item renderer
 */
function ResultItem({
  result,
  index,
  isSelected,
  isPinned,
  onSelect,
  onHover,
  onToggleRule,
  disabledRules,
  onAddFilter,
}: {
  result: ScoredSearchResult;
  index: number;
  isSelected: boolean;
  /** Whether this item is pinned/selected (persists, shows heatmap) */
  isPinned: boolean;
  onSelect: (index: number) => void;
  onHover: (itemId: string | null) => void;
  onToggleRule: (ruleId: string) => void;
  disabledRules: Set<string>;
  onAddFilter?: (filter: CommandPaletteFilter) => void;
}) {
  const { item } = result;

  // Render based on item type
  switch (item.type) {
    case "action": {
      const actionData = item.data as ActionSearchData;
      return (
        <div data-index={index}>
          <ActionItem
            id={item.id}
            title={item.title}
            subtitle={item.subtitle}
            actionType={actionData.actionType}
            isSelected={isSelected}
            onClick={() => onSelect(index)}
            onMouseEnter={() => onHover(item.id)}
            onMouseLeave={() => onHover(null)}
          />
        </div>
      );
    }

    case "rule": {
      const ruleData = item.data as RuleSearchData;
      return (
        <div data-index={index}>
          <RuleItem
            id={item.id}
            title={item.title}
            subtitle={item.subtitle}
            issueCount={item.issueCount}
            rule={ruleData.rule}
            isSelected={isSelected}
            isPinned={isPinned}
            onMouseEnter={() => onHover(item.id)}
            onMouseLeave={() => onHover(null)}
            onToggle={onToggleRule}
            isEnabled={!disabledRules.has(ruleData.rule.id)}
            onAddFilter={onAddFilter}
          />
        </div>
      );
    }

    case "capture": {
      const captureData = item.data as CaptureSearchData;
      return (
        <div data-index={index}>
          <CaptureItem
            id={item.id}
            title={item.title}
            subtitle={item.subtitle}
            issueCount={item.issueCount}
            capture={captureData.capture}
            isSelected={isSelected}
            isPinned={isPinned}
            onMouseEnter={() => onHover(item.id)}
            onMouseLeave={() => onHover(null)}
            onAddFilter={onAddFilter}
          />
        </div>
      );
    }

    case "file": {
      const fileData = item.data as FileSearchData;
      return (
        <div data-index={index}>
          <FileItem
            id={item.id}
            title={item.title}
            subtitle={item.subtitle}
            issueCount={item.issueCount}
            sourceFile={fileData.sourceFile}
            isSelected={isSelected}
            isPinned={isPinned}
            onMouseEnter={() => onHover(item.id)}
            onMouseLeave={() => onHover(null)}
            onAddFilter={onAddFilter}
          />
        </div>
      );
    }

    case "issue": {
      const issueData = item.data as IssueSearchData;
      return (
        <div data-index={index}>
          <IssueItem
            id={item.id}
            title={item.title}
            subtitle={item.subtitle}
            issue={issueData}
            isSelected={isSelected}
            isPinned={isPinned}
            onMouseEnter={() => onHover(item.id)}
            onMouseLeave={() => onHover(null)}
            onAddFilter={onAddFilter}
          />
        </div>
      );
    }

    default:
      return null;
  }
}

/**
 * Action item (connect, start scan, capture, etc.)
 */
function ActionItem({
  id,
  title,
  subtitle,
  actionType,
  isSelected,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  id: string;
  title: string;
  subtitle?: string;
  actionType: ActionSearchData["actionType"];
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const icon = useMemo(() => {
    switch (actionType) {
      case "connect":
        return <Icons.Plug className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />;
      case "start-scan":
        return <Icons.Scan className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />;
      case "stop-scan":
        return <Icons.X className="w-4 h-4 text-zinc-500" />;
      case "capture-full":
        return <Icons.Camera className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />;
      case "capture-region":
        return <Icons.Crop className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />;
      default:
        return <Icons.Zap className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />;
    }
  }, [actionType]);

  return (
    <CommandPaletteItem
      icon={icon}
      title={title}
      subtitle={subtitle}
      isSelected={isSelected}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
}

/**
 * Rule item - click adds filter
 */
function RuleItem({
  id,
  title,
  subtitle,
  issueCount = 0,
  rule,
  isSelected,
  isPinned,
  onMouseEnter,
  onMouseLeave,
  onToggle,
  isEnabled,
  onAddFilter,
}: {
  id: string;
  title: string;
  subtitle?: string;
  issueCount?: number;
  rule: RuleSearchData["rule"];
  isSelected: boolean;
  isPinned: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onToggle: (ruleId: string) => void;
  isEnabled: boolean;
  onAddFilter?: (filter: CommandPaletteFilter) => void;
}) {
  const handleClick = useCallback(() => {
    if (onAddFilter && issueCount > 0) {
      onAddFilter({
        type: "rule",
        value: rule.id,
        label: rule.name,
      });
    }
  }, [onAddFilter, issueCount, rule.id, rule.name]);

  return (
    <div
      className={cn(
        "group",
        isPinned && "ring-1 ring-zinc-400/50 dark:ring-zinc-500/50 ring-inset"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <CommandPaletteItem
        icon={
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              rule.category === "static"
                ? "bg-zinc-600 dark:bg-zinc-400"
                : "bg-zinc-400 dark:bg-zinc-500"
            )}
          />
        }
        title={title}
        subtitle={subtitle}
        rightElement={
          <div className="flex items-center gap-2">
            {issueCount > 0 ? (
              <IssueCountBadge count={issueCount} />
            ) : (
              <span className="text-[10px] text-zinc-400">0</span>
            )}
            {/* Toggle button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(rule.id);
              }}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                isEnabled
                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              )}
            >
              {isEnabled ? "On" : "Off"}
            </button>
          </div>
        }
        isSelected={isSelected}
        onClick={handleClick}
      />
    </div>
  );
}

/**
 * Capture/screenshot item with thumbnail - click adds filter
 */
function CaptureItem({
  id,
  title,
  subtitle,
  issueCount = 0,
  capture,
  isSelected,
  isPinned,
  onMouseEnter,
  onMouseLeave,
  onAddFilter,
}: {
  id: string;
  title: string;
  subtitle?: string;
  issueCount?: number;
  capture: CaptureSearchData["capture"];
  isSelected: boolean;
  isPinned: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onAddFilter?: (filter: CommandPaletteFilter) => void;
}) {
  // Get image source
  const imageSrc =
    capture.dataUrl ||
    (capture.filename
      ? `/api/.uilint/screenshots?filename=${encodeURIComponent(capture.filename)}`
      : undefined);

  const handleClick = useCallback(() => {
    if (onAddFilter) {
      onAddFilter({
        type: "capture",
        value: capture.id,
        label: capture.route,
      });
    }
  }, [onAddFilter, capture.id, capture.route]);

  return (
    <div
      className={cn(
        "group",
        isPinned && "ring-1 ring-zinc-400/50 dark:ring-zinc-500/50 ring-inset"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-75",
          "hover:bg-zinc-100/80 dark:hover:bg-zinc-700/50",
          isSelected && "bg-zinc-100/80 dark:bg-zinc-700/50"
        )}
        onClick={handleClick}
      >
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={`Capture of ${capture.route}`}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icons.Image className="w-4 h-4 text-zinc-400" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {title}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {subtitle}
          </div>
        </div>

        {/* Issue badge */}
        <div className="flex items-center gap-2">
          {issueCount > 0 ? (
            <IssueCountBadge count={issueCount} />
          ) : (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <Icons.Check className="w-3 h-3 text-zinc-600 dark:text-zinc-400" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * File item with issue count - click adds filter
 */
function FileItem({
  id,
  title,
  subtitle,
  issueCount = 0,
  sourceFile,
  isSelected,
  isPinned,
  onMouseEnter,
  onMouseLeave,
  onAddFilter,
}: {
  id: string;
  title: string;
  subtitle?: string;
  issueCount?: number;
  sourceFile: FileSearchData["sourceFile"];
  isSelected: boolean;
  isPinned: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onAddFilter?: (filter: CommandPaletteFilter) => void;
}) {
  const handleClick = useCallback(() => {
    if (onAddFilter && issueCount > 0) {
      onAddFilter({
        type: "file",
        value: sourceFile.path,
        label: sourceFile.displayName,
      });
    }
  }, [onAddFilter, issueCount, sourceFile.path, sourceFile.displayName]);

  return (
    <div
      className={cn(
        "group",
        isPinned && "ring-1 ring-zinc-400/50 dark:ring-zinc-500/50 ring-inset"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <CommandPaletteItem
        icon={<Icons.File className="w-4 h-4 text-zinc-500" />}
        title={title}
        subtitle={subtitle}
        rightElement={
          <div className="flex items-center gap-2">
            <IssueCountBadge count={issueCount} />
          </div>
        }
        isSelected={isSelected}
        onClick={handleClick}
      />
    </div>
  );
}

/**
 * Individual issue item - click adds filter
 */
function IssueItem({
  id,
  title,
  subtitle,
  issue,
  isSelected,
  isPinned,
  onMouseEnter,
  onMouseLeave,
  onAddFilter,
}: {
  id: string;
  title: string;
  subtitle?: string;
  issue: IssueSearchData;
  isSelected: boolean;
  isPinned: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onAddFilter?: (filter: CommandPaletteFilter) => void;
}) {
  // Build cursor:// URL for opening in Cursor
  const cursorUrl =
    issue.filePath && issue.issue.line
      ? `cursor://file/${issue.filePath}:${issue.issue.line}${issue.issue.column ? `:${issue.issue.column}` : ""}`
      : null;

  // Extract filename for display label
  const fileName = issue.filePath?.split("/").pop() || issue.filePath;
  const locationLabel = issue.issue.line
    ? `${fileName}:${issue.issue.line}${issue.issue.column ? `:${issue.issue.column}` : ""}`
    : fileName;

  const handleClick = useCallback(() => {
    // Add loc filter for any issue with a file path and location
    if (onAddFilter && issue.filePath && issue.issue.line) {
      // Value encodes the full location: filePath:line:column
      const locValue = `${issue.filePath}:${issue.issue.line}${issue.issue.column ? `:${issue.issue.column}` : ""}`;
      onAddFilter({
        type: "loc",
        value: locValue,
        label: locationLabel,
      });
    }
  }, [onAddFilter, issue.filePath, issue.issue.line, issue.issue.column, locationLabel]);

  return (
    <div
      className={cn(
        "group",
        isPinned && "ring-1 ring-zinc-400/50 dark:ring-zinc-500/50 ring-inset"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <CommandPaletteItem
        icon={<Icons.AlertTriangle className="w-4 h-4 text-zinc-500" />}
        title={title}
        subtitle={subtitle}
        rightElement={
          cursorUrl ? (
            <a
              href={cursorUrl}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
                "hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              )}
            >
              <Icons.ExternalLink className="w-3 h-3" />
              Open
            </a>
          ) : undefined
        }
        isSelected={isSelected}
        onClick={handleClick}
      />
    </div>
  );
}

/**
 * Issue count badge
 */
function IssueCountBadge({ count }: { count: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        "min-w-[20px] h-5 px-1.5",
        "text-[10px] font-semibold",
        "rounded-full",
        count > 0
          ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
      )}
    >
      {count}
    </span>
  );
}

/**
 * Empty state display
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icons.Search className="w-8 h-8 mb-2 text-zinc-300 dark:text-zinc-600" />
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
    </div>
  );
}
