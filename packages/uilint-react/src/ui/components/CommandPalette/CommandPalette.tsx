/**
 * CommandPalette - Elegant command interface inspired by Spotlight & Raycast
 *
 * Features:
 * - Plugin-based category system for browsable content
 * - Finder-style sidebar for category navigation
 * - Hero search input with glassmorphic styling
 * - Priority-based lazy loading for fast performance
 * - Keyboard navigation between sidebar and results
 * - Tile-based masonry grid for visual item display
 *
 * Visual design:
 * - Minimal colors, visual hierarchy through opacity/weight
 * - Glassmorphic container with backdrop blur
 * - Staggered animations with crisp easing
 * - shadcn class conventions
 */

import React, { useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { devError } from "uilint-core";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import { useIssues, useCategoryRegistry, useCategoryItems, useTileItems, useTileNavigation } from "../../hooks";
import { SearchInput } from "./SearchInput";
import { MobileCategoryTabs } from "./MobileCategoryTabs";
import { ResultItem } from "./ResultItem";
import { RuleItem } from "./RuleItem";
import { FileHeader } from "./FileHeader";
import { IssuesSummaryCard, TopIssuesPreview } from "./IssuesSummaryCard";
import { AnimatedListItem, AnimatedSection, SelectionIndicator } from "./AnimatedListItem";
import { CategorySidebar } from "./CategorySidebar";
import { TileGrid } from "./TileGrid";
import { EmptyState } from "./EmptyState";
import { PlayIcon, StopIcon, RefreshIcon } from "../../icons";
import { GlassPanel, Kbd } from "../primitives";
import { useScrollSelectedIntoView, ScrollSelectedContext } from "./useScrollSelectedIntoView";
import type { Issue } from "../../types";
import type { Command, RuleDefinition, CategoryItem, TileFilter, TileItem } from "../../../core/plugin-system/types";

/**
 * Unified result item type for the command palette
 */
type ResultType =
  | { kind: "command"; command: Command }
  | { kind: "issue"; issue: Issue }
  | { kind: "rule"; rule: RuleDefinition }
  | { kind: "category-item"; item: CategoryItem }
  | { kind: "summary" };

// Crisp easing for panel motion
const panelTransition = {
  duration: 0.12,
  ease: [0.32, 0.72, 0, 1] as const,
};

/**
 * Command result item component with refined design
 */
function CommandResultItem({
  command,
  isSelected,
  onClick,
  index,
}: {
  command: Command;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}) {
  const isMobile = useComposedStore((s) => s.mobile.isMobile);

  // Only show icons for action commands (start, stop, clear)
  const getIconStyle = () => {
    if (command.id.includes("start")) {
      return { bg: "#22c55e", icon: <PlayIcon size={14} /> };
    }
    if (command.id.includes("stop")) {
      return { bg: "#ef4444", icon: <StopIcon size={14} /> };
    }
    if (command.id.includes("clear")) {
      return { bg: "#f59e0b", icon: <RefreshIcon size={14} /> };
    }
    return null; // No icon for other commands
  };

  const iconStyle = getIconStyle();

  const content = (
    <div
      onClick={onClick}
      style={{
        padding: isMobile ? "14px 16px" : "10px 16px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Icon - only for action commands */}
      {iconStyle && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: iconStyle.bg,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {iconStyle.icon}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            fontSize: isMobile ? 16 : 13,
            color: "var(--uilint-text-primary)",
            marginBottom: command.subtitle ? 2 : 0,
          }}
        >
          {command.title}
        </div>
        {command.subtitle && (
          <div
            style={{
              fontSize: isMobile ? 13 : 11,
              color: "var(--uilint-text-muted)",
              lineHeight: 1.3,
            }}
          >
            {command.subtitle}
          </div>
        )}
      </div>

      {/* Keyboard hint when selected - desktop only */}
      {!isMobile && isSelected && (
        <Kbd>↵</Kbd>
      )}
    </div>
  );

  // On mobile, skip motion wrapper
  if (isMobile) {
    return (
      <AnimatedListItem index={index}>
        <SelectionIndicator isSelected={isSelected} variant="command" resultIndex={index}>
          {content}
        </SelectionIndicator>
      </AnimatedListItem>
    );
  }

  return (
    <AnimatedListItem index={index}>
      <SelectionIndicator isSelected={isSelected} variant="command" resultIndex={index}>
        <motion.div
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.99 }}
        >
          {content}
        </motion.div>
      </SelectionIndicator>
    </AnimatedListItem>
  );
}

/**
 * Category item result component
 */
function CategoryItemResult({
  item,
  isSelected,
  onClick,
  index,
}: {
  item: CategoryItem;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}) {
  const isMobile = useComposedStore((s) => s.mobile.isMobile);

  const content = (
    <div
      onClick={onClick}
      style={{
        padding: isMobile ? "14px 16px" : "10px 16px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            fontSize: isMobile ? 16 : 13,
            color: "var(--uilint-text-primary)",
            marginBottom: item.subtitle ? 2 : 0,
          }}
        >
          {item.title}
        </div>
        {item.subtitle && (
          <div
            style={{
              fontSize: isMobile ? 13 : 11,
              color: "var(--uilint-text-muted)",
              lineHeight: 1.3,
            }}
          >
            {item.subtitle}
          </div>
        )}
      </div>

      {/* Keyboard hints - desktop only */}
      {!isMobile && item.shortcut && (
        <Kbd animate={false}>{item.shortcut}</Kbd>
      )}
      {!isMobile && isSelected && !item.shortcut && (
        <Kbd>↵</Kbd>
      )}
    </div>
  );

  // On mobile, skip motion wrapper
  if (isMobile) {
    return (
      <AnimatedListItem index={index}>
        <SelectionIndicator isSelected={isSelected} variant="issue" resultIndex={index}>
          {content}
        </SelectionIndicator>
      </AnimatedListItem>
    );
  }

  return (
    <AnimatedListItem index={index}>
      <SelectionIndicator isSelected={isSelected} variant="issue" resultIndex={index}>
        <motion.div
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.99 }}
        >
          {content}
        </motion.div>
      </SelectionIndicator>
    </AnimatedListItem>
  );
}

/**
 * Section header with refined styling
 */
function SectionHeader({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <AnimatedSection delay={0.02}>
      <div
        style={{
          padding: "10px 16px 6px",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--uilint-text-disabled)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>{children}</span>
        {count !== undefined && count > 0 && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 500,
              background: "var(--uilint-surface-elevated)",
              padding: "2px 6px",
              borderRadius: 10,
            }}
          >
            {count}
          </span>
        )}
      </div>
    </AnimatedSection>
  );
}

export function CommandPalette() {
  const isOpen = useComposedStore((s) => s.commandPalette.open);
  const query = useComposedStore((s) => s.commandPalette.query);
  const selectedIndex = useComposedStore((s) => s.commandPalette.selectedIndex);
  const selectedCategoryId = useComposedStore((s) => s.commandPalette.selectedCategoryId);
  const sidebarFocused = useComposedStore((s) => s.commandPalette.sidebarFocused);
  const filters = useComposedStore((s) => s.commandPalette.filters);
  const selectedCategoryIds = useComposedStore((s) => s.commandPalette.selectedCategoryIds);
  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const setQuery = useComposedStore((s) => s.setCommandPaletteQuery);
  const setSelectedIndex = useComposedStore((s) => s.setCommandPaletteSelectedIndex);
  const setSelectedCategory = useComposedStore((s) => s.setSelectedCategory);
  const setSidebarFocused = useComposedStore((s) => s.setSidebarFocused);
  const openInspector = useComposedStore((s) => s.openInspector);
  const addFilter = useComposedStore((s) => s.addFilter);
  const removeFilter = useComposedStore((s) => s.removeFilter);
  const removeLastFilter = useComposedStore((s) => s.removeLastFilter);
  const clearFilters = useComposedStore((s) => s.clearFilters);
  const toggleCategory = useComposedStore((s) => s.toggleCategory);
  const refreshTileItems = useComposedStore((s) => s.refreshTileItems);

  // Refresh tile items when filters or categories change
  useEffect(() => {
    if (isOpen) {
      refreshTileItems();
    }
  }, [isOpen, filters, selectedCategoryIds, refreshTileItems]);

  // Mobile detection from store
  const isMobile = useComposedStore((s) => s.mobile.isMobile);
  const isSmallScreen = useComposedStore((s) => s.mobile.isSmallScreen);
  const isTablet = useComposedStore((s) => s.mobile.isTablet);

  // Calculate responsive column count for tile grid
  const columnCount = useMemo(() => {
    if (isMobile) return 1;
    if (isTablet) return 2;
    return 3;
  }, [isMobile, isTablet]);

  // Use tile items hook for masonry grid
  const { items: tileItems, isLoading: isTileLoading, isTerminal } = useTileItems(
    filters,
    query,
    selectedCategoryIds
  );

  // Handle tile click
  const handleTileClick = useCallback((item: TileItem) => {
    // Find the category provider that owns this item
    const providerId = item.metadata?.providerId as string | undefined;
    const provider = providerId
      ? pluginRegistry.getAllCategoryProviders().find((p) => p.id === providerId)
      : null;

    if (isTerminal) {
      // Terminal state: open inspector with item data
      if (provider?.getInspectorData) {
        const { panelId, data } = provider.getInspectorData(item);
        openInspector(panelId, data);
      } else {
        // Fallback: open generic inspector
        openInspector("tile", { item });
      }
      closeCommandPalette();
    } else {
      // Non-terminal: create and add filter
      if (provider?.createFilter) {
        const filter = provider.createFilter(item);
        addFilter(filter);
      } else {
        // Fallback: create a generic filter
        addFilter({
          type: "category",
          id: item.id,
          label: item.label,
          providerId: providerId,
        });
      }
    }
  }, [isTerminal, openInspector, closeCommandPalette, addFilter]);

  // Handle back navigation (backspace with empty query)
  const handleBack = useCallback(() => {
    removeLastFilter();
  }, [removeLastFilter]);

  // Use tile navigation hook for keyboard navigation
  const {
    selectedIndex: tileSelectedIndex,
    setSelectedIndex: setTileSelectedIndex,
    handleKeyDown: handleTileKeyDown,
  } = useTileNavigation(tileItems, columnCount, handleTileClick, handleBack);

  const scrollCtx = useScrollSelectedIntoView(selectedIndex);

  const { allIssues } = useIssues();
  const { categoryTree } = useCategoryRegistry();

  // Get category items reactively using selector (aggregates child items for parent categories)
  const categoryItems = useCategoryItems(selectedCategoryId);

  // Get current state for command availability checks
  const storeState = useComposedStore((s) => s);

  // Note: Category loading is now handled by initializeCategoryAutoLoad subscription
  // which triggers when selectedCategoryId changes in the store

  // Get available commands from registry
  const availableCommands = useMemo(() => {
    const allCommands = pluginRegistry.getAllCommands();
    return allCommands.filter((cmd) => {
      if (!cmd.isAvailable) return true;
      return cmd.isAvailable(storeState);
    });
  }, [storeState]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    // When searching, include all commands (even hidden ones can be found via search)
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      return availableCommands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(lowerQuery) ||
          cmd.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery)) ||
          cmd.category.toLowerCase().includes(lowerQuery) ||
          (cmd.subtitle && cmd.subtitle.toLowerCase().includes(lowerQuery))
      );
    }
    // When not searching, filter out commands hidden from "All" category
    // These commands are accessible via their category in the sidebar
    return availableCommands.filter((cmd) => !cmd.hideFromAllCategory);
  }, [availableCommands, query]);

  // PERFORMANCE: Only show issues when searching or when category is issues-related
  const isSearching = query.trim().length > 0;

  // Filter issues by query - only compute when searching
  const filteredIssues = useMemo(() => {
    if (!isSearching) return [];
    const lowerQuery = query.toLowerCase();
    return allIssues
      .filter(
        (issue) =>
          issue.message.toLowerCase().includes(lowerQuery) ||
          issue.ruleId.toLowerCase().includes(lowerQuery) ||
          issue.filePath.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 30); // Reduced limit for better performance
  }, [allIssues, query, isSearching]);

  // Get all rules from the registry - reactive to plugin state changes
  const pluginState = useComposedStore((s) => s.plugins);
  const allRules = useMemo(() => {
    return pluginRegistry.getAllRules();
  }, [pluginState]);

  // Filter rules by query - only show when searching
  const filteredRules = useMemo(() => {
    if (!isSearching) return [];
    const lowerQuery = query.toLowerCase();
    return allRules.filter(
      (rule) =>
        rule.name.toLowerCase().includes(lowerQuery) ||
        rule.id.toLowerCase().includes(lowerQuery) ||
        rule.description.toLowerCase().includes(lowerQuery) ||
        rule.category.toLowerCase().includes(lowerQuery)
    );
  }, [allRules, query, isSearching]);

  // Count issues per rule
  const issueCountByRule = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of allIssues) {
      const count = counts.get(issue.ruleId) || 0;
      counts.set(issue.ruleId, count + 1);
    }
    return counts;
  }, [allIssues]);

  // Group issues by file for better organization
  const issuesByFile = useMemo(() => {
    const groups: Array<{
      filePath: string;
      fileName: string;
      directory: string;
      issues: Issue[];
    }> = [];

    const fileMap = new Map<string, Issue[]>();
    for (const issue of filteredIssues) {
      const existing = fileMap.get(issue.filePath) || [];
      fileMap.set(issue.filePath, [...existing, issue]);
    }

    for (const [filePath, issues] of fileMap) {
      const parts = filePath.split("/");
      const fileName = parts.pop() || filePath;
      const directory = parts.join("/");
      groups.push({ filePath, fileName, directory, issues });
    }

    return groups;
  }, [filteredIssues]);

  // Combined results for keyboard navigation
  const allResults: ResultType[] = useMemo(() => {
    // When a specific category is selected, show category items
    if (selectedCategoryId && !isSearching) {
      return categoryItems.map((item) => ({
        kind: "category-item" as const,
        item,
      }));
    }

    const commands: ResultType[] = filteredCommands.map((command) => ({
      kind: "command" as const,
      command,
    }));

    if (!isSearching && allIssues.length > 0) {
      // Initial state: add summary card and top issues
      const topIssues = allIssues
        .filter((i) => i.severity === "error" || i.severity === "warning")
        .slice(0, 3);

      return [
        ...commands,
        { kind: "summary" as const },
        ...topIssues.map((issue) => ({ kind: "issue" as const, issue })),
      ];
    }

    // When searching: commands + filtered issues + filtered rules
    const issues: ResultType[] = filteredIssues.map((issue) => ({
      kind: "issue" as const,
      issue,
    }));
    const rules: ResultType[] = filteredRules.map((rule) => ({
      kind: "rule" as const,
      rule,
    }));
    return [...commands, ...issues, ...rules];
  }, [filteredCommands, filteredIssues, filteredRules, allIssues, isSearching, selectedCategoryId, categoryItems]);

  // Handle selecting an issue
  const handleSelectIssue = useCallback(
    (issue: Issue) => {
      openInspector("issue", { issue });
      closeCommandPalette();
    },
    [openInspector, closeCommandPalette]
  );

  // Handle executing a command
  const handleExecuteCommand = useCallback(async (command: Command) => {
    const services = getPluginServices();
    if (!services) {
      devError("[CommandPalette] Plugin services not available");
      return;
    }
    try {
      await command.execute(services);
    } catch (error) {
      devError(`[CommandPalette] Error executing command "${command.id}":`, error);
    }
  }, []);

  // Handle executing a category item
  const handleExecuteCategoryItem = useCallback(async (item: CategoryItem) => {
    if (!item.execute) return;

    const services = getPluginServices();
    if (!services) {
      devError("[CommandPalette] Plugin services not available");
      return;
    }
    try {
      await item.execute(services);
      closeCommandPalette();
    } catch (error) {
      devError(`[CommandPalette] Error executing category item "${item.id}":`, error);
    }
  }, [closeCommandPalette]);

  // Handle rule severity change
  const handleRuleSeverityChange = useCallback(
    (ruleId: string, severity: "error" | "warning" | "off") => {
      pluginRegistry.setRuleSeverity(ruleId, severity);
    },
    []
  );

  // Handle selecting a rule to view details
  const handleSelectRule = useCallback(
    (rule: RuleDefinition) => {
      const panelId = `${rule.pluginId}-rule`;
      openInspector(panelId, { ruleId: rule.id });
      closeCommandPalette();
    },
    [openInspector, closeCommandPalette]
  );

  // Handle selecting any result
  const handleSelectResult = useCallback(
    (result: ResultType) => {
      if (result.kind === "command") {
        handleExecuteCommand(result.command);
      } else if (result.kind === "issue") {
        handleSelectIssue(result.issue);
      } else if (result.kind === "rule") {
        handleSelectRule(result.rule);
      } else if (result.kind === "category-item") {
        handleExecuteCategoryItem(result.item);
      } else if (result.kind === "summary") {
        // Focus search input to encourage searching
        setQuery("");
      }
    },
    [handleExecuteCommand, handleSelectIssue, handleSelectRule, handleExecuteCategoryItem]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Tab to switch between sidebar and results
      if (e.key === "Tab") {
        e.preventDefault();
        setSidebarFocused(!sidebarFocused);
        return;
      }

      // Left/Right arrows to switch focus (when not in tile grid mode)
      if (e.key === "ArrowLeft" && !sidebarFocused && tileItems.length === 0) {
        e.preventDefault();
        setSidebarFocused(true);
        return;
      }
      if (e.key === "ArrowRight" && sidebarFocused) {
        e.preventDefault();
        setSidebarFocused(false);
        return;
      }

      // When in tile grid mode, delegate to tile navigation
      if (tileItems.length > 0 && !sidebarFocused) {
        handleTileKeyDown(e);
        return;
      }

      // Backspace to remove last filter when query is empty
      if (e.key === "Backspace" && query === "" && filters.length > 0) {
        e.preventDefault();
        handleBack();
        return;
      }

      // Up/Down for list navigation (fallback when no tiles)
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(Math.min(selectedIndex + 1, allResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(Math.max(selectedIndex - 1, 0));
      } else if (e.key === "Enter" && allResults[selectedIndex]) {
        e.preventDefault();
        handleSelectResult(allResults[selectedIndex]);
      }
    },
    [allResults, selectedIndex, handleSelectResult, sidebarFocused, setSidebarFocused, tileItems, handleTileKeyDown, query, filters, handleBack]
  );

  // Note: Reset on query change is handled by setCommandPaletteQuery action (resets selectedIndex to 0)
  // Note: Reset on close is handled by closeCommandPalette action (resets all command palette state)

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  // Calculate index for summary card and top issues
  const summaryIndex = filteredCommands.length;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          style={{
            position: "fixed",
            inset: 0,
            background: isMobile ? "var(--uilint-surface)" : "rgba(0, 0, 0, 0.35)",
            backdropFilter: isMobile ? "none" : "blur(8px)",
            WebkitBackdropFilter: isMobile ? "none" : "blur(8px)",
            display: "flex",
            alignItems: isMobile ? "stretch" : "flex-start",
            justifyContent: "center",
            paddingTop: isMobile ? 0 : 80,
            zIndex: 99998,
            pointerEvents: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCommandPalette();
          }}
          onKeyDown={handleKeyDown}
        >
          <motion.div
            initial={isMobile ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -20 }}
            animate={isMobile ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobile ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -10 }}
            transition={isMobile ? { duration: 0.15 } : panelTransition}
            style={isMobile ? { display: "flex", flexDirection: "column", width: "100%", height: "100%" } : undefined}
          >
            <GlassPanel
              blur={isMobile ? "light" : "heavy"}
              shadow={isMobile ? undefined : "lg"}
              animate={false}
              style={{
                width: isMobile ? "100%" : 560,
                height: isMobile ? "100%" : "auto",
                borderRadius: isMobile ? 0 : 16,
                overflow: "hidden",
                display: isMobile ? "flex" : "block",
                flexDirection: isMobile ? "column" : undefined,
                paddingTop: isMobile ? "env(safe-area-inset-top, 0px)" : undefined,
                paddingBottom: isMobile ? "env(safe-area-inset-bottom, 0px)" : undefined,
              }}
            >
              {/* Mobile Header with Close Button */}
              {isMobile && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px 8px",
                    borderBottom: "1px solid var(--uilint-border)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--uilint-text-primary)",
                    }}
                  >
                    Search
                  </span>
                  <button
                    onClick={closeCommandPalette}
                    style={{
                      padding: "8px 16px",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--uilint-accent)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      borderRadius: 8,
                    }}
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Hero Search Input */}
              <SearchInput
                value={query}
                onChange={setQuery}
                size={isMobile ? "default" : "large"}
                filters={filters}
                onRemoveFilter={(index) => removeFilter(index)}
                onRemoveLastFilter={removeLastFilter}
              />

              {/* Content Area: Sidebar + Results */}
              <div
                style={{
                  display: "flex",
                  flexDirection: isSmallScreen ? "column" : "row",
                  maxHeight: isMobile ? "none" : 420,
                  flex: isMobile ? 1 : undefined,
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                {/* Category Sidebar - hidden on small screens */}
                {!isSmallScreen && (
                  <CategorySidebar
                    categories={categoryTree}
                    selectedId={selectedCategoryId}
                    onSelect={setSelectedCategory}
                    selectedCategoryIds={selectedCategoryIds}
                    onToggleCategory={toggleCategory}
                    isFocused={sidebarFocused}
                  />
                )}

                {/* Mobile Category Tabs - shown on small screens */}
                {isSmallScreen && (
                  <MobileCategoryTabs
                    categories={categoryTree}
                    selectedId={selectedCategoryId}
                    onSelect={setSelectedCategory}
                  />
                )}

                {/* Results Pane */}
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    overflowX: "hidden",
                    minHeight: 0,
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <AnimatePresence mode={isMobile ? "sync" : "wait"}>
                    {/* Loading state */}
                    {isTileLoading ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{
                          padding: "48px 24px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            border: "2px solid var(--uilint-border)",
                            borderTopColor: "var(--uilint-accent)",
                          }}
                        />
                        <div
                          style={{
                            marginTop: 12,
                            fontSize: 13,
                            color: "var(--uilint-text-muted)",
                          }}
                        >
                          Loading...
                        </div>
                      </motion.div>
                    ) : tileItems.length > 0 ? (
                      /* Tile Grid View */
                      <motion.div
                        key="tile-grid"
                        initial={isMobile ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={isMobile ? undefined : { opacity: 0 }}
                        transition={{ duration: isMobile ? 0 : 0.1 }}
                      >
                        <TileGrid
                          items={tileItems}
                          onTileClick={handleTileClick}
                          selectedIndex={tileSelectedIndex}
                          isTerminal={isTerminal}
                        />
                      </motion.div>
                    ) : tileItems.length === 0 && filters.length > 0 && allResults.length === 0 && filteredRules.length === 0 ? (
                      /* Empty state for filtered tile view - only when no list results either */
                      <motion.div
                        key="empty-state"
                        initial={isMobile ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={isMobile ? { opacity: 0 } : { opacity: 0, y: -4 }}
                        transition={{ duration: isMobile ? 0.05 : 0.1 }}
                      >
                        <EmptyState variant="filtered-empty" onClearFilters={clearFilters} />
                      </motion.div>
                    ) : allResults.length === 0 && filteredRules.length === 0 ? (
                      /* Fallback empty state for list view */
                      <motion.div
                        key="empty"
                        initial={isMobile ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={isMobile ? { opacity: 0 } : { opacity: 0, y: -4 }}
                        transition={{ duration: isMobile ? 0.05 : 0.1 }}
                      >
                        <EmptyState variant="no-issues" />
                      </motion.div>
                    ) : (
                      /* Fallback: List-based results (commands, issues, rules) */
                      <ScrollSelectedContext.Provider value={scrollCtx}>
                        <motion.div
                          key="results"
                          initial={isMobile ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={isMobile ? undefined : { opacity: 0 }}
                          transition={{ duration: isMobile ? 0 : 0.1 }}
                        >
                          {/* Category items when a specific category is selected */}
                          {selectedCategoryId && !isSearching && categoryItems.length > 0 && (
                            <>
                              {categoryItems.map((item, index) => (
                                <CategoryItemResult
                                  key={item.id}
                                  item={item}
                                  isSelected={index === selectedIndex}
                                  onClick={() => handleExecuteCategoryItem(item)}
                                  index={index}
                                />
                              ))}
                            </>
                          )}

                          {/* Commands section - show when "All" is selected or searching */}
                          {(!selectedCategoryId || isSearching) && filteredCommands.length > 0 && (
                            <>
                              <SectionHeader count={filteredCommands.length}>
                                Commands
                              </SectionHeader>
                              {filteredCommands.map((command, index) => (
                                <CommandResultItem
                                  key={command.id}
                                  command={command}
                                  isSelected={index === selectedIndex}
                                  onClick={() => handleExecuteCommand(command)}
                                  index={index}
                                />
                              ))}
                            </>
                          )}

                          {/* Initial state: Summary card + Top issues */}
                          {!isSearching && !selectedCategoryId && allIssues.length > 0 && (
                            <>
                              <SectionHeader>Overview</SectionHeader>
                              <IssuesSummaryCard
                                issues={allIssues}
                                isSelected={summaryIndex === selectedIndex}
                                resultIndex={summaryIndex}
                                onClick={() => {
                                  // Focus on the search input
                                }}
                              />
                              <TopIssuesPreview
                                issues={allIssues}
                                onSelectIssue={handleSelectIssue}
                                startIndex={summaryIndex + 1}
                                selectedIndex={selectedIndex}
                              />
                            </>
                          )}

                          {/* Search results: Issues grouped by file */}
                          {isSearching && issuesByFile.length > 0 && (
                            <>
                              <SectionHeader count={filteredIssues.length}>
                                Issues
                              </SectionHeader>
                              {issuesByFile.map((fileGroup, groupIndex) => {
                                let startIndex = filteredCommands.length;
                                for (let i = 0; i < groupIndex; i++) {
                                  startIndex += issuesByFile[i].issues.length;
                                }

                                return (
                                  <AnimatedListItem
                                    key={fileGroup.filePath}
                                    index={filteredCommands.length + groupIndex}
                                  >
                                    <FileHeader
                                      fileName={fileGroup.fileName}
                                      directory={fileGroup.directory}
                                      count={fileGroup.issues.length}
                                    />
                                    {fileGroup.issues.map((issue, issueIndex) => (
                                      <SelectionIndicator
                                        key={issue.id}
                                        isSelected={startIndex + issueIndex === selectedIndex}
                                        variant="issue"
                                        resultIndex={startIndex + issueIndex}
                                      >
                                        <ResultItem
                                          issue={issue}
                                          isSelected={startIndex + issueIndex === selectedIndex}
                                          onClick={() => handleSelectIssue(issue)}
                                        />
                                      </SelectionIndicator>
                                    ))}
                                  </AnimatedListItem>
                                );
                              })}
                            </>
                          )}

                          {/* Rules section - only when searching */}
                          {isSearching && filteredRules.length > 0 && (
                            <>
                              <SectionHeader count={filteredRules.length}>
                                Rules
                              </SectionHeader>
                              {filteredRules.map((rule, index) => (
                                <AnimatedListItem
                                  key={rule.id}
                                  index={filteredCommands.length + filteredIssues.length + index}
                                >
                                  <RuleItem
                                    rule={rule}
                                    issueCount={issueCountByRule.get(rule.id) ?? 0}
                                    isSelected={
                                      filteredCommands.length +
                                        filteredIssues.length +
                                        index ===
                                      selectedIndex
                                    }
                                    onSeverityChange={handleRuleSeverityChange}
                                    onClick={() => handleSelectRule(rule)}
                                  />
                                </AnimatedListItem>
                              ))}
                            </>
                          )}
                        </motion.div>
                      </ScrollSelectedContext.Provider>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </GlassPanel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalRoot
  );
}
