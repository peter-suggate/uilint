/**
 * ExpandableTileGrid - Orchestrates the expandable tile UI
 *
 * This component manages the expansion state and renders:
 * - Root-level tiles when no expansion
 * - Expanded tile with children when a tile is selected
 * - Collapsed sibling strip for context
 *
 * It replaces the traditional filter chip model with an in-place
 * expansion model where tiles expand to show their children.
 */
import React, { useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import type { TileItem, ExpandedTile, ExpansionPath } from "../../../core/plugin-system/types";
import { TileGrid } from "./TileGrid";
import { ExpandableTile } from "./ExpandableTile";
import { CollapsedTileStrip } from "./CollapsedTileStrip";
import { ExpandedTileHeader } from "./ExpandedTileHeader";
import {
  expansionWrapperVariants,
  expansionWrapperTransition,
  childrenContainerVariants,
  layoutTransition,
  crispEase,
} from "./animations/expansion-animations";

// ============================================================================
// Types
// ============================================================================

interface ExpandableTileGridProps {
  /** Root-level tile items (when no expansion) */
  items: TileItem[];
  /** Currently selected index for keyboard navigation */
  selectedIndex: number;
  /** Callback when a tile is clicked (at any level) */
  onTileClick?: (item: TileItem, level: number) => void;
  /** Whether we're in a terminal state (no more expansion possible) */
  isTerminal?: boolean;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to manage expansion state and actions
 */
function useExpansion() {
  const expansionPath = useComposedStore((s) => s.commandPalette.expansionPath);
  const expandTile = useComposedStore((s) => s.expandTile);
  const collapseTile = useComposedStore((s) => s.collapseTile);
  const collapseAll = useComposedStore((s) => s.collapseAll);
  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const openInspectorPanel = useComposedStore((s) => s.openInspectorPanel);

  const currentLevel = expansionPath.length;
  const currentExpansion = expansionPath[expansionPath.length - 1] || null;

  /**
   * Handle tile click - expand if possible, or open inspector if terminal
   */
  const handleTileClick = useCallback(
    (item: TileItem, siblings: TileItem[]) => {
      const services = getPluginServices();
      if (!services) return;

      // Check if item has an execute function (commands)
      const execute = item.metadata?.execute as ((services: unknown) => Promise<void>) | undefined;
      if (execute) {
        execute(services);
        closeCommandPalette();
        return;
      }

      // Get provider for this item
      const providerId = item.metadata?.providerId as string | undefined;
      if (!providerId) {
        openInspectorPanel();
        closeCommandPalette();
        return;
      }

      const tileProviders = pluginRegistry.getAllTileProviders();
      const providerEntry = tileProviders.find((p) => p.pluginId === providerId);
      if (!providerEntry) {
        openInspectorPanel();
        closeCommandPalette();
        return;
      }

      const { provider } = providerEntry;

      // Check if tile can be expanded
      const canExpand = provider.canExpand?.(item) ?? false;

      if (canExpand && currentLevel < 2) {
        // Get children for this tile
        const children = provider.getChildItems?.(item, services) ?? [];

        if (children.length > 0) {
          // Expand the tile
          expandTile(item, children, siblings, providerId);
          return;
        }
      }

      // Terminal: open inspector and close
      if (item.metadata?.isIssue) {
        // Issue tile - open inspector with issue details
        openInspectorPanel();
        closeCommandPalette();
      } else if (item.metadata?.isFile) {
        // File tile at terminal state
        openInspectorPanel();
        closeCommandPalette();
      } else {
        // Fallback
        openInspectorPanel();
        closeCommandPalette();
      }
    },
    [currentLevel, expandTile, closeCommandPalette, openInspectorPanel]
  );

  /**
   * Handle back/collapse action
   */
  const handleBack = useCallback(() => {
    if (currentLevel > 0) {
      collapseTile();
    }
  }, [currentLevel, collapseTile]);

  /**
   * Handle sibling click from collapsed strip
   */
  const handleSiblingClick = useCallback(
    (sibling: TileItem) => {
      const services = getPluginServices();
      if (!services) return;

      // Get the current expansion's siblings (including the currently expanded one)
      const currentSiblings = currentExpansion
        ? [...currentExpansion.siblings, currentExpansion.item]
        : [];

      // Collapse current and expand the clicked sibling
      collapseTile();

      // Small delay to allow collapse animation
      setTimeout(() => {
        handleTileClick(sibling, currentSiblings);
      }, 50);
    },
    [currentExpansion, collapseTile, handleTileClick]
  );

  return {
    expansionPath,
    currentLevel,
    currentExpansion,
    handleTileClick,
    handleBack,
    handleSiblingClick,
    collapseAll,
  };
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Renders the expanded tile content with header and children
 */
function ExpandedTileContent({
  expansion,
  nestedExpansion,
  onBack,
  onChildClick,
  onSiblingClick,
  selectedIndex,
}: {
  expansion: ExpandedTile;
  nestedExpansion: ExpandedTile | null;
  onBack: () => void;
  onChildClick: (item: TileItem) => void;
  onSiblingClick: (item: TileItem) => void;
  selectedIndex: number;
}) {
  return (
    <motion.div
      variants={expansionWrapperVariants}
      initial="collapsed"
      animate="expanded"
      exit="collapsed"
      transition={expansionWrapperTransition}
      className={cn(
        "rounded-2xl",
        "border border-foreground/[0.06]",
        "bg-background/40 backdrop-blur-sm",
        "overflow-hidden"
      )}
    >
      {/* Header with back button */}
      <ExpandedTileHeader
        item={expansion.item}
        onBack={onBack}
        level={expansion.level}
      />

      {/* Content: either nested expansion or children grid */}
      <motion.div
        variants={childrenContainerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="p-3"
      >
        {nestedExpansion ? (
          // Render nested expanded tile recursively
          <ExpandedTileContent
            expansion={nestedExpansion}
            nestedExpansion={null}
            onBack={onBack}
            onChildClick={onChildClick}
            onSiblingClick={onSiblingClick}
            selectedIndex={selectedIndex}
          />
        ) : (
          // Render children as a tile grid
          <TileGrid
            items={expansion.children}
            onTileClick={(item) => onChildClick(item)}
            selectedIndex={selectedIndex}
            isTerminal={expansion.level >= 1}
          />
        )}
      </motion.div>

      {/* Collapsed siblings strip */}
      {expansion.siblings.length > 0 && !nestedExpansion && (
        <CollapsedTileStrip
          tiles={expansion.siblings}
          onTileClick={onSiblingClick}
          level={expansion.level}
          className="border-t border-foreground/[0.04]"
        />
      )}
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ExpandableTileGrid({
  items,
  selectedIndex,
  onTileClick,
  isTerminal = false,
}: ExpandableTileGridProps) {
  const {
    expansionPath,
    currentLevel,
    currentExpansion,
    handleTileClick,
    handleBack,
    handleSiblingClick,
  } = useExpansion();

  // Get nested expansion if level > 1
  const nestedExpansion = expansionPath.length > 1
    ? expansionPath[expansionPath.length - 1]
    : null;

  const parentExpansion = expansionPath.length > 1
    ? expansionPath[expansionPath.length - 2]
    : currentExpansion;

  /**
   * Handle tile click at the current level
   */
  const onTileClickInternal = useCallback(
    (item: TileItem) => {
      handleTileClick(item, items);
      onTileClick?.(item, currentLevel);
    },
    [handleTileClick, items, onTileClick, currentLevel]
  );

  /**
   * Handle child tile click (within expanded tile)
   */
  const onChildClick = useCallback(
    (item: TileItem) => {
      const siblings = currentExpansion?.children ?? [];
      handleTileClick(item, siblings);
      onTileClick?.(item, currentLevel + 1);
    },
    [handleTileClick, currentExpansion, onTileClick, currentLevel]
  );

  return (
    <div className="relative">
      <AnimatePresence mode="popLayout">
        {currentLevel === 0 ? (
          // Root level: show standard tile grid
          <motion.div
            key="root-grid"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15, ease: crispEase }}
          >
            <TileGrid
              items={items}
              onTileClick={onTileClickInternal}
              selectedIndex={selectedIndex}
              isTerminal={isTerminal}
            />
          </motion.div>
        ) : parentExpansion ? (
          // Expanded state: show expanded tile content
          <motion.div
            key={`expanded-${parentExpansion.item.id}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: crispEase }}
            className="p-4"
          >
            <ExpandedTileContent
              expansion={parentExpansion}
              nestedExpansion={nestedExpansion}
              onBack={handleBack}
              onChildClick={onChildClick}
              onSiblingClick={handleSiblingClick}
              selectedIndex={selectedIndex}
            />

            {/* Root-level collapsed strip (if we're at level 1+) */}
            {expansionPath.length === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.2 }}
                className="mt-3"
              >
                <CollapsedTileStrip
                  tiles={items.filter((t) => t.id !== parentExpansion.item.id)}
                  onTileClick={(tile) => {
                    handleBack();
                    setTimeout(() => handleTileClick(tile, items), 50);
                  }}
                  level={0}
                />
              </motion.div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export type { ExpandableTileGridProps };
