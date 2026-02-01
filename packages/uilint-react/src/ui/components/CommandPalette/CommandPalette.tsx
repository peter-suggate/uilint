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
import { useComposedStore, getPluginServices, selectFilteredPaletteItems } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import { useIssues, useTileNavigation } from "../../hooks";
import { SearchInput } from "./SearchInput";
import { MobileCategoryTabs } from "./MobileCategoryTabs";
import { ResultItem } from "./ResultItem";
import { RuleItem } from "./RuleItem";
import { FileHeader } from "./FileHeader";
import { IssuesSummaryCard, TopIssuesPreview } from "./IssuesSummaryCard";
import { AnimatedListItem, AnimatedSection, SelectionIndicator } from "./AnimatedListItem";
import { KeywordSidebar } from "./KeywordSidebar";
import { TileGrid } from "./TileGrid";
import { EmptyState } from "./EmptyState";
import { PlayIcon, StopIcon, RefreshIcon } from "../../icons";
import { GlassPanel, Kbd } from "../primitives";
import { useScrollSelectedIntoView, ScrollSelectedContext } from "./useScrollSelectedIntoView";
import type { Issue } from "../../types";
import type { Command, RuleDefinition, CategoryItem, TileFilter, TileItem, PaletteItem } from "../../../core/plugin-system/types";

/**
 * Unified result item type for the command palette
 */
type ResultType =
  | { kind: "command"; command: Command }
  | { kind: "issue"; issue: Issue }
  | { kind: "rule"; rule: RuleDefinition }
  | { kind: "palette-item"; item: PaletteItem }
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
 * Palette item result component
 */
function PaletteItemResult({
  item,
  isSelected,
  onClick,
  index,
}: {
  item: PaletteItem;
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
  const sidebarFocused = useComposedStore((s) => s.commandPalette.sidebarFocused);
  const filters = useComposedStore((s) => s.commandPalette.filters);
  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const setQuery = useComposedStore((s) => s.setCommandPaletteQuery);
  const setSelectedIndex = useComposedStore((s) => s.setCommandPaletteSelectedIndex);
  const setSidebarFocused = useComposedStore((s) => s.setSidebarFocused);
  const openInspector = useComposedStore((s) => s.openInspector);
  const removeFilter = useComposedStore((s) => s.removeFilter);
  const removeLastFilter = useComposedStore((s) => s.removeLastFilter);
  const clearFilters = useComposedStore((s) => s.clearFilters);

  // Keyword system state
  const refreshPaletteItems = useComposedStore((s) => s.refreshPaletteItems);
  const paletteItemsLoading = useComposedStore((s) => s.paletteItemsLoading);

  // Get filtered palette items (by keywords)
  const keywordFilteredItems = useComposedStore(selectFilteredPaletteItems);

  // Apply query filter on top of keyword filter
  const filteredPaletteItems = useMemo(() => {
    if (!query.trim()) return keywordFilteredItems;
    const lowerQuery = query.toLowerCase();
    return keywordFilteredItems.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerQuery) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(lowerQuery)) ||
        item.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery))
    );
  }, [keywordFilteredItems, query]);

  // Refresh palette items when command palette opens
  useEffect(() => {
    if (isOpen) {
      refreshPaletteItems();
    }
  }, [isOpen, refreshPaletteItems]);

  // Mobile detection from store
  const isMobile = useComposedStore((s) => s.mobile.isMobile);
  const isSmallScreen = useComposedStore((s) => s.mobile.isSmallScreen);
  const isTablet = useComposedStore((s) => s.mobile.isTablet);

  const scrollCtx = useScrollSelectedIntoView(selectedIndex);

  const { allIssues } = useIssues();

  // Handle back navigation (backspace with empty query removes last keyword filter)
  const handleBack = useCallback(() => {
    removeLastFilter();
  }, [removeLastFilter]);

  // Combined results for keyboard navigation - now using palette items
  const allResults: ResultType[] = useMemo(() => {
    // Convert palette items to result types
    const paletteResults: ResultType[] = filteredPaletteItems.map((item) => ({
      kind: "palette-item" as const,
      item,
    }));

    // When not searching and there are issues, show summary
    const isSearching = query.trim().length > 0;
    if (!isSearching && allIssues.length > 0) {
      // Find command items (items with "Command" keyword)
      const commandItems = paletteResults.filter(
        (r) => r.kind === "palette-item" && r.item.keywords.includes("Command")
      );
      const nonCommandItems = paletteResults.filter(
        (r) => r.kind === "palette-item" && !r.item.keywords.includes("Command")
      );

      // Top issues for preview
      const topIssues = allIssues
        .filter((i) => i.severity === "error" || i.severity === "warning")
        .slice(0, 3);

      return [
        ...commandItems,
        { kind: "summary" as const },
        ...topIssues.map((issue) => ({ kind: "issue" as const, issue })),
        ...nonCommandItems.slice(0, 10), // Limit non-command items in initial view
      ];
    }

    return paletteResults;
  }, [filteredPaletteItems, allIssues, query]);

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

  // Handle executing a palette item
  const handleExecutePaletteItem = useCallback(async (item: PaletteItem) => {
    if (!item.execute) return;

    const services = getPluginServices();
    if (!services) {
      devError("[CommandPalette] Plugin services not available");
      return;
    }
    try {
      await item.execute(services);
      // Note: closeCommandPalette is typically called within execute for items that need it
    } catch (error) {
      devError(`[CommandPalette] Error executing palette item "${item.id}":`, error);
    }
  }, []);

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
      } else if (result.kind === "palette-item") {
        handleExecutePaletteItem(result.item);
      } else if (result.kind === "summary") {
        // Focus search input to encourage searching
        setQuery("");
      }
    },
    [handleExecuteCommand, handleSelectIssue, handleSelectRule, handleExecutePaletteItem, setQuery]
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

      // Left/Right arrows to switch focus
      if (e.key === "ArrowLeft" && !sidebarFocused) {
        e.preventDefault();
        setSidebarFocused(true);
        return;
      }
      if (e.key === "ArrowRight" && sidebarFocused) {
        e.preventDefault();
        setSidebarFocused(false);
        return;
      }

      // Up/Down for list navigation
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
    [allResults, selectedIndex, handleSelectResult, sidebarFocused, setSidebarFocused, setSelectedIndex]
  );

  // Note: Reset on query change is handled by setCommandPaletteQuery action (resets selectedIndex to 0)
  // Note: Reset on close is handled by closeCommandPalette action (resets all command palette state)

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  // Calculate index for summary card (after command items)
  const summaryIndex = useMemo(() => {
    return filteredPaletteItems.filter((item) => item.keywords.includes("Command")).length;
  }, [filteredPaletteItems]);

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
                width: "100%",
                maxWidth: isMobile ? "100%" : 680,
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
                {/* Keyword Sidebar - hidden on small screens */}
                {!isSmallScreen && (
                  <KeywordSidebar />
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
                    {paletteItemsLoading ? (
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
                    ) : allResults.length === 0 ? (
                      /* Empty state */
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
                      /* Results list */
                      <ScrollSelectedContext.Provider value={scrollCtx}>
                        <motion.div
                          key="results"
                          initial={isMobile ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={isMobile ? undefined : { opacity: 0 }}
                          transition={{ duration: isMobile ? 0 : 0.1 }}
                        >
                          {allResults.map((result, index) => {
                            if (result.kind === "palette-item") {
                              return (
                                <PaletteItemResult
                                  key={result.item.id}
                                  item={result.item}
                                  isSelected={index === selectedIndex}
                                  onClick={() => handleExecutePaletteItem(result.item)}
                                  index={index}
                                />
                              );
                            }

                            if (result.kind === "issue") {
                              return (
                                <AnimatedListItem key={result.issue.id} index={index}>
                                  <SelectionIndicator
                                    isSelected={index === selectedIndex}
                                    variant="issue"
                                    resultIndex={index}
                                  >
                                    <ResultItem
                                      issue={result.issue}
                                      isSelected={index === selectedIndex}
                                      onClick={() => handleSelectIssue(result.issue)}
                                    />
                                  </SelectionIndicator>
                                </AnimatedListItem>
                              );
                            }

                            if (result.kind === "summary") {
                              return (
                                <AnimatedListItem key="summary" index={index}>
                                  <IssuesSummaryCard
                                    issues={allIssues}
                                    isSelected={index === selectedIndex}
                                    resultIndex={index}
                                    onClick={() => setQuery("")}
                                  />
                                </AnimatedListItem>
                              );
                            }

                            return null;
                          })}
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
