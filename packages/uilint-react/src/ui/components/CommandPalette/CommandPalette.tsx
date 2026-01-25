/**
 * CommandPalette - Main search interface
 *
 * Shows commands, rules, and issues with commands prioritized at the top.
 * Features glass morphism styling and smooth animations.
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
import { CloseIcon, PlayIcon, StopIcon, RefreshIcon } from "../../icons";
import type { Issue } from "../../types";
import type { Command, RuleDefinition } from "../../../core/plugin-system/types";

/**
 * Unified result item type for the command palette
 */
type ResultType =
  | { kind: "command"; command: Command }
  | { kind: "issue"; issue: Issue };

/**
 * Command result item component
 */
function CommandResultItem({
  command,
  isSelected,
  onClick,
}: {
  command: Command;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 16px",
        cursor: "pointer",
        background: isSelected ? "#f3f4f6" : "transparent",
        borderBottom: "1px solid #f3f4f6",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: "#3b82f6",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {command.id.includes("start") ? (
          <PlayIcon size={16} />
        ) : command.id.includes("stop") ? (
          <StopIcon size={16} />
        ) : command.id.includes("clear") ? (
          <RefreshIcon size={16} />
        ) : (
          <span style={{ fontSize: 14 }}>⚡</span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            color: "#111827",
            marginBottom: 2,
          }}
        >
          {command.title}
        </div>
        {command.subtitle && (
          <div
            style={{
              fontSize: 12,
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
          fontSize: 10,
          fontWeight: 500,
          textTransform: "uppercase",
          background: "#dbeafe",
          color: "#1d4ed8",
          padding: "2px 6px",
          borderRadius: 4,
        }}
      >
        {command.category}
      </span>
    </div>
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

    // Filter to only available commands
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

  // Filter issues by query
  const filteredIssues = useMemo(() => {
    if (!query.trim()) return allIssues.slice(0, 50);

    const lowerQuery = query.toLowerCase();
    return allIssues
      .filter(
        (issue) =>
          issue.message.toLowerCase().includes(lowerQuery) ||
          issue.ruleId.toLowerCase().includes(lowerQuery) ||
          issue.filePath.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 50);
  }, [allIssues, query]);

  // Get all rules from the registry
  const allRules = useMemo(() => {
    return pluginRegistry.getAllRules();
  }, []);

  // Filter rules by query
  const filteredRules = useMemo(() => {
    if (!query.trim()) return allRules;

    const lowerQuery = query.toLowerCase();
    return allRules.filter(
      (rule) =>
        rule.name.toLowerCase().includes(lowerQuery) ||
        rule.id.toLowerCase().includes(lowerQuery) ||
        rule.description.toLowerCase().includes(lowerQuery) ||
        rule.category.toLowerCase().includes(lowerQuery)
    );
  }, [allRules, query]);

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

  // Combined results: commands first, then issues (rules are handled separately)
  const allResults: ResultType[] = useMemo(() => {
    const commands: ResultType[] = filteredCommands.map((command) => ({
      kind: "command" as const,
      command,
    }));
    const issues: ResultType[] = filteredIssues.map((issue) => ({
      kind: "issue" as const,
      issue,
    }));
    return [...commands, ...issues];
  }, [filteredCommands, filteredIssues]);

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
  const handleExecuteCommand = useCallback(
    async (command: Command) => {
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
    },
    []
  );

  // Handle selecting any result
  const handleSelectResult = useCallback(
    (result: ResultType) => {
      if (result.kind === "command") {
        handleExecuteCommand(result.command);
      } else {
        handleSelectIssue(result.issue);
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

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 100,
            zIndex: 99998,
            pointerEvents: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCommandPalette();
          }}
          onKeyDown={handleKeyDown}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -5 }}
            transition={{
              duration: 0.2,
              ease: [0.32, 0.72, 0, 1],
            }}
            style={{
              width: "100%",
              maxWidth: 640,
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              borderRadius: 16,
              boxShadow:
                "0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.2) inset",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(255,255,255,0.5)",
              }}
            >
              <span style={{ fontWeight: 600, color: "#111827" }}>
                UILint
                {allIssues.length > 0 && (
                  <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: 8 }}>
                    {allIssues.length} issue{allIssues.length !== 1 ? "s" : ""}
                  </span>
                )}
              </span>
              <button
                onClick={closeCommandPalette}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  padding: 4,
                  color: "#6b7280",
                }}
              >
                <CloseIcon size={20} />
              </button>
            </div>

        {/* Search */}
        <SearchInput value={query} onChange={setQuery} />

        {/* Results */}
        <div
          style={{
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          {allResults.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              {query ? "No results match your search" : "No commands or issues available"}
            </div>
          ) : (
            <>
              {/* Commands section */}
              {filteredCommands.length > 0 && (
                <>
                  <div
                    style={{
                      padding: "8px 16px",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: "#9ca3af",
                      background: "#f9fafb",
                    }}
                  >
                    Commands
                  </div>
                  {filteredCommands.map((command, index) => (
                    <CommandResultItem
                      key={command.id}
                      command={command}
                      isSelected={index === selectedIndex}
                      onClick={() => handleExecuteCommand(command)}
                    />
                  ))}
                </>
              )}

              {/* Issues section - grouped by file */}
              {issuesByFile.length > 0 && (
                <>
                  <div
                    style={{
                      padding: "8px 16px",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: "#9ca3af",
                      background: "#f9fafb",
                    }}
                  >
                    Issues
                  </div>
                  {issuesByFile.map((fileGroup) => {
                    // Calculate the starting index for this file group
                    let startIndex = filteredCommands.length;
                    for (const fg of issuesByFile) {
                      if (fg.filePath === fileGroup.filePath) break;
                      startIndex += fg.issues.length;
                    }

                    return (
                      <React.Fragment key={fileGroup.filePath}>
                        <FileHeader
                          fileName={fileGroup.fileName}
                          directory={fileGroup.directory}
                          count={fileGroup.issues.length}
                        />
                        {fileGroup.issues.map((issue, issueIndex) => (
                          <ResultItem
                            key={issue.id}
                            issue={issue}
                            isSelected={startIndex + issueIndex === selectedIndex}
                            onClick={() => handleSelectIssue(issue)}
                          />
                        ))}
                      </React.Fragment>
                    );
                  })}
                </>
              )}

              {/* Rules section */}
              {filteredRules.length > 0 && (
                <>
                  <div
                    style={{
                      padding: "8px 16px",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: "#9ca3af",
                      background: "#f9fafb",
                    }}
                  >
                    Rules
                  </div>
                  {filteredRules.map((rule, index) => (
                    <RuleItem
                      key={rule.id}
                      rule={rule}
                      issueCount={issueCountByRule.get(rule.id) ?? 0}
                      isSelected={
                        filteredCommands.length + filteredIssues.length + index === selectedIndex
                      }
                      onSeverityChange={handleRuleSeverityChange}
                      onClick={() => handleSelectRule(rule)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>

            {/* Footer */}
            <div
              style={{
                padding: "8px 16px",
                borderTop: "1px solid rgba(0,0,0,0.08)",
                fontSize: 12,
                color: "#9ca3af",
                display: "flex",
                gap: 16,
                background: "rgba(255,255,255,0.5)",
              }}
            >
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>Esc Close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalRoot
  );
}
