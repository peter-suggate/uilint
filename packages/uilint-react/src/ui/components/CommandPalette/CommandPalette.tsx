/**
 * CommandPalette - Elegant command interface inspired by Spotlight & Raycast
 *
 * Performance optimizations:
 * - Shows summary card instead of all issues in initial state
 * - Issues only rendered when searching
 * - Staggered animations with delay caps for long lists
 *
 * Visual polish:
 * - Spring physics for panel entrance
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
import type { Issue } from "../../types";
import type { Command, RuleDefinition } from "../../../core/plugin-system/types";

/**
 * Unified result item type for the command palette
 */
type ResultType =
  | { kind: "command"; command: Command }
  | { kind: "issue"; issue: Issue }
  | { kind: "summary" };

// Spring configuration for natural panel motion
const panelSpring = {
  type: "spring" as const,
  stiffness: 380,
  damping: 32,
  mass: 0.8,
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
          <motion.div
            animate={{ scale: isSelected ? 1.05 : 1 }}
            transition={{ duration: 0.15 }}
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
          </motion.div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 500,
                fontSize: 13,
                color: "#111827",
                marginBottom: 1,
              }}
            >
              {command.title}
            </div>
            {command.subtitle && (
              <div
                style={{
                  fontSize: 11,
                  color: "#6b7280",
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
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              background: isSelected
                ? "rgba(59, 130, 246, 0.15)"
                : "rgba(0, 0, 0, 0.04)",
              color: isSelected ? "#2563eb" : "#6b7280",
              padding: "3px 8px",
              borderRadius: 6,
              transition: "all 0.15s ease",
            }}
          >
            {command.category}
          </span>

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
          color: "#9ca3af",
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
              background: "rgba(0, 0, 0, 0.04)",
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

/**
 * macOS-style keyboard hint
 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 18,
        padding: "0 4px",
        fontSize: 10,
        fontWeight: 500,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        color: "#6b7280",
        background: "linear-gradient(180deg, #ffffff 0%, #f3f4f6 100%)",
        border: "1px solid rgba(0, 0, 0, 0.1)",
        borderRadius: 4,
        boxShadow: "0 1px 0 rgba(0, 0, 0, 0.06)",
      }}
    >
      {children}
    </span>
  );
}

export function CommandPalette() {
  const isOpen = useComposedStore((s) => s.commandPalette.open);
  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const openInspector = useComposedStore((s) => s.openInspector);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  // Get all rules from the registry
  const allRules = useMemo(() => {
    return pluginRegistry.getAllRules();
  }, []);

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

    // When searching: commands + filtered issues
    const issues: ResultType[] = filteredIssues.map((issue) => ({
      kind: "issue" as const,
      issue,
    }));
    return [...commands, ...issues];
  }, [filteredCommands, filteredIssues, allIssues, isSearching]);

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
    [allResults, selectedIndex]
  );

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

  // Handle selecting any result
  const handleSelectResult = useCallback(
    (result: ResultType) => {
      if (result.kind === "command") {
        handleExecuteCommand(result.command);
      } else if (result.kind === "issue") {
        handleSelectIssue(result.issue);
      } else if (result.kind === "summary") {
        // Focus search input to encourage searching
        setQuery("");
      }
    },
    [handleExecuteCommand, handleSelectIssue]
  );

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
      openInspector("eslint-rule", { ruleId: rule.id });
      closeCommandPalette();
    },
    [openInspector, closeCommandPalette]
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
            transition={panelSpring}
            style={{
              width: "100%",
              maxWidth: 580,
              background: "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              borderRadius: 14,
              boxShadow: `
                0 0 0 1px rgba(255, 255, 255, 0.2) inset,
                0 1px 0 0 rgba(255, 255, 255, 0.4) inset,
                0 24px 68px rgba(0, 0, 0, 0.2),
                0 8px 20px rgba(0, 0, 0, 0.12)
              `,
              border: "1px solid rgba(0, 0, 0, 0.08)",
              overflow: "hidden",
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
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      padding: "32px 24px",
                      textAlign: "center",
                      color: "#9ca3af",
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {query ? "No results found" : "Start typing to search"}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4, color: "#d1d5db" }}>
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
                    {!isSearching && allIssues.length > 0 && (
                      <>
                        <SectionHeader>Overview</SectionHeader>
                        <IssuesSummaryCard
                          issues={allIssues}
                          isSelected={summaryIndex === selectedIndex}
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
                )}
              </AnimatePresence>
            </div>

            {/* Footer with keyboard hints */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              style={{
                padding: "8px 16px",
                borderTop: "1px solid rgba(0, 0, 0, 0.05)",
                fontSize: 11,
                color: "#9ca3af",
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: "rgba(249, 250, 251, 0.5)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <span style={{ marginLeft: 2 }}>navigate</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Kbd>↵</Kbd>
                <span style={{ marginLeft: 2 }}>select</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Kbd>esc</Kbd>
                <span style={{ marginLeft: 2 }}>close</span>
              </span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#d1d5db" }}>
                ⌘K to toggle
              </span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalRoot
  );
}
