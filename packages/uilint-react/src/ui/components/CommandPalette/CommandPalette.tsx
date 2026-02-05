/**
 * CommandPalette - Elegant command interface inspired by Spotlight & Raycast
 *
 * REDESIGNED: Flat tile interface showing all rules and files together.
 * Single click on any tile opens the inspector with that context.
 *
 * Features:
 * - Hero search input with glassmorphic styling
 * - Flat tile grid showing rules + files sorted by issue count
 * - Search filters tiles by underlying issues
 * - Single click opens inspector
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
import { cn } from "../../../lib/utils";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { useTileItems, useTileNavigation } from "../../hooks";
import { SearchInput } from "./SearchInput";
import { TileGrid } from "../HierarchicalTiles/TileGrid";
import { OnboardingState } from "./OnboardingState";
import { RuleToggleBar } from "./RuleToggleBar";
import { GlassPanel } from "../primitives";
import type { TileItem } from "../../../core/plugin-system/types";
import type { ScanStatus } from "../../../plugins/eslint/slice";

// Crisp easing for panel motion
const panelTransition = {
  duration: 0.12,
  ease: [0.32, 0.72, 0, 1] as const,
};

export function CommandPalette() {
  const isOpen = useComposedStore((s) => s.commandPalette.open);
  const query = useComposedStore((s) => s.commandPalette.query);
  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const setQuery = useComposedStore((s) => s.setCommandPaletteQuery);
  const openInspectorPanel = useComposedStore((s) => s.openInspectorPanel);
  const expandRule = useComposedStore((s) => s.expandRule);
  const expandFileInRule = useComposedStore((s) => s.expandFileInRule);

  // Mobile detection from store
  const isMobile = useComposedStore((s) => s.mobile.isMobile);

  // Connection status for onboarding
  const wsConnected = useComposedStore((s) => s.wsConnected);
  const connectionStatus = useComposedStore((s) => s.connectionStatus);
  const scanStatus = useComposedStore(
    (s) =>
      (s.plugins?.eslint as { scanStatus?: ScanStatus } | undefined)?.scanStatus
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

  // Get tile items using the hook (flat list of rules + files)
  const { items: tileItems, isLoading } = useTileItems(query);

  // Handle tile click - opens inspector with appropriate context
  const handleTileClick = useCallback(
    async (item: TileItem) => {
      const services = getPluginServices();
      if (!services) {
        devError("[CommandPalette] Plugin services not available");
        return;
      }

      // Check if item has an execute function in metadata (commands)
      const execute = item.metadata?.execute as
        | ((services: unknown) => Promise<void>)
        | undefined;
      if (execute) {
        try {
          await execute(services);
        } catch (error) {
          devError(
            `[CommandPalette] Error executing tile item "${item.id}":`,
            error
          );
        }
        closeCommandPalette();
        return;
      }

      // Open inspector with context based on tile type
      const tileType = item.metadata?.tileType as string | undefined;

      if (tileType === "rule") {
        // Rule tile: expand the rule in inspector
        const ruleId = item.metadata?.ruleId as string;
        if (ruleId) {
          expandRule(ruleId);
        }
      } else if (tileType === "file") {
        // File tile: expand to show the file in inspector
        // For global file tiles, we just open the inspector (file will be shown in the default view)
        const filePath = item.metadata?.filePath as string;
        if (filePath) {
          // If there's a ruleId, expand that rule and then the file
          const ruleId = item.metadata?.ruleId as string | undefined;
          if (ruleId) {
            expandRule(ruleId);
            expandFileInRule(filePath);
          }
          // For global file tiles (no ruleId), just open inspector
          // The IssuesList will show all issues for that file
        }
      }

      openInspectorPanel();
      closeCommandPalette();
    },
    [closeCommandPalette, openInspectorPanel, expandRule, expandFileInRule]
  );

  // Use tile navigation for 2D keyboard navigation
  const { selectedIndex, handleKeyDown: tileHandleKeyDown } = useTileNavigation(
    tileItems,
    3, // columns
    handleTileClick,
    () => {} // No back navigation needed in flat mode
  );

  // Keyboard handler for tile navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Delegate to tile navigation for Up/Down/Left/Right/Enter/etc.
      tileHandleKeyDown(e);
    },
    [tileHandleKeyDown]
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
          className={cn(
            "fixed inset-0 flex justify-center z-[99998] pointer-events-auto",
            isMobile
              ? "items-stretch bg-surface pt-0"
              : "items-start bg-transparent pt-[100px]"
          )}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCommandPalette();
          }}
          onKeyDown={handleKeyDown}
        >
          <motion.div
            initial={
              isMobile ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -20 }
            }
            animate={isMobile ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={
              isMobile ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -10 }
            }
            transition={isMobile ? { duration: 0.15 } : panelTransition}
            className={isMobile ? "flex flex-col w-full h-full" : undefined}
          >
            <GlassPanel
              blur={isMobile ? "light" : "heavy"}
              shadow={isMobile ? undefined : "lg"}
              animate={false}
              className={cn(
                "overflow-hidden",
                isMobile
                  ? "w-full h-full flex flex-col rounded-none pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
                  : "w-[580px] h-auto block rounded-[20px]"
              )}
            >
              {/* Mobile Header with Close Button */}
              {isMobile && (
                <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border">
                  <span className="text-[15px] font-semibold text-text-primary">
                    Search
                  </span>
                  <button
                    onClick={closeCommandPalette}
                    className="px-4 py-2 text-sm font-medium text-accent bg-transparent border-none cursor-pointer rounded-lg"
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

              {/* Rule Toggle Bar - quick toggles for filtering rules */}
              {!showOnboarding && <RuleToggleBar />}

              {/* Content Area: Tile Grid or Onboarding */}
              <div
                className={cn(
                  "min-h-0 overflow-y-auto overflow-x-hidden",
                  "[-webkit-overflow-scrolling:touch]",
                  isMobile ? "flex-1 max-h-none" : "max-h-[440px]"
                )}
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
                      className="py-12 px-6 flex flex-col items-center justify-center"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="w-6 h-6 rounded-full border-2 border-border border-t-accent"
                      />
                      <div className="mt-3 text-[13px] text-text-muted">
                        Loading...
                      </div>
                    </motion.div>
                  ) : (
                    /* Flat Tile Grid - rules + files together */
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
