/**
 * CommandPalette - Main search interface
 *
 * Shows both commands and issues, with commands prioritized at the top.
 */
import React, { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import { useIssues } from "../../hooks";
import { SearchInput } from "./SearchInput";
import { ResultItem } from "./ResultItem";
import { CloseIcon, PlayIcon, StopIcon, RefreshIcon } from "../../icons";
import type { Issue } from "../../types";
import type { Command, PluginServices } from "../../../core/plugin-system/types";

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

  // Combined results: commands first, then issues
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

  // Reset selection when query changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const portalRoot = document.getElementById("uilint-portal") || document.body;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 100,
        zIndex: 99998,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCommandPalette();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          background: "white",
          borderRadius: 12,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
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
            borderBottom: "1px solid #e5e7eb",
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

              {/* Issues section */}
              {filteredIssues.length > 0 && (
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
                  {filteredIssues.map((issue, index) => (
                    <ResultItem
                      key={issue.id}
                      issue={issue}
                      isSelected={filteredCommands.length + index === selectedIndex}
                      onClick={() => handleSelectIssue(issue)}
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
            borderTop: "1px solid #e5e7eb",
            fontSize: 12,
            color: "#9ca3af",
            display: "flex",
            gap: 16,
          }}
        >
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>,
    portalRoot
  );
}
