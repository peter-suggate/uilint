/**
 * CommandPalette - Two-panel search interface with live preview
 *
 * Rebar-inspired redesign: result list on the left, preview pane on the right.
 * Supports fuzzy search across rules, files, and commands via plugin system.
 *
 * Features:
 * - Two-panel layout (860px desktop, full-screen mobile)
 * - Grouped result list (Rules, Files) with severity badges
 * - Plugin-provided preview pane content
 * - Fuzzy search via fuse.js
 * - 1D keyboard navigation (ArrowUp/Down, Enter, Escape, Tab)
 * - Mobile push navigation (tap slides to preview)
 * - Slick motion animations throughout
 */

import React, { useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { devError } from "uilint-core";
import { cn } from "../../../lib/utils";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { useSearchItems } from "../../hooks/useSearchItems";
import { useFuzzySearch } from "../../hooks/useFuzzySearch";
import { useListNavigation } from "../../hooks/useListNavigation";
import { SearchInput } from "./SearchInput";
import { ResultList } from "./ResultList";
import { PreviewPane } from "./PreviewPane";
import { OnboardingState } from "./OnboardingState";
import { GlassPanel } from "../primitives";
import type { SearchItem } from "../../../core/plugin-system/types";
import type { ScanStatus } from "../../../plugins/eslint/slice";

// ============================================================================
// Constants
// ============================================================================

const panelTransition = {
  duration: 0.12,
  ease: [0.32, 0.72, 0, 1] as const,
};

const mobileSlideTransition = {
  duration: 0.2,
  ease: [0.32, 0.72, 0, 1] as const,
};

// ============================================================================
// Component
// ============================================================================

export function CommandPalette() {
  // --- Store subscriptions ---
  const isOpen = useComposedStore((s) => s.commandPalette.open);
  const query = useComposedStore((s) => s.commandPalette.query);
  const selectedItemId = useComposedStore((s) => s.commandPalette.selectedItemId);
  const selectedIndex = useComposedStore((s) => s.commandPalette.selectedIndex);
  const previewFocused = useComposedStore((s) => s.commandPalette.previewFocused);
  const mobileView = useComposedStore((s) => s.commandPalette.mobileView);

  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const setQuery = useComposedStore((s) => s.setCommandPaletteQuery);
  const setSelectedItem = useComposedStore((s) => s.setCommandPaletteSelectedItem);
  const togglePreviewFocus = useComposedStore((s) => s.toggleCommandPalettePreviewFocus);
  const pushToPreview = useComposedStore((s) => s.pushToPreview);
  const popToList = useComposedStore((s) => s.popToList);
  const openInspectorPanel = useComposedStore((s) => s.openInspectorPanel);
  const expandRule = useComposedStore((s) => s.expandRule);
  const expandFileInRule = useComposedStore((s) => s.expandFileInRule);

  const isMobile = useComposedStore((s) => s.mobile.isMobile);

  // Connection status for onboarding
  const wsConnected = useComposedStore((s) => s.wsConnected);
  const connectionStatus = useComposedStore((s) => s.connectionStatus);
  const scanStatus = useComposedStore(
    (s) =>
      (s.plugins?.eslint as { scanStatus?: ScanStatus } | undefined)?.scanStatus
  );

  const showOnboarding = useMemo(() => {
    if (connectionStatus.mode === "websocket" && !wsConnected) return true;
    if (connectionStatus.mode === "static" && scanStatus === "error") return true;
    return false;
  }, [connectionStatus.mode, wsConnected, scanStatus]);

  const onboardingVariant = useMemo(() => {
    if (connectionStatus.mode === "static" && scanStatus === "error") {
      return "manifest-error" as const;
    }
    return "disconnected" as const;
  }, [connectionStatus.mode, scanStatus]);

  // --- Search data ---
  const searchItems = useSearchItems();
  const { grouped, flatItems } = useFuzzySearch(searchItems, query);

  // Selected item object
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return flatItems[0] ?? null;
    return flatItems.find((i) => i.id === selectedItemId) ?? flatItems[0] ?? null;
  }, [selectedItemId, flatItems]);

  // --- Callbacks ---
  const handleItemSelect = useCallback(
    (item: SearchItem, index: number) => {
      setSelectedItem(item.id, index);
      // On mobile, also push to preview
      if (isMobile) {
        pushToPreview();
      }
    },
    [setSelectedItem, isMobile, pushToPreview]
  );

  const handleItemConfirm = useCallback(
    async (item: SearchItem) => {
      const services = getPluginServices();
      if (!services) {
        devError("[CommandPalette] Plugin services not available");
        return;
      }

      // Check for execute function
      if (item.execute) {
        try {
          await item.execute(services);
        } catch (error) {
          devError(
            `[CommandPalette] Error executing item "${item.id}":`,
            error
          );
        }
        closeCommandPalette();
        return;
      }

      // Open inspector with context based on item type
      const tileType = item.metadata?.tileType as string | undefined;

      if (tileType === "rule") {
        const ruleId = item.metadata?.ruleId as string;
        if (ruleId) expandRule(ruleId);
      } else if (tileType === "file") {
        const filePath = item.metadata?.filePath as string;
        if (filePath) {
          const ruleId = item.metadata?.ruleId as string | undefined;
          if (ruleId) {
            expandRule(ruleId);
            expandFileInRule(filePath);
          }
        }
      }

      openInspectorPanel();
      closeCommandPalette();
    },
    [closeCommandPalette, openInspectorPanel, expandRule, expandFileInRule]
  );

  // --- Keyboard navigation ---
  const { handleKeyDown } = useListNavigation({
    flatItems,
    selectedIndex,
    onSelect: (index, id) => setSelectedItem(id, index),
    onConfirm: handleItemConfirm,
    onEscape: closeCommandPalette,
    onTabToggle: togglePreviewFocus,
  });

  // --- Render ---
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
                  : "w-[860px] h-auto flex flex-col rounded-[20px]"
              )}
            >
              {/* Mobile Header */}
              {isMobile && (
                <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border">
                  {mobileView === "preview" ? (
                    <button
                      onClick={popToList}
                      className="flex items-center gap-1.5 text-sm font-medium text-accent bg-transparent border-none cursor-pointer rounded-lg px-2 py-1"
                    >
                      <ArrowLeft size={16} />
                      Back
                    </button>
                  ) : (
                    <span className="text-[15px] font-semibold text-text-primary">
                      Search
                    </span>
                  )}
                  <button
                    onClick={closeCommandPalette}
                    className="px-4 py-2 text-sm font-medium text-accent bg-transparent border-none cursor-pointer rounded-lg"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Search Input */}
              <SearchInput
                value={query}
                onChange={setQuery}
                size={isMobile ? "default" : "large"}
              />

              {/* Content Area */}
              {showOnboarding ? (
                <div className="py-8 px-6">
                  <OnboardingState variant={onboardingVariant} />
                </div>
              ) : isMobile ? (
                /* Mobile: push navigation between list and preview */
                <div className="flex-1 min-h-0 overflow-hidden relative">
                  <AnimatePresence mode="sync" initial={false}>
                    {mobileView === "list" ? (
                      <motion.div
                        key="mobile-list"
                        initial={{ x: "-100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "-100%" }}
                        transition={mobileSlideTransition}
                        className="absolute inset-0 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch]"
                      >
                        <ResultList
                          grouped={grouped}
                          flatItems={flatItems}
                          selectedItemId={selectedItemId}
                          selectedIndex={selectedIndex}
                          onItemSelect={handleItemSelect}
                          onItemConfirm={handleItemConfirm}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="mobile-preview"
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={mobileSlideTransition}
                        className="absolute inset-0 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch]"
                      >
                        <PreviewPane
                          selectedItem={selectedItem}
                          isFocused={true}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* Desktop: two-panel layout */
                <div className="flex flex-1 min-h-0 max-h-[520px]">
                  {/* Result list (left panel) */}
                  <div
                    className={cn(
                      "w-[340px] flex-shrink-0",
                      "overflow-y-auto overflow-x-hidden",
                      "[-webkit-overflow-scrolling:touch]",
                      "border-r border-foreground/[0.06]"
                    )}
                  >
                    <ResultList
                      grouped={grouped}
                      flatItems={flatItems}
                      selectedItemId={selectedItem?.id ?? null}
                      selectedIndex={selectedIndex}
                      onItemSelect={handleItemSelect}
                      onItemConfirm={handleItemConfirm}
                    />
                  </div>

                  {/* Preview pane (right panel) */}
                  <div
                    className={cn(
                      "flex-1 min-w-0",
                      "overflow-y-auto overflow-x-hidden",
                      "[-webkit-overflow-scrolling:touch]"
                    )}
                  >
                    <PreviewPane
                      selectedItem={selectedItem}
                      isFocused={previewFocused}
                    />
                  </div>
                </div>
              )}
            </GlassPanel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalRoot
  );
}
