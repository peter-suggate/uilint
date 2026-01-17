"use client";

import React, { useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useUILintStore, type UILintStore } from "../store";
import { getUILintPortalHost } from "../portal-host";
import { CommandPaletteInput } from "./CommandPaletteInput";
import { CommandPaletteResults } from "./CommandPaletteResults";
import { DetailView } from "./DetailView";
import {
  useKeyboardNavigation,
  useCommandPaletteShortcut,
} from "./use-keyboard-navigation";
import { useFuzzySearch, buildSearchableItems } from "./use-fuzzy-search";
import type {
  SearchableItem,
  ActionSearchData,
  RuleSearchData,
  IssueSearchData,
} from "./types";
import { DATA_UILINT_ID } from "../types";

/**
 * Build suggested action items based on current state
 */
function buildActionItems(
  wsConnected: boolean,
  liveScanEnabled: boolean
): SearchableItem[] {
  const actions: SearchableItem[] = [];

  // Connection actions
  if (!wsConnected) {
    actions.push({
      type: "action",
      category: "actions",
      id: "action:connect",
      searchText: "connect server start uilint serve",
      title: "Connect to server",
      subtitle: "Run `npx uilint serve` to start",
      data: { type: "action", actionType: "connect" } as ActionSearchData,
    });
  } else {
    // Scan actions (only when connected)
    if (!liveScanEnabled) {
      actions.push({
        type: "action",
        category: "actions",
        id: "action:start-scan",
        searchText: "start scan eslint lint check",
        title: "Start ESLint scan",
        subtitle: "Scan page for code quality issues",
        data: { type: "action", actionType: "start-scan" } as ActionSearchData,
      });
    } else {
      actions.push({
        type: "action",
        category: "actions",
        id: "action:stop-scan",
        searchText: "stop scan disable",
        title: "Stop scanning",
        subtitle: "Disable live scanning",
        data: { type: "action", actionType: "stop-scan" } as ActionSearchData,
      });
    }

    // Vision capture actions (always available when connected)
    actions.push({
      type: "action",
      category: "actions",
      id: "action:capture-full",
      searchText: "capture screenshot full page vision analyze",
      title: "Capture full page",
      subtitle: "AI-powered visual consistency analysis",
      data: { type: "action", actionType: "capture-full" } as ActionSearchData,
    });

    actions.push({
      type: "action",
      category: "actions",
      id: "action:capture-region",
      searchText: "capture screenshot region select area vision",
      title: "Capture region",
      subtitle: "Select area to analyze",
      data: {
        type: "action",
        actionType: "capture-region",
      } as ActionSearchData,
    });
  }

  return actions;
}

/**
 * Command Palette - Unified search interface for UILint
 * Single searchable list with contextual categories
 */
export function CommandPalette() {
  const isOpen = useUILintStore((s: UILintStore) => s.commandPaletteOpen);
  const query = useUILintStore((s: UILintStore) => s.commandPaletteQuery);
  const selectedIndex = useUILintStore(
    (s: UILintStore) => s.commandPaletteSelectedIndex
  );
  const expandedItemId = useUILintStore((s: UILintStore) => s.expandedItemId);
  const disabledRules = useUILintStore((s: UILintStore) => s.disabledRules);
  const wsConnected = useUILintStore((s: UILintStore) => s.wsConnected);
  const liveScanEnabled = useUILintStore((s: UILintStore) => s.liveScanEnabled);
  const autoScanState = useUILintStore((s: UILintStore) => s.autoScanState);
  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );
  const fileIssuesCache = useUILintStore((s: UILintStore) => s.fileIssuesCache);
  const availableRules = useUILintStore((s: UILintStore) => s.availableRules);
  const screenshotHistory = useUILintStore(
    (s: UILintStore) => s.screenshotHistory
  );

  // Map elementId -> filePath based on the latest scanned elements.
  // (Element issues in the cache don't currently carry source info.)
  const elementIdToFilePath = useMemo(() => {
    const map = new Map<string, string>();
    for (const el of autoScanState.elements) {
      map.set(el.id, el.source.fileName);
    }
    return map;
  }, [autoScanState.elements]);

  const {
    openCommandPalette,
    closeCommandPalette,
    setCommandPaletteQuery,
    setCommandPaletteSelectedIndex,
    setHighlightedRuleId,
    setHoveredCommandPaletteItemId,
    setSelectedCommandPaletteItemId,
    toggleRule,
    enableLiveScan,
    disableLiveScan,
    triggerVisionAnalysis,
    setRegionSelectionActive,
    connectWebSocket,
  } = useUILintStore.getState();

  // Track selected item for persistent heatmap display
  const selectedCommandPaletteItemId = useUILintStore(
    (s: UILintStore) => s.selectedCommandPaletteItemId
  );

  // Build action items
  const actionItems = useMemo(
    () => buildActionItems(wsConnected, liveScanEnabled),
    [wsConnected, liveScanEnabled]
  );

  // Build searchable items from scan results
  const searchableItems = useMemo(() => {
    const items = buildSearchableItems(
      autoScanState.elements,
      elementIssuesCache,
      fileIssuesCache,
      availableRules,
      disabledRules,
      screenshotHistory
    );
    // Prepend action items
    return [...actionItems, ...items];
  }, [
    autoScanState.elements,
    elementIssuesCache,
    fileIssuesCache,
    availableRules,
    disabledRules,
    screenshotHistory,
    actionItems,
  ]);

  // Fuzzy search
  const searchResults = useFuzzySearch(query, searchableItems);

  // Total item count for keyboard navigation
  const itemCount = searchResults.length;

  // Find the selected item object for detail view
  // This also handles dynamically constructed issue IDs from rule detail view
  const selectedItem = useMemo((): SearchableItem | null => {
    if (!selectedCommandPaletteItemId) return null;

    // First try to find in search results
    const result = searchResults.find(
      (r) => r.item.id === selectedCommandPaletteItemId
    );
    if (result) return result.item;

    // If not found and it's an issue ID, construct the item from the cache
    if (selectedCommandPaletteItemId.startsWith("issue:")) {
      // Parse the issue ID to find it in the cache
      // Format: issue:${elementId}:${ruleId}:${line}:${column} or issue:file:${filePath}:${ruleId}:${line}:${column}
      const parts = selectedCommandPaletteItemId.split(":");

      if (parts[1] === "file") {
        // File-level issue: issue:file:${filePath}:${ruleId}:${line}:${column}
        const filePath = parts[2];
        const fileIssues = fileIssuesCache.get(filePath);
        if (fileIssues) {
          // Find matching issue by ruleId, line, column
          const ruleId = parts.slice(3, -2).join(":"); // ruleId might contain colons
          const line = parseInt(parts[parts.length - 2], 10);
          const column = parseInt(parts[parts.length - 1], 10);
          const issue = fileIssues.find(
            (i) => i.ruleId === ruleId && i.line === line && i.column === column
          );
          if (issue) {
            return {
              type: "issue",
              category: "issues",
              id: selectedCommandPaletteItemId,
              searchText: issue.message,
              title: issue.message,
              subtitle: `${filePath.split("/").pop()}:${issue.line}`,
              data: { type: "issue", issue, filePath } as IssueSearchData,
            };
          }
        }
      } else {
        // Element-level issue: issue:${elementId}:${ruleId}:${line}:${column}
        // Parse carefully - elementId format is like "loc:path:line:column#occurrence"
        // Need to find where ruleId starts (it starts with "uilint/")
        const fullId = selectedCommandPaletteItemId.substring(6); // Remove "issue:"
        const uilintIndex = fullId.indexOf("uilint/");
        if (uilintIndex > 0) {
          const elementId = fullId.substring(0, uilintIndex - 1); // -1 for the colon
          const rest = fullId.substring(uilintIndex);
          const restParts = rest.split(":");
          const ruleId = restParts[0];
          const line = parseInt(restParts[1], 10);
          const column = parseInt(restParts[2], 10);

          const elementIssue = elementIssuesCache.get(elementId);
          if (elementIssue) {
            const filePath = elementIdToFilePath.get(elementId) || "";
            const issue = elementIssue.issues.find(
              (i) =>
                i.ruleId === ruleId && i.line === line && i.column === column
            );
            if (issue) {
              return {
                type: "issue",
                category: "issues",
                id: selectedCommandPaletteItemId,
                searchText: issue.message,
                title: issue.message,
                subtitle: filePath
                  ? `${filePath.split("/").pop()}:${issue.line}`
                  : `Unknown file:${issue.line}`,
                data: {
                  type: "issue",
                  issue,
                  elementId,
                  filePath,
                } as IssueSearchData,
              };
            }
          }
        }
      }
    }

    return null;
  }, [
    selectedCommandPaletteItemId,
    searchResults,
    elementIssuesCache,
    fileIssuesCache,
    elementIdToFilePath,
  ]);

  // Handle item selection (click) - zooms into detail view
  const handleSelect = useCallback(
    (index: number) => {
      const result = searchResults[index];
      if (!result) return;

      const item = result.item;

      // Handle based on item type
      switch (item.type) {
        case "action": {
          const actionData = item.data as ActionSearchData;
          switch (actionData.actionType) {
            case "connect":
              connectWebSocket();
              closeCommandPalette();
              break;
            case "start-scan":
              enableLiveScan(true);
              closeCommandPalette();
              break;
            case "stop-scan":
              disableLiveScan();
              closeCommandPalette();
              break;
            case "capture-full":
              triggerVisionAnalysis();
              closeCommandPalette();
              break;
            case "capture-region":
              setRegionSelectionActive(true);
              closeCommandPalette();
              break;
          }
          break;
        }

        case "rule":
        case "file":
        case "capture":
        case "issue": {
          // Zoom into detail view - set as selected (shows heatmap + detail)
          setSelectedCommandPaletteItemId(item.id);

          // Also scroll to element for issues
          if (item.type === "issue") {
            const issueData = item.data;
            if (issueData.type === "issue" && issueData.issue.dataLoc) {
              // Try both formats (source location and runtime ID)
              let element = document.querySelector(
                `[${DATA_UILINT_ID}="${issueData.issue.dataLoc}"]`
              );
              if (!element) {
                element = document.querySelector(
                  `[${DATA_UILINT_ID}^="loc:${issueData.issue.dataLoc}"]`
                );
              }
              if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }
          }
          break;
        }
      }
    },
    [
      searchResults,
      setSelectedCommandPaletteItemId,
      closeCommandPalette,
      connectWebSocket,
      enableLiveScan,
      disableLiveScan,
      triggerVisionAnalysis,
      setRegionSelectionActive,
    ]
  );

  // Handle going back from detail view to list
  const handleBack = useCallback(() => {
    setSelectedCommandPaletteItemId(null);
    setHoveredCommandPaletteItemId(null);
  }, [setSelectedCommandPaletteItemId, setHoveredCommandPaletteItemId]);

  // Handle item hover (for transient highlighting)
  const handleHover = useCallback(
    (itemId: string | null) => {
      // Set the hovered item for general highlighting
      setHoveredCommandPaletteItemId(itemId);

      if (!itemId) {
        setHighlightedRuleId(null);
        return;
      }

      // Find the item for rule-specific highlighting
      const result = searchResults.find((r) => r.item.id === itemId);
      if (result?.item.type === "rule") {
        setHighlightedRuleId(result.item.id);
      } else {
        setHighlightedRuleId(null);
      }
    },
    [searchResults, setHighlightedRuleId, setHoveredCommandPaletteItemId]
  );

  // Keyboard navigation - disable when in detail view
  useKeyboardNavigation({
    isOpen: isOpen && !selectedItem,
    itemCount,
    selectedIndex,
    onSelect: handleSelect,
    onIndexChange: setCommandPaletteSelectedIndex,
    onClose: closeCommandPalette,
  });

  // Handle Escape/Backspace in detail view to go back
  useEffect(() => {
    if (!isOpen || !selectedItem) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        handleBack();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedItem, handleBack]);

  // Cmd+K shortcut
  useCommandPaletteShortcut(() => {
    if (isOpen) {
      closeCommandPalette();
    } else {
      openCommandPalette();
    }
  });

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-command-palette]")) return;
      closeCommandPalette();
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, closeCommandPalette]);

  if (!isOpen) return null;

  const portalHost = getUILintPortalHost();
  if (!portalHost) return null;

  return createPortal(
    <div
      className={cn(
        // Position: top center, command palette style
        "fixed top-20 left-1/2 -translate-x-1/2 z-[100000]",
        // Size
        "w-[560px] max-w-[calc(100vw-32px)]"
      )}
      data-command-palette
      data-ui-lint
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 backdrop-blur-sm -z-10"
        onClick={closeCommandPalette}
        data-ui-lint
      />

      {/* Panel with glass effect */}
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className={cn(
          // Glass/frosted effect
          "bg-white/70 dark:bg-zinc-900/70",
          "backdrop-blur-2xl backdrop-saturate-150",

          // Subtle border with glass-like shine
          "border border-white/20 dark:border-white/10",
          "ring-1 ring-black/5 dark:ring-white/5",

          // Shadow for depth
          "shadow-2xl shadow-black/10 dark:shadow-black/30",

          // Rounded corners
          "rounded-2xl",

          "overflow-hidden"
        )}
        data-ui-lint
      >
        <AnimatePresence mode="wait">
          {selectedItem ? (
            /* Detail view - zoomed in item */
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              className="min-h-[300px] max-h-[480px] flex flex-col"
            >
              <DetailView
                item={selectedItem}
                onBack={handleBack}
                onToggleRule={toggleRule}
                isRuleEnabled={
                  selectedItem.type === "rule"
                    ? !disabledRules.has(
                        (selectedItem.data as RuleSearchData).rule.id
                      )
                    : true
                }
                onSelectIssue={(issueId) => {
                  // Navigate to the issue by setting it as selected
                  setSelectedCommandPaletteItemId(issueId);
                }}
              />
            </motion.div>
          ) : (
            /* List view - search results */
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              {/* Input with connection status */}
              <CommandPaletteInput
                value={query}
                onChange={setCommandPaletteQuery}
                placeholder="Search actions, rules, files, issues..."
                isConnected={wsConnected}
              />

              {/* Results */}
              <CommandPaletteResults
                results={searchResults}
                selectedIndex={selectedIndex}
                expandedItemId={expandedItemId}
                selectedItemId={selectedCommandPaletteItemId}
                onSelect={handleSelect}
                onHover={handleHover}
                onToggleRule={toggleRule}
                disabledRules={disabledRules}
              />

              {/* Footer hint */}
              <div
                className={cn(
                  "px-4 py-2",
                  "text-[10px] text-zinc-500 dark:text-zinc-400",
                  "border-t border-white/10 dark:border-white/5",
                  "bg-black/5 dark:bg-white/5",
                  "flex items-center gap-4"
                )}
                data-ui-lint
              >
                <span>
                  <kbd className="px-1 py-0.5 rounded bg-white/50 dark:bg-white/10">
                    ↑↓
                  </kbd>{" "}
                  Navigate
                </span>
                <span>
                  <kbd className="px-1 py-0.5 rounded bg-white/50 dark:bg-white/10">
                    ⏎
                  </kbd>{" "}
                  Select
                </span>
                <span>
                  <kbd className="px-1 py-0.5 rounded bg-white/50 dark:bg-white/10">
                    esc
                  </kbd>{" "}
                  Close
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>,
    portalHost
  );
}
