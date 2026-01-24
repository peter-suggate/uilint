"use client";

import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "./icons";
import {
  CommandPaletteItem,
  CommandPaletteSectionHeader,
} from "./CommandPaletteItem";
import { RuleToggleItem } from "./RuleToggleItem";
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
import type { AvailableRule, RuleConfig } from "../store";
import type { ESLintIssue } from "../types";

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
  /** Called when user wants to open inspector for detailed view */
  onOpenInspector?: (
    mode: "rule" | "issue" | "element",
    data: { ruleId?: string; issue?: ESLintIssue; elementId?: string; filePath?: string }
  ) => void;
  /** Category ID to scroll to (e.g., "rules" or "file:/path/to/file.tsx") */
  scrollToCategory?: string | null;
  /** Called after scrolling to category completes */
  onScrollComplete?: () => void;
  /** Available rules with full metadata (docs, optionSchema, etc.) */
  availableRules?: AvailableRule[];
  /** Current rule configurations (severity + options) */
  ruleConfigs?: Map<string, RuleConfig>;
  /** Rule config update in progress (loading states) */
  ruleConfigUpdating?: Map<string, boolean>;
  /** Set rule config (severity and/or options) */
  onSetRuleConfig?: (
    ruleId: string,
    severity: "error" | "warn" | "off",
    options?: Record<string, unknown>
  ) => Promise<void>;
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
 * Clicking items opens the inspector sidebar for detailed viewing
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
  onOpenInspector,
  scrollToCategory,
  onScrollComplete,
  availableRules = [],
  ruleConfigs,
  ruleConfigUpdating,
  onSetRuleConfig,
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
        {/* 1. Rules section - FIRST */}
        {(standardGroups.get("rules")?.length ?? 0) > 0 && (
          <div className="mb-2">
            <CommandPaletteSectionHeader
              icon={CATEGORY_CONFIG.rules.icon}
              categoryId="rules"
            >
              {CATEGORY_CONFIG.rules.name} ({standardGroups.get("rules")!.length})
            </CommandPaletteSectionHeader>

            {standardGroups.get("rules")!.map(({ result, index }) => {
              const ruleData = result.item.data as RuleSearchData;
              const ruleId = ruleData.rule.id;
              const availableRule = availableRules.find((r) => r.id === ruleId);
              const ruleConfig = ruleConfigs?.get(ruleId);
              const isUpdating = ruleConfigUpdating?.get(ruleId) ?? false;
              const currentSeverity = ruleConfig?.severity ?? availableRule?.defaultSeverity ?? "error";

              return (
                <div key={result.item.id} data-index={index}>
                  <RuleToggleItem
                    id={ruleId}
                    name={result.item.title}
                    description={result.item.subtitle || ruleData.rule.description}
                    category={ruleData.rule.category}
                    severity={currentSeverity}
                    isSelected={selectedIndex === index}
                    isUpdating={isUpdating}
                    onSeverityChange={(id, severity) => {
                      if (onSetRuleConfig) {
                        // When changing severity via toggle, preserve existing options
                        const existingOptions = ruleConfigs?.get(id)?.options;
                        onSetRuleConfig(id, severity, existingOptions);
                      }
                    }}
                    onClick={(id) => {
                      // Open inspector for rule details
                      if (onOpenInspector) {
                        onOpenInspector("rule", { ruleId: id });
                      }
                    }}
                    onMouseEnter={() => onHover(result.item.id)}
                    issueCount={result.item.issueCount}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* 2. File-grouped issues */}
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
                onOpenInspector={onOpenInspector}
              />
            ))}
          </div>
        ))}

        {/* 3. Captures section (screenshots) */}
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
                onOpenInspector={onOpenInspector}
              />
            ))}
          </div>
        )}

        {/* 4. Vision section (capture actions) */}
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
                onOpenInspector={onOpenInspector}
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
                onOpenInspector={onOpenInspector}
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
  onOpenInspector,
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
  onOpenInspector?: (
    mode: "rule" | "issue" | "element",
    data: { ruleId?: string; issue?: ESLintIssue; elementId?: string; filePath?: string }
  ) => void;
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
      // Rules are now rendered directly in the Rules section using RuleToggleItem
      // This case should not be reached, but return null for safety
      return null;
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
            onOpenInspector={onOpenInspector}
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
 * Individual issue item - click opens inspector with issue details
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
  onOpenInspector,
}: {
  id: string;
  title: string;
  subtitle?: string;
  issue: IssueSearchData;
  isSelected: boolean;
  isPinned: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onOpenInspector?: (
    mode: "rule" | "issue" | "element",
    data: { ruleId?: string; issue?: ESLintIssue; elementId?: string; filePath?: string }
  ) => void;
}) {
  // Build cursor:// URL for opening in Cursor
  const cursorUrl =
    issue.filePath && issue.issue.line
      ? `cursor://file/${issue.filePath}:${issue.issue.line}${issue.issue.column ? `:${issue.issue.column}` : ""}`
      : null;

  const handleClick = useCallback(() => {
    // Open inspector for issue details
    if (onOpenInspector && issue.filePath) {
      onOpenInspector("issue", {
        issue: issue.issue,
        elementId: issue.elementId,
        filePath: issue.filePath,
      });
    }
  }, [onOpenInspector, issue]);

  // Always render compact view - detailed view is now in the inspector sidebar
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
