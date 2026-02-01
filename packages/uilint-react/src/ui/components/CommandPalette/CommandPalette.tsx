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

import React, { useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { devError } from "uilint-core";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { useTileItems, useTileNavigation } from "../../hooks";
import { SearchInput } from "./SearchInput";
import { KeywordSidebar } from "./KeywordSidebar";
import { TileGrid } from "./TileGrid";
import { GlassPanel } from "../primitives";
import type { TileItem } from "../../../core/plugin-system/types";

// Crisp easing for panel motion
const panelTransition = {
  duration: 0.12,
  ease: [0.32, 0.72, 0, 1] as const,
};

export function CommandPalette() {
  const isOpen = useComposedStore((s) => s.commandPalette.open);
  const query = useComposedStore((s) => s.commandPalette.query);
  const sidebarFocused = useComposedStore((s) => s.commandPalette.sidebarFocused);
  const filters = useComposedStore((s) => s.commandPalette.filters);
  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const setQuery = useComposedStore((s) => s.setCommandPaletteQuery);
  const setSidebarFocused = useComposedStore((s) => s.setSidebarFocused);
  const openInspector = useComposedStore((s) => s.openInspector);
  const removeFilter = useComposedStore((s) => s.removeFilter);
  const removeLastFilter = useComposedStore((s) => s.removeLastFilter);

  // Tile system state
  const refreshTileItems = useComposedStore((s) => s.refreshTileItems);

  // Mobile detection from store
  const isMobile = useComposedStore((s) => s.mobile.isMobile);
  const isSmallScreen = useComposedStore((s) => s.mobile.isSmallScreen);

  // Selected category IDs (empty means all)
  const selectedCategoryIds = useMemo(() => new Set<string>(), []);

  // Get tile items using the hook
  const { items: tileItems, isLoading, isTerminal } = useTileItems(
    filters,
    query,
    selectedCategoryIds
  );

  // Handle back navigation (backspace with empty query removes last filter)
  const handleBack = useCallback(() => {
    removeLastFilter();
  }, [removeLastFilter]);

  // Handle tile click
  const handleTileClick = useCallback(
    async (item: TileItem) => {
      // Check if item has an execute function in metadata
      const execute = item.metadata?.execute as ((services: unknown) => Promise<void>) | undefined;
      if (execute) {
        const services = getPluginServices();
        if (!services) {
          devError("[CommandPalette] Plugin services not available");
          return;
        }
        try {
          await execute(services);
        } catch (error) {
          devError(`[CommandPalette] Error executing tile item "${item.id}":`, error);
        }
      } else {
        // Default behavior: open inspector with item details
        openInspector("tile-item", { item });
      }
      closeCommandPalette();
    },
    [openInspector, closeCommandPalette]
  );

  // Use tile navigation for 2D keyboard navigation
  const { selectedIndex, handleKeyDown: tileHandleKeyDown } = useTileNavigation(
    tileItems,
    3, // columns
    handleTileClick,
    handleBack
  );

  // Extended keyboard handler that also handles sidebar focus
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Tab to switch between sidebar and results
      if (e.key === "Tab") {
        e.preventDefault();
        setSidebarFocused(!sidebarFocused);
        return;
      }

      // If sidebar is focused, handle sidebar navigation separately
      if (sidebarFocused) {
        // Left arrow to stay in sidebar, Right to go to tiles
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setSidebarFocused(false);
        }
        return;
      }

      // Left arrow from tiles goes to sidebar
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSidebarFocused(true);
        return;
      }

      // Delegate to tile navigation for Up/Down/Right/Enter/etc.
      tileHandleKeyDown(e);
    },
    [sidebarFocused, setSidebarFocused, tileHandleKeyDown]
  );

  // Refresh tile items when command palette opens
  useEffect(() => {
    if (isOpen) {
      refreshTileItems();
    }
  }, [isOpen, refreshTileItems]);

  const portalRoot = document.getElementById("uilint-portal") || document.body;

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

              {/* Content Area: Sidebar + Tile Grid */}
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

                {/* Tile Grid Pane */}
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
                    {isLoading ? (
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
                    ) : (
                      /* Tile Grid */
                      <motion.div
                        key="tiles"
                        initial={isMobile ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={isMobile ? undefined : { opacity: 0 }}
                        transition={{ duration: isMobile ? 0 : 0.1 }}
                      >
                        <TileGrid
                          items={tileItems}
                          onTileClick={handleTileClick}
                          selectedIndex={selectedIndex}
                          isTerminal={isTerminal}
                        />
                      </motion.div>
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
