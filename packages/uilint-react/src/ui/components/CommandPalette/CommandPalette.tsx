/**
 * CommandPalette - Elegant command interface inspired by Spotlight & Raycast
 *
 * Features:
 * - Hero search input with glassmorphic styling
 * - Tile-based masonry grid for visual item display
 * - Filter chips for drill-down navigation
 * - Keyboard navigation for tiles
 *
 * Visual design:
 * - Minimal colors, visual hierarchy through opacity/weight
 * - Glassmorphic container with backdrop blur
 * - Staggered animations with crisp easing
 * - shadcn class conventions
 */

import React, { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { devError } from "uilint-core";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import { useTileItems, useTileNavigation } from "../../hooks";
import { SearchInput } from "./SearchInput";
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
  const filters = useComposedStore((s) => s.commandPalette.filters);
  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const setQuery = useComposedStore((s) => s.setCommandPaletteQuery);
  const openInspector = useComposedStore((s) => s.openInspector);
  const addFilter = useComposedStore((s) => s.addFilter);
  const removeFilter = useComposedStore((s) => s.removeFilter);
  const removeLastFilter = useComposedStore((s) => s.removeLastFilter);

  // Tile system state
  const refreshTileItems = useComposedStore((s) => s.refreshTileItems);

  // Mobile detection from store
  const isMobile = useComposedStore((s) => s.mobile.isMobile);

  // Get tile items using the hook
  const { items: tileItems, isLoading, isTerminal } = useTileItems(
    filters,
    query
  );

  // Handle back navigation (backspace with empty query removes last filter)
  const handleBack = useCallback(() => {
    removeLastFilter();
  }, [removeLastFilter]);

  // Handle tile click
  const handleTileClick = useCallback(
    async (item: TileItem) => {
      const services = getPluginServices();
      if (!services) {
        devError("[CommandPalette] Plugin services not available");
        return;
      }

      // Check if item has an execute function in metadata
      const execute = item.metadata?.execute as ((services: unknown) => Promise<void>) | undefined;
      if (execute) {
        try {
          await execute(services);
        } catch (error) {
          devError(`[CommandPalette] Error executing tile item "${item.id}":`, error);
        }
        closeCommandPalette();
        return;
      }

      // Get the provider for this item
      const providerId = item.metadata?.providerId as string | undefined;
      if (!providerId) {
        // Fallback: open generic inspector
        openInspector("tile-item", { item });
        closeCommandPalette();
        return;
      }

      const tileProviders = pluginRegistry.getAllTileProviders();
      const providerEntry = tileProviders.find((p) => p.pluginId === providerId);

      if (!providerEntry) {
        openInspector("tile-item", { item });
        closeCommandPalette();
        return;
      }

      const { provider } = providerEntry;

      // Check if we're at terminal state OR if this item would make it terminal
      // (e.g., a file tile that already has ruleId in metadata)
      const itemIsTerminal = item.metadata?.isFile && item.metadata?.ruleId;
      if ((isTerminal || itemIsTerminal) && provider.getInspectorData) {
        const inspectorData = provider.getInspectorData(item);
        openInspector(inspectorData.panelId, inspectorData.data);
        closeCommandPalette();
      } else if (provider.createFilter) {
        // Drill down: add filter
        const filter = provider.createFilter(item);
        addFilter(filter);
        refreshTileItems();
      } else {
        // Fallback
        openInspector("tile-item", { item });
        closeCommandPalette();
      }
    },
    [isTerminal, openInspector, closeCommandPalette, addFilter, refreshTileItems]
  );

  // Use tile navigation for 2D keyboard navigation
  const { selectedIndex, handleKeyDown: tileHandleKeyDown } = useTileNavigation(
    tileItems,
    3, // columns
    handleTileClick,
    handleBack
  );

  // Keyboard handler for tile navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Delegate to tile navigation for Up/Down/Left/Right/Enter/etc.
      tileHandleKeyDown(e);
    },
    [tileHandleKeyDown]
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
            background: isMobile ? "var(--uilint-surface)" : "rgba(0, 0, 0, 0.2)",
            backdropFilter: isMobile ? "none" : "blur(20px)",
            WebkitBackdropFilter: isMobile ? "none" : "blur(20px)",
            display: "flex",
            alignItems: isMobile ? "stretch" : "flex-start",
            justifyContent: "center",
            paddingTop: isMobile ? 0 : 100,
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
                width: isMobile ? "100%" : 580,
                height: isMobile ? "100%" : "auto",
                borderRadius: isMobile ? 0 : 20,
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

              {/* Content Area: Tile Grid */}
              <div
                style={{
                  maxHeight: isMobile ? "none" : 440,
                  flex: isMobile ? 1 : undefined,
                  minHeight: 0,
                  overflowY: "auto",
                  overflowX: "hidden",
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
            </GlassPanel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalRoot
  );
}
