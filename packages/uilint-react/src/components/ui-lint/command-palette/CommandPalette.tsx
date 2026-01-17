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
import { ActionTilesGrid } from "./ActionTilesGrid";
import {
  useKeyboardNavigation,
  useCommandPaletteShortcut,
} from "./use-keyboard-navigation";
import { useFuzzySearch, buildSearchableItems } from "./use-fuzzy-search";
import type {
  SearchableItem,
  ActionSearchData,
  CommandPaletteFilter,
} from "./types";

/** Palette dimensions */
const PALETTE_WIDTH = 560;
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
    enableLiveScan,
    disableLiveScan,
    triggerVisionAnalysis,
    setRegionSelectionActive,
    connectWebSocket,
    addCommandPaletteFilter,
    removeCommandPaletteFilter,
    setVisibleCommandPaletteResultIds,
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

  // Get active loc filters for expanded issue rendering
  const activeLocFilters = useMemo(
    () => commandPaletteFilters.filter((f) => f.type === "loc"),
    [commandPaletteFilters]
  );

  // Compute which action tiles should be highlighted based on search query
  const highlightedActions = useMemo(() => {
    const highlighted = new Set<string>();
    if (!query.trim()) return highlighted;

    const q = query.toLowerCase();
    // Scan tile matches
    if (
      "scan".includes(q) ||
      "eslint".includes(q) ||
      "lint".includes(q) ||
      q.includes("scan") ||
      q.includes("eslint") ||
      q.includes("lint")
    ) {
      highlighted.add("scan");
    }
    // Capture full page matches
    if (
      "capture".includes(q) ||
      "full".includes(q) ||
      "page".includes(q) ||
      "screenshot".includes(q) ||
      q.includes("capture") ||
      q.includes("full") ||
      q.includes("screenshot")
    ) {
      highlighted.add("capture-full");
    }
    // Capture region matches
    if (
      "capture".includes(q) ||
      "region".includes(q) ||
      "area".includes(q) ||
      "select".includes(q) ||
      q.includes("capture") ||
      q.includes("region") ||
      q.includes("area")
    ) {
      highlighted.add("capture-region");
    }
    return highlighted;
  }, [query]);

  // Filter out actions from search results (they're shown as tiles now)
  const filteredSearchResults = useMemo(
    () => searchResults.filter((r) => r.item.type !== "action"),
    [searchResults]
  );

  // Sync visible result IDs to store for heatmap filtering
  useEffect(() => {
    if (isOpen) {
      const ids = new Set(searchResults.map((r) => r.item.id));
      setVisibleCommandPaletteResultIds(ids);
    }
  }, [isOpen, searchResults, setVisibleCommandPaletteResultIds]);

  // Total item count for keyboard navigation (excluding action tiles)
  const itemCount = filteredSearchResults.length;

  // Tile action handlers
  const handleToggleScan = useCallback(() => {
    if (liveScanEnabled) {
      disableLiveScan();
    } else {
      enableLiveScan(true);
    }
  }, [liveScanEnabled, enableLiveScan, disableLiveScan]);

  const handleCaptureFullPage = useCallback(() => {
    triggerVisionAnalysis();
    closeCommandPalette();
  }, [triggerVisionAnalysis, closeCommandPalette]);

  const handleCaptureRegion = useCallback(() => {
    setRegionSelectionActive(true);
    closeCommandPalette();
  }, [setRegionSelectionActive, closeCommandPalette]);

  // Handle item selection (click) - actions are now in tiles, this only handles list items
  const handleSelect = useCallback(
    (index: number) => {
      const result = filteredSearchResults[index];
      if (!result) return;
      // List items don't have direct selection behavior - they add filters via onAddFilter
    },
    [filteredSearchResults]
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
      const result = filteredSearchResults.find((r) => r.item.id === itemId);
      if (result?.item.type === "rule") {
        setHighlightedRuleId(result.item.id);
      } else {
        setHighlightedRuleId(null);
      }
    },
    [filteredSearchResults, setHighlightedRuleId, setHoveredCommandPaletteItemId]
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
        // Size
        "w-[560px] max-w-[calc(100vw-32px)]"
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
        {/* Input with connection status and filter chips */}
        <CommandPaletteInput
          value={query}
          onChange={setCommandPaletteQuery}
          placeholder="Search actions, rules, files, issues..."
          isConnected={wsConnected}
          filters={commandPaletteFilters}
          onRemoveFilter={handleRemoveFilter}
        />

        {/* Action tiles grid (scan toggle, capture actions) */}
        <ActionTilesGrid
          liveScanEnabled={liveScanEnabled}
          wsConnected={wsConnected}
          onToggleScan={handleToggleScan}
          onCaptureFullPage={handleCaptureFullPage}
          onCaptureRegion={handleCaptureRegion}
          highlightedActions={highlightedActions}
        />

        {/* Results list (excluding actions - they're shown as tiles) */}
        <CommandPaletteResults
          results={filteredSearchResults}
          selectedIndex={selectedIndex}
          selectedItemId={selectedCommandPaletteItemId}
          onSelect={handleSelect}
          onHover={handleHover}
          onToggleRule={toggleRule}
          disabledRules={disabledRules}
          onAddFilter={handleAddFilter}
          activeLocFilters={activeLocFilters}
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
            Filter
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-white/50 dark:bg-white/10">
              ⌫
            </kbd>{" "}
            Remove filter
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-white/50 dark:bg-white/10">
              esc
            </kbd>{" "}
            Close
          </span>
        </div>
      </motion.div>
    </div>,
    portalHost
  );
}
