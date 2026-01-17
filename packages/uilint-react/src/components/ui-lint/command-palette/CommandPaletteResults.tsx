"use client";

import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "./icons";
import {
  CommandPaletteItem,
  CommandPaletteSectionHeader,
} from "./CommandPaletteItem";
import { SourceCodePreview } from "./SourceCodePreview";
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
  /** Callback for toggling ESLint scan on/off */
  onToggleScan: () => void;
  /** Current state of ESLint live scanning */
  liveScanEnabled: boolean;
  disabledRules: Set<string>;
  /** Called when a filter should be added (e.g., clicking a rule adds rule filter) */
  onAddFilter?: (filter: CommandPaletteFilter) => void;
  /** Active loc filters - issues matching these should be expanded */
  activeLocFilters?: CommandPaletteFilter[];
  /** Category ID to scroll to (e.g., "rules" or "file:/path/to/file.tsx") */
  scrollToCategory?: string | null;
  /** Called after scrolling to category completes */
  onScrollComplete?: () => void;
}

/**
 * Category display names and order
 */
const CATEGORY_CONFIG: Record<CategoryType, { name: string; icon: React.ReactNode }> = {
  settings: { name: "Settings", icon: <Icons.Settings className="w-3.5 h-3.5" /> },
  vision: { name: "Vision", icon: <Icons.Eye className="w-3.5 h-3.5" /> },
  actions: { name: "Actions", icon: <Icons.Play className="w-3.5 h-3.5" /> },
  rules: { name: "Rules", icon: <Icons.Settings className="w-3.5 h-3.5" /> },
  captures: { name: "Captures", icon: <Icons.Camera className="w-3.5 h-3.5" /> },
  files: { name: "Files", icon: <Icons.File className="w-3.5 h-3.5" /> },
  issues: { name: "Issues", icon: <Icons.AlertTriangle className="w-3.5 h-3.5" /> },
};

// Categories that get their own section headers (not issues - they're grouped by file)
const STANDARD_CATEGORIES: CategoryType[] = ["settings", "vision", "files", "captures", "rules"];

/**
 * Results list for command palette - unified view with category sections
 * Issues are grouped by file with per-file headers
 */
export function CommandPaletteResults({
  results,
  selectedIndex,
  selectedItemId,
  onSelect,
  onHover,
  onToggleRule,
  onToggleScan,
  liveScanEnabled,
  disabledRules,
  onAddFilter,
  activeLocFilters = [],
  scrollToCategory,
  onScrollComplete,
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

  // Scroll to category when requested
  useEffect(() => {
    if (!scrollToCategory) return;
    const container = scrollRef.current;
    if (!container) return;

    const categoryEl = container.querySelector(`[data-category-id="${scrollToCategory}"]`);
    if (categoryEl) {
      categoryEl.scrollIntoView({ block: "start", behavior: "smooth" });
    }

    // Notify parent that scroll is complete
    onScrollComplete?.();
  }, [scrollToCategory, onScrollComplete]);

  // Group results: standard categories + issues grouped by file
  const { standardGroups, issuesByFile } = useMemo(() => {
    const standardGroups = new Map<CategoryType, Array<{ result: ScoredSearchResult; index: number }>>();
    const issuesByFile = new Map<string, {
      fileName: string;
      directory: string;
      items: Array<{ result: ScoredSearchResult; index: number }>
    }>();

    // Initialize standard groups
    for (const cat of STANDARD_CATEGORIES) {
      standardGroups.set(cat, []);
    }

    // Group results
    results.forEach((result, index) => {
      if (result.item.type === "issue") {
        // Group issues by file
        const issueData = result.item.data as IssueSearchData;
        const filePath = issueData.filePath || "unknown";

        if (!issuesByFile.has(filePath)) {
          const parts = filePath.split("/");
          const fileName = parts[parts.length - 1] || filePath;
          const directory = parts.length >= 2 ? parts.slice(0, -1).join("/") : "";
          issuesByFile.set(filePath, { fileName, directory, items: [] });
        }
        issuesByFile.get(filePath)!.items.push({ result, index });
      } else {
        // Standard category
        const category = result.item.category;
        const group = standardGroups.get(category);
        if (group) {
          group.push({ result, index });
        }
      }
    });

    return { standardGroups, issuesByFile };
  }, [results]);

  // Check if all categories are empty
  const isEmpty = results.length === 0;

  if (isEmpty) {
    return (
      <div className="py-8 flex-1">
        <EmptyState message="No results found" />
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[400px] flex-1" ref={scrollRef}>
      <div className="py-2">
        {/* 1. File-grouped issues - FIRST (most important) */}
        {Array.from(issuesByFile.entries()).map(([filePath, { fileName, directory, items }]) => (
          <div key={filePath} className="mb-2">
            <CommandPaletteSectionHeader
              icon={<Icons.File className="w-3.5 h-3.5" />}
              categoryId={`file:${filePath}`}
            >
              <span className="flex items-center gap-2">
                <span>{fileName}</span>
                {directory && (
                  <span className="text-muted-foreground font-normal normal-case tracking-normal">
                    {directory}
                  </span>
                )}
                <span className="text-muted-foreground">({items.length})</span>
              </span>
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
                onToggleScan={onToggleScan}
                liveScanEnabled={liveScanEnabled}
                disabledRules={disabledRules}
                onAddFilter={onAddFilter}
                activeLocFilters={activeLocFilters}
              />
            ))}
          </div>
        ))}

        {/* 2. Captures section (screenshots) */}
        {(standardGroups.get("captures")?.length ?? 0) > 0 && (
          <div className="mb-2">
            <CommandPaletteSectionHeader
              icon={CATEGORY_CONFIG.captures.icon}
              categoryId="captures"
            >
              {CATEGORY_CONFIG.captures.name} ({standardGroups.get("captures")!.length})
            </CommandPaletteSectionHeader>

            {standardGroups.get("captures")!.map(({ result, index }) => (
              <ResultItem
                key={result.item.id}
                result={result}
                index={index}
                isSelected={selectedIndex === index}
                isPinned={selectedItemId === result.item.id}
                onSelect={onSelect}
                onHover={onHover}
                onToggleRule={onToggleRule}
                onToggleScan={onToggleScan}
                liveScanEnabled={liveScanEnabled}
                disabledRules={disabledRules}
                onAddFilter={onAddFilter}
                activeLocFilters={activeLocFilters}
              />
            ))}
          </div>
        )}

        {/* 3. Vision section (capture actions) */}
        {(standardGroups.get("vision")?.length ?? 0) > 0 && (
          <div className="mb-2">
            <CommandPaletteSectionHeader
              icon={CATEGORY_CONFIG.vision.icon}
              categoryId="vision"
            >
              {CATEGORY_CONFIG.vision.name} ({standardGroups.get("vision")!.length})
            </CommandPaletteSectionHeader>

            {standardGroups.get("vision")!.map(({ result, index }) => (
              <ResultItem
                key={result.item.id}
                result={result}
                index={index}
                isSelected={selectedIndex === index}
                isPinned={selectedItemId === result.item.id}
                onSelect={onSelect}
                onHover={onHover}
                onToggleRule={onToggleRule}
                onToggleScan={onToggleScan}
                liveScanEnabled={liveScanEnabled}
                disabledRules={disabledRules}
                onAddFilter={onAddFilter}
                activeLocFilters={activeLocFilters}
              />
            ))}
          </div>
        )}

        {/* 4. Rules section */}
        {(standardGroups.get("rules")?.length ?? 0) > 0 && (
          <div className="mb-2">
            <CommandPaletteSectionHeader
              icon={CATEGORY_CONFIG.rules.icon}
              categoryId="rules"
            >
              {CATEGORY_CONFIG.rules.name} ({standardGroups.get("rules")!.length})
            </CommandPaletteSectionHeader>

            {standardGroups.get("rules")!.map(({ result, index }) => (
              <ResultItem
                key={result.item.id}
                result={result}
                index={index}
                isSelected={selectedIndex === index}
                isPinned={selectedItemId === result.item.id}
                onSelect={onSelect}
                onHover={onHover}
                onToggleRule={onToggleRule}
                onToggleScan={onToggleScan}
                liveScanEnabled={liveScanEnabled}
                disabledRules={disabledRules}
                onAddFilter={onAddFilter}
                activeLocFilters={activeLocFilters}
              />
            ))}
          </div>
        )}

        {/* 5. Settings section - LAST */}
        {(standardGroups.get("settings")?.length ?? 0) > 0 && (
          <div className="mb-2">
            <CommandPaletteSectionHeader
              icon={CATEGORY_CONFIG.settings.icon}
              categoryId="settings"
            >
              {CATEGORY_CONFIG.settings.name} ({standardGroups.get("settings")!.length})
            </CommandPaletteSectionHeader>

            {standardGroups.get("settings")!.map(({ result, index }) => (
              <ResultItem
                key={result.item.id}
                result={result}
                index={index}
                isSelected={selectedIndex === index}
                isPinned={selectedItemId === result.item.id}
                onSelect={onSelect}
                onHover={onHover}
                onToggleRule={onToggleRule}
                onToggleScan={onToggleScan}
                liveScanEnabled={liveScanEnabled}
                disabledRules={disabledRules}
                onAddFilter={onAddFilter}
                activeLocFilters={activeLocFilters}
              />
            ))}
          </div>
        )}
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
  onToggleScan,
  liveScanEnabled,
  disabledRules,
  onAddFilter,
  activeLocFilters = [],
}: {
  result: ScoredSearchResult;
  index: number;
  isSelected: boolean;
  /** Whether this item is pinned/selected (persists, shows heatmap) */
  isPinned: boolean;
  onSelect: (index: number) => void;
  onHover: (itemId: string | null) => void;
  onToggleRule: (ruleId: string) => void;
  onToggleScan: () => void;
  liveScanEnabled: boolean;
  disabledRules: Set<string>;
  onAddFilter?: (filter: CommandPaletteFilter) => void;
  activeLocFilters?: CommandPaletteFilter[];
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
            onToggleScan={onToggleScan}
            liveScanEnabled={liveScanEnabled}
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
            activeLocFilters={activeLocFilters}
          />
        </div>
      );
    }

    default:
      return null;
  }
}

/**
 * Action item (connect, toggle scan, capture, etc.)
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
  onToggleScan,
  liveScanEnabled,
}: {
  id: string;
  title: string;
  subtitle?: string;
  actionType: ActionSearchData["actionType"];
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onToggleScan: () => void;
  liveScanEnabled: boolean;
}) {
  const icon = useMemo(() => {
    switch (actionType) {
      case "connect":
        return <Icons.Plug className="w-4 h-4 text-text-secondary" />;
      case "toggle-scan":
        return <Icons.Scan className="w-4 h-4 text-text-secondary" />;
      case "capture-full":
        return <Icons.Camera className="w-4 h-4 text-text-secondary" />;
      case "capture-region":
        return <Icons.Crop className="w-4 h-4 text-text-secondary" />;
      default:
        return <Icons.Zap className="w-4 h-4 text-text-secondary" />;
    }
  }, [actionType]);

  // For toggle-scan, show On/Off button like rules
  if (actionType === "toggle-scan") {
    return (
      <CommandPaletteItem
        icon={icon}
        title={title}
        subtitle={subtitle}
        isSelected={isSelected}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        rightElement={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleScan();
            }}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              liveScanEnabled
                ? "bg-surface-elevated text-foreground hover:bg-hover"
                : "bg-surface text-text-disabled hover:bg-hover"
            )}
          >
            {liveScanEnabled ? "On" : "Off"}
          </button>
        }
      />
    );
  }

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
        isPinned && "ring-1 ring-border ring-inset"
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
                ? "bg-text-secondary"
                : "bg-muted-foreground"
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
              <span className="text-[10px] text-text-disabled">0</span>
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
                  ? "bg-surface-elevated text-foreground hover:bg-hover"
                  : "bg-surface text-text-disabled hover:bg-hover"
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
        isPinned && "ring-1 ring-border ring-inset"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-75",
          "hover:bg-hover",
          isSelected && "bg-hover"
        )}
        onClick={handleClick}
      >
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-surface-elevated">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={`Capture of ${capture.route}`}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icons.Image className="w-4 h-4 text-text-disabled" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {title}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {subtitle}
          </div>
        </div>

        {/* Issue badge */}
        <div className="flex items-center gap-2">
          {issueCount > 0 ? (
            <IssueCountBadge count={issueCount} />
          ) : (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-elevated">
              <Icons.Check className="w-3 h-3 text-text-secondary" />
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
        isPinned && "ring-1 ring-border ring-inset"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <CommandPaletteItem
        icon={<Icons.File className="w-4 h-4 text-muted-foreground" />}
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
 * Helper to check if a loc string matches the filter value
 * Handles both exact match and match without column
 */
function matchesLoc(loc: string, locValue: string): boolean {
  if (loc === locValue) {
    return true;
  }
  // Check if filter (without column) matches the loc's file:line portion
  const lastIdx = loc.lastIndexOf(":");
  const secondLastIdx = loc.lastIndexOf(":", lastIdx - 1);
  if (secondLastIdx >= 0) {
    const fileAndLine = loc.slice(0, lastIdx);
    if (fileAndLine === locValue) {
      return true;
    }
  }
  return false;
}

/**
 * Check if an issue matches any of the active loc filters
 * Uses the same matching logic as applyFilter in use-fuzzy-search.ts
 */
function issueMatchesLocFilter(
  issue: IssueSearchData,
  locFilters: CommandPaletteFilter[]
): boolean {
  if (locFilters.length === 0) return false;

  for (const filter of locFilters) {
    const locValue = filter.value;

    // Method 1: Check if the issue's dataLoc matches the filter value
    // dataLoc format is: filePath:line:column (element source location)
    if (issue.issue.dataLoc && matchesLoc(issue.issue.dataLoc, locValue)) {
      return true;
    }

    // Method 2: Check if the elementId contains the location
    // elementId format is: loc:path:line:column#occurrence
    if (issue.elementId) {
      // Extract location from elementId (remove "loc:" prefix and "#occurrence" suffix)
      const withoutPrefix = issue.elementId.replace(/^loc:/, "");
      const withoutOccurrence = withoutPrefix.replace(/#\d+$/, "");
      if (matchesLoc(withoutOccurrence, locValue)) {
        return true;
      }
    }

    // Method 3: For file-level issues, check the elementLoc (first element in file)
    if (issue.elementLoc && matchesLoc(issue.elementLoc, locValue)) {
      return true;
    }
  }
  return false;
}

/**
 * Individual issue item - click adds filter
 * When matching an active loc filter, renders expanded detail view
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
  activeLocFilters = [],
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
  activeLocFilters?: CommandPaletteFilter[];
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

  // Check if this issue should be expanded (matches an active loc filter)
  const isExpanded = issueMatchesLocFilter(issue, activeLocFilters);

  const handleClick = useCallback(() => {
    // Don't add another filter if already expanded (already matches a loc filter)
    if (isExpanded) return;

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
  }, [onAddFilter, issue.filePath, issue.issue.line, issue.issue.column, locationLabel, isExpanded]);

  // Render expanded view when matching a loc filter
  if (isExpanded) {
    return (
      <ExpandedIssueItem
        issue={issue}
        isSelected={isSelected}
        isPinned={isPinned}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        cursorUrl={cursorUrl}
      />
    );
  }

  // Render compact view
  return (
    <div
      className={cn(
        "group",
        isPinned && "ring-1 ring-border ring-inset"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <CommandPaletteItem
        icon={<Icons.AlertTriangle className="w-4 h-4 text-muted-foreground" />}
        title={title}
        subtitle={subtitle}
        rightElement={
          cursorUrl ? (
            <a
              href={cursorUrl}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                "bg-surface-elevated text-text-secondary",
                "hover:bg-hover transition-colors"
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
 * Expanded issue item showing full detail content inline
 * Displays when an issue matches an active loc filter
 */
function ExpandedIssueItem({
  issue,
  isSelected,
  isPinned,
  onMouseEnter,
  onMouseLeave,
  cursorUrl,
}: {
  issue: IssueSearchData;
  isSelected: boolean;
  isPinned: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  cursorUrl: string | null;
}) {
  const { issue: eslintIssue, filePath } = issue;

  return (
    <div
      className={cn(
        "mx-2 my-1 rounded-lg overflow-hidden",
        "border border-border",
        "bg-surface-elevated",
        isSelected && "ring-2 ring-border",
        isPinned && "ring-1 ring-border"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-3 pb-2">
        <div
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
            "bg-muted"
          )}
        >
          <Icons.AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">
            {eslintIssue.message}
          </p>
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 px-3 pb-2 text-xs text-muted-foreground">
        <Icons.File className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate font-mono text-[11px]">{filePath}</span>
        <span className="text-text-disabled">:</span>
        <span className="font-mono">{eslintIssue.line}</span>
        {eslintIssue.column && (
          <>
            <span className="text-text-disabled">:</span>
            <span className="font-mono">{eslintIssue.column}</span>
          </>
        )}
      </div>

      {/* Source code preview */}
      {filePath && eslintIssue.line && (
        <div className="px-3 pb-3">
          <SourceCodePreview
            filePath={filePath}
            lineNumber={eslintIssue.line}
            columnNumber={eslintIssue.column}
            maxHeightClass="max-h-48"
          />
        </div>
      )}

      {/* Footer with rule ID and actions */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted border-t border-border">
        {eslintIssue.ruleId && (
          <code className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-surface">
            {eslintIssue.ruleId}
          </code>
        )}
        {cursorUrl && (
          <a
            href={cursorUrl}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md",
              "bg-accent text-accent-foreground",
              "hover:bg-accent/90 transition-colors",
              "text-xs font-medium"
            )}
          >
            <Icons.ExternalLink className="w-3 h-3" />
            Open in Cursor
          </a>
        )}
      </div>
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
          ? "bg-surface-elevated text-foreground"
          : "bg-surface text-muted-foreground"
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
      <Icons.Search className="w-8 h-8 mb-2 text-text-disabled" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
