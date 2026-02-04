/**
 * CommandPalette - Elegant command interface inspired by Spotlight & Raycast
 *
 * Features:
 * - Hero search input with glassmorphic styling
 * - Tile-based masonry grid for visual item display
 * - Expandable tiles with in-place expansion
 * - Keyboard navigation for tiles
 *
 * Visual design:
 * - Minimal colors, visual hierarchy through opacity/weight
 * - Glassmorphic container with backdrop blur
 * - Staggered animations with crisp easing
 * - shadcn class conventions
 */

import React, { useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { devError } from "uilint-core";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { useTileItems, useTileNavigation } from "../../hooks";
import { SearchInput } from "./SearchInput";
import { TileGrid } from "./TileGrid";
import { ExpandableTileGrid } from "./ExpandableTileGrid";
import { OnboardingState } from "./OnboardingState";
import { GlassPanel } from "../primitives";
import type { TileItem } from "../../../core/plugin-system/types";
import type { ScanStatus } from "../../../plugins/eslint/slice";

// Crisp easing for panel motion
const panelTransition = {
  duration: 0.12,
  ease: [0.32, 0.72, 0, 1] as const,
};

// Feature flag for expandable tile UI (can be made configurable later)
const USE_EXPANDABLE_TILES = true;

export function CommandPalette() {
  const isOpen = useComposedStore((s) => s.commandPalette.open);
  const query = useComposedStore((s) => s.commandPalette.query);
  const expansionPath = useComposedStore((s) => s.commandPalette.expansionPath);
  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const setQuery = useComposedStore((s) => s.setCommandPaletteQuery);
  const openInspectorPanel = useComposedStore((s) => s.openInspectorPanel);
  const collapseTile = useComposedStore((s) => s.collapseTile);

  // Mobile detection from store
  const isMobile = useComposedStore((s) => s.mobile.isMobile);

  // Connection status for onboarding
  const wsConnected = useComposedStore((s) => s.wsConnected);
  const connectionStatus = useComposedStore((s) => s.connectionStatus);
  const scanStatus = useComposedStore(
    (s) => (s.plugins?.eslint as { scanStatus?: ScanStatus } | undefined)?.scanStatus
  );

  // Determine if we should show onboarding state
  const showOnboarding = React.useMemo(() => {
    // In websocket mode, show onboarding if not connected
    if (connectionStatus.mode === "websocket" && !wsConnected) {
      return true;
    }
    // In static mode, show onboarding if scan status is error
    if (connectionStatus.mode === "static" && scanStatus === "error") {
      return true;
    }
    return false;
  }, [connectionStatus.mode, wsConnected, scanStatus]);

  // Determine onboarding variant
  const onboardingVariant = React.useMemo(() => {
    if (connectionStatus.mode === "static" && scanStatus === "error") {
      return "manifest-error" as const;
    }
    return "disconnected" as const;
  }, [connectionStatus.mode, scanStatus]);

  // Current expansion level
  const expansionLevel = expansionPath.length;

  // Get tile items using the hook (no filters - show all tiles)
  const { items: tileItems, isLoading, isTerminal } = useTileItems(query);

  // Handle back navigation (backspace with empty query collapses expansion)
  const handleBack = useCallback(() => {
    if (expansionLevel > 0) {
      collapseTile();
    }
  }, [expansionLevel, collapseTile]);

  // Handle tile click - expansion is handled by ExpandableTileGrid internally
  // This is only used for non-expandable mode or legacy behavior
  const handleTileClick = useCallback(
    async (item: TileItem) => {
      const services = getPluginServices();
      if (!services) {
        devError("[CommandPalette] Plugin services not available");
        return;
      }

      // Check if item has an execute function in metadata (commands)
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

      // For non-expandable tiles, just open inspector
      openInspectorPanel();
      closeCommandPalette();
    },
    [closeCommandPalette, openInspectorPanel]
  );

  // Handle "open in inspector" button click on tiles
  const handleOpenInInspector = useCallback(
    (_item: TileItem) => {
      openInspectorPanel();
      closeCommandPalette();
    },
    [openInspectorPanel, closeCommandPalette]
  );

  // Use tile navigation for 2D keyboard navigation
  const { selectedIndex, handleKeyDown: tileHandleKeyDown } = useTileNavigation(
    tileItems,
    3, // columns
    handleTileClick,
    handleBack
  );

  // Keyboard handler for tile navigation and expansion
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape key: collapse expanded tile or close palette
      if (e.key === "Escape") {
        if (USE_EXPANDABLE_TILES && expansionLevel > 0) {
          // Collapse the current expansion
          e.preventDefault();
          collapseTile();
          return;
        }
        // Default behavior: close the command palette (handled by parent)
      }

      // Delegate to tile navigation for Up/Down/Left/Right/Enter/etc.
      tileHandleKeyDown(e);
    },
    [tileHandleKeyDown, expansionLevel, collapseTile]
  );

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
            background: isMobile ? "var(--uilint-surface)" : "transparent",
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
              />

              {/* Content Area: Tile Grid or Onboarding */}
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
                    {/* Onboarding state - show when not connected */}
                    {showOnboarding ? (
                      <motion.div
                        key="onboarding"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <OnboardingState variant={onboardingVariant} />
                      </motion.div>
                    ) : isLoading ? (
                      /* Loading state */
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
                      /* Tile Grid - Expandable or Traditional */
                      <motion.div
                        key="tiles"
                        initial={isMobile ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={isMobile ? undefined : { opacity: 0 }}
                        transition={{ duration: isMobile ? 0 : 0.1 }}
                      >
                        {USE_EXPANDABLE_TILES ? (
                          <ExpandableTileGrid
                            items={tileItems}
                            selectedIndex={selectedIndex}
                            isTerminal={isTerminal}
                            onOpenInInspector={handleOpenInInspector}
                          />
                        ) : (
                          <TileGrid
                            items={tileItems}
                            onTileClick={handleTileClick}
                            onOpenInInspector={handleOpenInInspector}
                            selectedIndex={selectedIndex}
                            isTerminal={isTerminal}
                          />
                        )}
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
