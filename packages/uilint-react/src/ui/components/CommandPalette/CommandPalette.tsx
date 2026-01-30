/**
 * CommandPalette - Elegant command interface inspired by Spotlight & Raycast
 *
 * Features:
 * - Plugin-based category system for browsable content
 * - Finder-style sidebar for category navigation
 * - Hero search input with glassmorphic styling
 * - Priority-based lazy loading for fast performance
 * - Keyboard navigation between sidebar and results
 *
 * Visual design:
 * - Minimal colors, visual hierarchy through opacity/weight
 * - Glassmorphic container with backdrop blur
 * - Staggered animations with crisp easing
 * - shadcn class conventions
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import { categoryRegistry } from "../../../core/plugin-system/category-registry";
import { useIssues, useCategoryRegistry, useIsMobile } from "../../hooks";
import { BottomSheet } from "../bottom-sheet";
import { SearchInput } from "./SearchInput";
import { MobileCategoryTabs } from "./MobileCategoryTabs";
import { ResultItem } from "./ResultItem";
import { RuleItem } from "./RuleItem";
import { FileHeader } from "./FileHeader";
import { IssuesSummaryCard, TopIssuesPreview } from "./IssuesSummaryCard";
import { AnimatedListItem, AnimatedSection, SelectionIndicator } from "./AnimatedListItem";
import { CategorySidebar } from "./CategorySidebar";
import { PlayIcon, StopIcon, RefreshIcon } from "../../icons";
import { GlassPanel, Kbd, CategoryBadge } from "../primitives";
import { useScrollSelectedIntoView, ScrollSelectedContext } from "./useScrollSelectedIntoView";
import { cn } from "../../../lib/utils";
import type { Issue } from "../../types";
import type { Command, RuleDefinition, CategoryItem } from "../../../core/plugin-system/types";

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
  // Icon background colors based on command type
  const getIconStyle = () => {
    if (command.id.includes("start")) {
      return { bg: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)", icon: <PlayIcon size={14} /> };
    }
    if (command.id.includes("stop")) {
      return { bg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", icon: <StopIcon size={14} /> };
    }
    if (command.id.includes("clear")) {
      return { bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", icon: <RefreshIcon size={14} /> };
    }
    return { bg: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", icon: <span style={{ fontSize: 12 }}>⚡</span> };
  };

  const iconStyle = getIconStyle();

  return (
    <AnimatedListItem index={index}>
      <SelectionIndicator isSelected={isSelected} variant="command" resultIndex={index}>
        <motion.div
          onClick={onClick}
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.99 }}
          style={{
            padding: "10px 16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: iconStyle.bg,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: isSelected
                ? "0 4px 12px rgba(59, 130, 246, 0.3)"
                : "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            {iconStyle.icon}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 500,
                fontSize: 13,
                color: "var(--uilint-text-primary)",
                marginBottom: 1,
              }}
            >
              {command.title}
            </div>
            {command.subtitle && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--uilint-text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {command.subtitle}
              </div>
            )}
          </div>

          {/* Category badge */}
          <CategoryBadge isSelected={isSelected} disableAnimation>
            {command.category}
          </CategoryBadge>

          {/* Keyboard hint when selected */}
          {isSelected && (
            <motion.div
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <Kbd>↵</Kbd>
            </motion.div>
          )}
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
  return (
    <AnimatedListItem index={index}>
      <SelectionIndicator isSelected={isSelected} variant="issue" resultIndex={index}>
        <motion.div
          onClick={onClick}
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.99 }}
          style={{
            padding: "10px 16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Icon if present */}
          {item.icon && (
            <div
              style={{
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "var(--uilint-text-muted)",
              }}
            >
              {item.icon}
            </div>
          )}

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 500,
                fontSize: 13,
                color: "var(--uilint-text-primary)",
                marginBottom: 1,
              }}
            >
              {item.title}
            </div>
            {item.subtitle && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--uilint-text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.subtitle}
              </div>
            )}
          </div>

          {/* Shortcut hint */}
          {item.shortcut && (
            <Kbd animate={false}>{item.shortcut}</Kbd>
          )}

          {/* Enter hint when selected */}
          {isSelected && !item.shortcut && (
            <motion.div
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <Kbd>↵</Kbd>
            </motion.div>
          )}
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
  const selectedCategoryId = useComposedStore((s) => s.commandPalette.selectedCategoryId);
  const sidebarFocused = useComposedStore((s) => s.commandPalette.sidebarFocused);
  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const setSelectedCategory = useComposedStore((s) => s.setSelectedCategory);
  const setSidebarFocused = useComposedStore((s) => s.setSidebarFocused);
  const openInspector = useComposedStore((s) => s.openInspector);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollCtx = useScrollSelectedIntoView(selectedIndex);

  const { allIssues } = useIssues();
  const { categoryTree, loadItems, getCachedItems, searchItems } = useCategoryRegistry();
  const { isMobile, isSmallScreen } = useIsMobile();

  // Get current state for command availability checks
  const storeState = useComposedStore((s) => s);

  // Load category items when category changes
  useEffect(() => {
    if (selectedCategoryId && isOpen) {
      loadItems(selectedCategoryId);
    }
  }, [selectedCategoryId, isOpen, loadItems]);

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
    if (!query.trim()) return availableCommands;
    const lowerQuery = query.toLowerCase();
    return availableCommands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(lowerQuery) ||
        cmd.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery)) ||
        cmd.category.toLowerCase().includes(lowerQuery) ||
        (cmd.subtitle && cmd.subtitle.toLowerCase().includes(lowerQuery))
    );
  }, [availableCommands, query]);

  // PERFORMANCE: Only show issues when searching or when category is issues-related
  const isSearching = query.trim().length > 0;

  // Get category items when a category is selected
  const categoryItems = useMemo(() => {
    if (!selectedCategoryId) return [];
    return getCachedItems(selectedCategoryId);
  }, [selectedCategoryId, getCachedItems]);

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
      console.error("[CommandPalette] Plugin services not available");
      return;
    }
    try {
      await command.execute(services);
    } catch (error) {
      console.error(`[CommandPalette] Error executing command "${command.id}":`, error);
    }
  }, []);

  // Handle executing a category item
  const handleExecuteCategoryItem = useCallback(async (item: CategoryItem) => {
    if (!item.execute) return;

    const services = getPluginServices();
    if (!services) {
      console.error("[CommandPalette] Plugin services not available");
      return;
    }
    try {
      await item.execute(services);
      closeCommandPalette();
    } catch (error) {
      console.error(`[CommandPalette] Error executing category item "${item.id}":`, error);
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

      // Up/Down for navigation
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && allResults[selectedIndex]) {
        e.preventDefault();
        handleSelectResult(allResults[selectedIndex]);
      }
    },
    [allResults, selectedIndex, handleSelectResult, sidebarFocused, setSidebarFocused]
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Reset query and category when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

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
            background: "rgba(0, 0, 0, 0.35)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: isMobile ? 20 : 80,
            zIndex: 99998,
            pointerEvents: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCommandPalette();
          }}
          onKeyDown={handleKeyDown}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={panelTransition}
          >
            <GlassPanel
              blur="heavy"
              shadow="lg"
              animate={false}
              style={{
                width: "100%",
                maxWidth: isMobile ? "100%" : 680,
                borderRadius: isMobile ? 0 : 16,
                overflow: "hidden",
              }}
            >
              {/* Hero Search Input */}
              <SearchInput value={query} onChange={setQuery} size="large" />

              {/* Content Area: Sidebar + Results */}
              <div
                style={{
                  display: "flex",
                  flexDirection: isSmallScreen ? "column" : "row",
                  maxHeight: 420,
                }}
              >
                {/* Category Sidebar - hidden on small screens */}
                {!isSmallScreen && (
                  <CategorySidebar
                    categories={categoryTree}
                    selectedId={selectedCategoryId}
                    onSelect={setSelectedCategory}
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
                  }}
                >
                  <AnimatePresence mode="wait">
                    {allResults.length === 0 && filteredRules.length === 0 ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.1 }}
                        style={{
                          padding: "32px 24px",
                          textAlign: "center",
                          color: "var(--uilint-text-disabled)",
                        }}
                      >
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {query ? "No results found" : "Start typing to search"}
                        </div>
                        <div style={{ fontSize: 12, marginTop: 4, color: "var(--uilint-text-muted)" }}>
                          {query
                            ? "Try different keywords"
                            : "Search issues, rules, and commands"}
                        </div>
                      </motion.div>
                    ) : (
                      <ScrollSelectedContext.Provider value={scrollCtx}>
                        <motion.div
                          key="results"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.1 }}
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

              {/* Footer with keyboard hints - hidden on mobile */}
              {!isMobile && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.1, delay: 0.05 }}
                  style={{
                    padding: "8px 16px",
                    borderTop: "1px solid var(--uilint-border)",
                    fontSize: 11,
                    color: "var(--uilint-text-disabled)",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    background: "var(--uilint-surface-elevated)",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Kbd animate={false}>↑</Kbd>
                    <Kbd animate={false}>↓</Kbd>
                    <span style={{ marginLeft: 2 }}>navigate</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Kbd animate={false}>←</Kbd>
                    <Kbd animate={false}>→</Kbd>
                    <span style={{ marginLeft: 2 }}>sidebar</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Kbd animate={false}>↵</Kbd>
                    <span style={{ marginLeft: 2 }}>select</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Kbd animate={false}>esc</Kbd>
                    <span style={{ marginLeft: 2 }}>close</span>
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--uilint-text-muted)" }}>
                    ⌘K to toggle
                  </span>
                </motion.div>
              )}
            </GlassPanel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalRoot
  );
}
