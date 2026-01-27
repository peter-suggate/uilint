/**
 * CommandPalette - Elegant command interface inspired by Spotlight & Raycast
 *
 * Performance optimizations:
 * - Shows summary card instead of all issues in initial state
 * - Issues only rendered when searching
 * - Staggered animations with delay caps for long lists
 *
 * Visual polish:
 * - Crisp easing for panel entrance
 * - Staggered list item animations
 * - Glass morphism with subtle gradients
 * - Selection indicator with glow effect
 * - macOS-style keyboard hints
 */
import React, { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import { useIssues } from "../../hooks";
import { SearchInput } from "./SearchInput";
import { ResultItem } from "./ResultItem";
import { RuleItem } from "./RuleItem";
import { FileHeader } from "./FileHeader";
import { IssuesSummaryCard, TopIssuesPreview } from "./IssuesSummaryCard";
import { AnimatedListItem, AnimatedSection, SelectionIndicator } from "./AnimatedListItem";
import { CloseIcon, PlayIcon, StopIcon, RefreshIcon } from "../../icons";
import { GlassPanel, Kbd, CategoryBadge } from "../primitives";
import { useScrollSelectedIntoView } from "./useScrollSelectedIntoView";
import type { Issue } from "../../types";
import type { Command, RuleDefinition } from "../../../core/plugin-system/types";

/**
 * Unified result item type for the command palette
 */
type ResultType =
  | { kind: "command"; command: Command }
  | { kind: "issue"; issue: Issue }
  | { kind: "rule"; rule: RuleDefinition }
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
      <SelectionIndicator isSelected={isSelected} variant="command">
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
  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const openInspector = useComposedStore((s) => s.openInspector);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useScrollSelectedIntoView(selectedIndex);

  const { allIssues } = useIssues();

  // Get current state for command availability checks
  const storeState = useComposedStore((s) => s);

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

  // PERFORMANCE: Only show issues when searching
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
  // We subscribe to plugin state so that when rules metadata arrives
  // asynchronously via WebSocket, this recomputes.
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
  // In initial state: commands + summary card + top issues
  // When searching: commands + issues
  const allResults: ResultType[] = useMemo(() => {
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
  }, [filteredCommands, filteredIssues, filteredRules, allIssues, isSearching]);

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

  // Handle rule severity change
  const handleRuleSeverityChange = useCallback(
    (ruleId: string, severity: "error" | "warning" | "off") => {
      pluginRegistry.setRuleSeverity(ruleId, severity);
    },
    []
  );

  // Handle selecting a rule to view details
  // Uses the rule's pluginId to derive the inspector panel ID generically
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
      } else if (result.kind === "summary") {
        // Focus search input to encourage searching
        setQuery("");
      }
    },
    [handleExecuteCommand, handleSelectIssue, handleSelectRule]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
    [allResults, selectedIndex, handleSelectResult]
  );

  // Reset selection when query changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Reset query when closing
  React.useEffect(() => {
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
            paddingTop: 80,
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
                maxWidth: 580,
                borderRadius: 14,
              }}
            >
            {/* Search */}
            <SearchInput value={query} onChange={setQuery} />

            {/* Results */}
            <div
              style={{
                maxHeight: 380,
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
                  <motion.div
                    key="results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                  >
                    {/* Commands section */}
                    {filteredCommands.length > 0 && (
                      <>
                        <SectionHeader count={filteredCommands.length}>
                          Commands
                        </SectionHeader>
                        {filteredCommands.map((command, index) => (
                          <div
                            key={command.id}
                            ref={(el) => {
                              if (el) itemRefs.current.set(index, el);
                              else itemRefs.current.delete(index);
                            }}
                          >
                            <CommandResultItem
                              command={command}
                              isSelected={index === selectedIndex}
                              onClick={() => handleExecuteCommand(command)}
                              index={index}
                            />
                          </div>
                        ))}
                      </>
                    )}

                    {/* Initial state: Summary card + Top issues */}
                    {!isSearching && allIssues.length > 0 && (
                      <>
                        <SectionHeader>Overview</SectionHeader>
                        <div
                          ref={(el) => {
                            if (el) itemRefs.current.set(summaryIndex, el);
                            else itemRefs.current.delete(summaryIndex);
                          }}
                        >
                          <IssuesSummaryCard
                            issues={allIssues}
                            isSelected={summaryIndex === selectedIndex}
                            onClick={() => {
                              // Focus on the search input
                            }}
                          />
                        </div>
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
                              {fileGroup.issues.map((issue, issueIndex) => {
                                const resultIndex = startIndex + issueIndex;
                                return (
                                  <div
                                    key={issue.id}
                                    ref={(el) => {
                                      if (el) itemRefs.current.set(resultIndex, el);
                                      else itemRefs.current.delete(resultIndex);
                                    }}
                                  >
                                    <SelectionIndicator
                                      isSelected={resultIndex === selectedIndex}
                                      variant="issue"
                                    >
                                      <ResultItem
                                        issue={issue}
                                        isSelected={resultIndex === selectedIndex}
                                        onClick={() => handleSelectIssue(issue)}
                                      />
                                    </SelectionIndicator>
                                  </div>
                                );
                              })}
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
                )}
              </AnimatePresence>
            </div>

            {/* Footer with keyboard hints */}
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
          </GlassPanel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalRoot
  );
}
