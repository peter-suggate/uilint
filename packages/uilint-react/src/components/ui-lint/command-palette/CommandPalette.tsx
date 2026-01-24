"use client";

import React, { useCallback, useMemo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import {
  useUILintStore,
  type UILintStore,
  type FloatingIconPosition,
} from "../store";
import { getUILintPortalHost } from "../portal-host";
import { CommandPaletteInput } from "./CommandPaletteInput";
import { CommandPaletteResults } from "./CommandPaletteResults";
import { CategorySidebar } from "./CategorySidebar";
import {
  useKeyboardNavigation,
  useCommandPaletteShortcut,
} from "./use-keyboard-navigation";
import { useFuzzySearch, buildSearchableItems } from "./use-fuzzy-search";
import type {
  SearchableItem,
  ActionSearchData,
  IssueSearchData,
  CommandPaletteFilter,
} from "./types";

/** Palette dimensions */
const PALETTE_WIDTH = 720; // Wider to accommodate sidebar
const PALETTE_HEIGHT_ESTIMATE = 400; // approximate height for positioning
const VIEWPORT_PADDING = 16;

/** Calculate palette position based on floating icon position
 * The palette opens directly at/over the icon position, with smart alignment
 * based on available screen space.
 */
function calculatePalettePosition(iconPos: FloatingIconPosition | null): {
  left: number;
  top: number;
} {
  if (typeof window === "undefined") {
    return { left: 400, top: 80 };
  }

  // Default to top-center if no icon position
  const defaultPos = { x: window.innerWidth / 2, y: 20 };
  const pos = iconPos || defaultPos;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Vertical: align top of palette with icon, clamp to viewport
  let top = pos.y;
  top = Math.max(
    VIEWPORT_PADDING,
    Math.min(viewportHeight - PALETTE_HEIGHT_ESTIMATE - VIEWPORT_PADDING, top)
  );

  // Horizontal: try to center on icon, but clamp to keep fully visible
  const halfWidth = PALETTE_WIDTH / 2;
  let left = pos.x;
  const minLeft = halfWidth + VIEWPORT_PADDING;
  const maxLeft = viewportWidth - halfWidth - VIEWPORT_PADDING;
  left = Math.max(minLeft, Math.min(maxLeft, left));

  return { left, top };
}

/**
 * Build suggested action items based on current state
 * Actions are organized into categories: settings, vision
 */
function buildActionItems(
  wsConnected: boolean,
  liveScanEnabled: boolean
): SearchableItem[] {
  const actions: SearchableItem[] = [];

  // Connection action (shown when not connected)
  if (!wsConnected) {
    actions.push({
      type: "action",
      category: "settings",
      id: "action:connect",
      searchText: "connect server start uilint serve",
      title: "Connect to server",
      subtitle: "Run `npx uilint serve` to start the analysis server",
      data: { type: "action", actionType: "connect" } as ActionSearchData,
    });
  } else {
    // Settings category: ESLint scan toggle
    actions.push({
      type: "action",
      category: "settings",
      id: "action:toggle-scan",
      searchText: "eslint scan lint toggle enable disable settings",
      title: "ESLint Scanning",
      subtitle: liveScanEnabled
        ? "Live scanning is active - click to disable"
        : "Enable real-time code quality analysis",
      data: { type: "action", actionType: "toggle-scan" } as ActionSearchData,
    });

    // Vision category: Capture actions
    actions.push({
      type: "action",
      category: "vision",
      id: "action:capture-full",
      searchText: "capture screenshot full page vision analyze ai",
      title: "Capture Full Page",
      subtitle: "AI-powered visual consistency analysis of the entire viewport",
      data: { type: "action", actionType: "capture-full" } as ActionSearchData,
    });

    actions.push({
      type: "action",
      category: "vision",
      id: "action:capture-region",
      searchText: "capture screenshot region select area vision analyze ai",
      title: "Capture Region",
      subtitle: "Select a specific area of the page to analyze",
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
  const disabledRules = useUILintStore((s: UILintStore) => s.disabledRules);
  const wsConnected = useUILintStore((s: UILintStore) => s.wsConnected);
  const liveScanEnabled = useUILintStore((s: UILintStore) => s.liveScanEnabled);
  const autoScanState = useUILintStore((s: UILintStore) => s.autoScanState);
  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );
  const fileIssuesCache = useUILintStore((s: UILintStore) => s.fileIssuesCache);
  const availableRules = useUILintStore((s: UILintStore) => s.availableRules);
  const ruleConfigs = useUILintStore((s: UILintStore) => s.ruleConfigs);
  const ruleConfigUpdating = useUILintStore(
    (s: UILintStore) => s.ruleConfigUpdating
  );
  const screenshotHistory = useUILintStore(
    (s: UILintStore) => s.screenshotHistory
  );
  const floatingIconPosition = useUILintStore(
    (s: UILintStore) => s.floatingIconPosition
  );
  // Filter state for filter-based search
  const commandPaletteFilters = useUILintStore(
    (s: UILintStore) => s.commandPaletteFilters
  );

  // Calculate palette position based on floating icon
  const [palettePosition, setPalettePosition] = useState(() =>
    calculatePalettePosition(floatingIconPosition)
  );

  // Update position when icon position changes or palette opens
  useEffect(() => {
    if (isOpen) {
      setPalettePosition(calculatePalettePosition(floatingIconPosition));
    }
  }, [isOpen, floatingIconPosition]);

  const {
    openCommandPalette,
    closeCommandPalette,
    setCommandPaletteQuery,
    setCommandPaletteSelectedIndex,
    setHighlightedRuleId,
    setHoveredCommandPaletteItemId,
    setSelectedCommandPaletteItemId,
    toggleRule,
    setRuleConfig,
    enableLiveScan,
    disableLiveScan,
    triggerVisionAnalysis,
    setRegionSelectionActive,
    connectWebSocket,
    addCommandPaletteFilter,
    removeCommandPaletteFilter,
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

  // Fuzzy search with filters
  const searchResults = useFuzzySearch(
    query,
    searchableItems,
    commandPaletteFilters
  );

  // Get openInspector from store for sidebar integration
  const openInspector = useUILintStore((s: UILintStore) => s.openInspector);

  // State for scroll-to-category
  const [scrollToCategory, setScrollToCategory] = useState<string | null>(null);

  // Compute file categories from issue results for sidebar
  const fileCategories = useMemo(() => {
    const fileMap = new Map<
      string,
      { count: number; fileName: string; directory: string }
    >();

    for (const result of searchResults) {
      if (result.item.type === "issue") {
        const issueData = result.item.data as IssueSearchData;
        if (issueData.filePath) {
          const existing = fileMap.get(issueData.filePath);
          if (existing) {
            existing.count++;
          } else {
            // Extract filename and directory separately
            const parts = issueData.filePath.split("/");
            const fileName = parts[parts.length - 1] || issueData.filePath;
            const directory =
              parts.length >= 2 ? parts.slice(0, -1).join("/") : "";
            fileMap.set(issueData.filePath, { count: 1, fileName, directory });
          }
        }
      }
    }

    return Array.from(fileMap.entries()).map(([filePath, data]) => ({
      filePath,
      fileName: data.fileName,
      directory: data.directory,
      issueCount: data.count,
    }));
  }, [searchResults]);

  // Count settings items in results
  const settingsCount = useMemo(
    () => searchResults.filter((r) => r.item.category === "settings").length,
    [searchResults]
  );

  // Count vision items in results
  const visionCount = useMemo(
    () => searchResults.filter((r) => r.item.category === "vision").length,
    [searchResults]
  );

  // Count captures in results
  const capturesCount = useMemo(
    () => searchResults.filter((r) => r.item.type === "capture").length,
    [searchResults]
  );

  // Count total vision issues across all captures
  const capturesIssueCount = useMemo(
    () =>
      searchResults
        .filter((r) => r.item.type === "capture")
        .reduce((sum, r) => sum + (r.item.issueCount || 0), 0),
    [searchResults]
  );

  // Count rules in results
  const rulesCount = useMemo(
    () => searchResults.filter((r) => r.item.type === "rule").length,
    [searchResults]
  );

  // Handle category click from sidebar
  const handleCategoryClick = useCallback((categoryId: string) => {
    setScrollToCategory(categoryId);
  }, []);

  // Clear scroll target after scroll completes
  const handleScrollComplete = useCallback(() => {
    setScrollToCategory(null);
  }, []);

  // Total item count for keyboard navigation
  const itemCount = searchResults.length;

  // Handle item selection (click or Enter key)
  const handleSelect = useCallback(
    (index: number) => {
      const result = searchResults[index];
      if (!result) return;

      const item = result.item;

      // Handle action items directly
      if (item.type === "action") {
        const actionData = item.data as ActionSearchData;
        switch (actionData.actionType) {
          case "connect":
            connectWebSocket();
            closeCommandPalette();
            break;
          case "toggle-scan":
            if (liveScanEnabled) {
              disableLiveScan();
            } else {
              enableLiveScan(true);
            }
            // Don't close palette - let user see the state change
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
      }
      // Other item types (rules, files, issues) add filters via onAddFilter
    },
    [
      searchResults,
      liveScanEnabled,
      closeCommandPalette,
      connectWebSocket,
      enableLiveScan,
      disableLiveScan,
      triggerVisionAnalysis,
      setRegionSelectionActive,
    ]
  );

  // Handle adding a filter
  const handleAddFilter = useCallback(
    (filter: CommandPaletteFilter) => {
      addCommandPaletteFilter(filter);
      // Also set as selected for heatmap highlighting
      setSelectedCommandPaletteItemId(`${filter.type}:${filter.value}`);
    },
    [addCommandPaletteFilter, setSelectedCommandPaletteItemId]
  );

  // Handle removing a filter
  const handleRemoveFilter = useCallback(
    (index: number) => {
      removeCommandPaletteFilter(index);
    },
    [removeCommandPaletteFilter]
  );

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

  // Keyboard navigation
  useKeyboardNavigation({
    isOpen,
    itemCount,
    selectedIndex,
    onSelect: handleSelect,
    onIndexChange: setCommandPaletteSelectedIndex,
    onClose: closeCommandPalette,
  });

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
        // Position: dynamic based on floating icon
        "fixed z-[100000]",
        // Size - wider to accommodate sidebar
        "w-[720px] max-w-[calc(100vw-32px)]"
      )}
      style={{
        left: `${palettePosition.left}px`,
        top: `${palettePosition.top}px`,
        transform: "translateX(-50%)",
      }}
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
        className={cn(
          // Glass/frosted effect with theme colors
          "bg-glass",
          "backdrop-blur-2xl backdrop-saturate-150",

          // Subtle border with glass-like shine
          "border border-glass-border",
          "ring-1 ring-glass-border",

          // Shadow for depth
          "shadow-2xl",

          // Rounded corners
          "rounded-2xl",

          "overflow-hidden"
        )}
        data-ui-lint
      >
        {/* Input with connection status and filter chips */}
        <CommandPaletteInput
          value={query}
          onChange={setCommandPaletteQuery}
          placeholder="Search actions, rules, files, issues..."
          isConnected={wsConnected}
          filters={commandPaletteFilters}
          onRemoveFilter={handleRemoveFilter}
        />

        {/* Main content area with sidebar and results */}
        <div className="flex max-h-[400px]">
          {/* Category sidebar */}
          <CategorySidebar
            fileCategories={fileCategories}
            settingsCount={settingsCount}
            visionCount={visionCount}
            capturesCount={capturesCount}
            capturesIssueCount={capturesIssueCount}
            rulesCount={rulesCount}
            onCategoryClick={handleCategoryClick}
          />

          {/* Results list */}
          <CommandPaletteResults
            results={searchResults}
            selectedIndex={selectedIndex}
            selectedItemId={selectedCommandPaletteItemId}
            onSelect={handleSelect}
            onHover={handleHover}
            onToggleRule={toggleRule}
            onToggleScan={() => {
              if (liveScanEnabled) {
                disableLiveScan();
              } else {
                enableLiveScan(true);
              }
            }}
            liveScanEnabled={liveScanEnabled}
            disabledRules={disabledRules}
            onAddFilter={handleAddFilter}
            onOpenInspector={openInspector}
            scrollToCategory={scrollToCategory}
            onScrollComplete={handleScrollComplete}
            availableRules={availableRules}
            ruleConfigs={ruleConfigs}
            ruleConfigUpdating={ruleConfigUpdating}
            onSetRuleConfig={setRuleConfig}
          />
        </div>

        {/* Footer hint */}
        <div
          className={cn(
            "px-4 py-2",
            "text-[10px] text-muted-foreground",
            "border-t border-border",
            "flex items-center gap-4"
          )}
          data-ui-lint
        >
          <span>
            <kbd className="px-1 py-0.5 rounded bg-surface-elevated">↑↓</kbd>{" "}
            Navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-surface-elevated">⏎</kbd>{" "}
            Filter
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-surface-elevated">⌫</kbd>{" "}
            Remove filter
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-surface-elevated">esc</kbd>{" "}
            Close
          </span>
        </div>
      </motion.div>
    </div>,
    portalHost
  );
}
