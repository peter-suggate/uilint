/**
 * ExpandableTile - Tile that can expand to show children
 *
 * This is the core component for the expandable tile UI redesign.
 * It wraps the standard Tile component and adds expansion capability.
 *
 * States:
 * - normal: Standard tile in the grid
 * - expanded: Currently expanded, showing children inside
 * - collapsed-sibling: Sibling of an expanded tile (shown in strip)
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import type { TileItem, TileBucket, TileVisualState } from "../../../core/plugin-system/types";
import { Tile } from "../HierarchicalTiles/Tile";
import { ExpandedTileHeader } from "./ExpandedTileHeader";
import { RuleScaleIcon, FileCodeIcon } from "../../icons";
import type { TileType } from "../../../plugins/eslint/tile-provider";

/**
 * Get icon element for a tile based on its type metadata
 */
function getTileIcon(item: TileItem, bucket: TileBucket): React.ReactNode {
  const tileType = item.metadata?.tileType as TileType | undefined;
  const size = bucket === "xl" ? 24 : bucket === "lg" ? 22 : bucket === "md" ? 18 : bucket === "sm" ? 16 : 14;

  if (tileType === "rule") {
    return <RuleScaleIcon size={size} className="text-muted-foreground/50 shrink-0" />;
  }
  if (tileType === "file") {
    return <FileCodeIcon size={size} className="text-muted-foreground/50 shrink-0" />;
  }
  return undefined;
}
import { CollapsedTileStrip } from "./CollapsedTileStrip";
import {
  tileContainerVariants,
  tileContainerTransition,
  expansionWrapperVariants,
  expansionWrapperTransition,
  childrenContainerVariants,
  layoutTransition,
  getStaggerDelay,
} from "../HierarchicalTiles/animations";

// ============================================================================
// Types
// ============================================================================

interface ExpandableTileProps {
  /** The tile item to display */
  item: TileItem;
  /** Size bucket for the tile */
  bucket: TileBucket;
  /** Whether this tile is selected (keyboard navigation) */
  isSelected: boolean;
  /** Visual state of the tile */
  visualState: TileVisualState;
  /** Children tiles when expanded */
  children?: TileItem[];
  /** Sibling tiles (for collapsed strip when this is expanded) */
  siblings?: TileItem[];
  /** Nested expanded tile (for deeper levels) */
  nestedExpanded?: {
    item: TileItem;
    children: TileItem[];
    siblings: TileItem[];
  } | null;
  /** Callback when tile is clicked (to expand or select) */
  onClick: () => void;
  /** Callback when back button is clicked (to collapse) */
  onBack?: () => void;
  /** Callback when a child tile is clicked */
  onChildClick?: (child: TileItem) => void;
  /** Callback when a sibling tile is clicked (from collapsed strip) */
  onSiblingClick?: (sibling: TileItem) => void;
  /** Animation index for stagger effect */
  animIndex?: number;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Expanded content container with header and children grid
 */
function ExpandedContent({
  item,
  children,
  siblings,
  nestedExpanded,
  onBack,
  onChildClick,
  onSiblingClick,
}: {
  item: TileItem;
  children: TileItem[];
  siblings: TileItem[];
  nestedExpanded?: ExpandableTileProps["nestedExpanded"];
  onBack: () => void;
  onChildClick: (child: TileItem) => void;
  onSiblingClick: (sibling: TileItem) => void;
}) {
  return (
    <motion.div
      variants={expansionWrapperVariants}
      initial="collapsed"
      animate="expanded"
      exit="collapsed"
      transition={expansionWrapperTransition}
      className={cn(
        "w-full",
        "rounded-2xl",
        "border border-foreground/[0.06]",
        "bg-background/40 backdrop-blur-sm",
        "overflow-hidden"
      )}
    >
      {/* Header with back button */}
      <ExpandedTileHeader item={item} onBack={onBack} />

      {/* Children grid or nested expansion */}
      <motion.div
        variants={childrenContainerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="p-3"
      >
        {nestedExpanded ? (
          // Render nested expanded tile
          <ExpandableTile
            item={nestedExpanded.item}
            bucket="lg"
            isSelected={false}
            visualState="nested-expanded"
            children={nestedExpanded.children}
            siblings={nestedExpanded.siblings}
            onClick={() => {}}
            onBack={onBack}
            onChildClick={onChildClick}
            onSiblingClick={onSiblingClick}
          />
        ) : (
          // Render children as a mini grid
          <ChildrenGrid
            items={children}
            onTileClick={onChildClick}
          />
        )}
      </motion.div>

      {/* Collapsed siblings strip */}
      {siblings.length > 0 && !nestedExpanded && (
        <CollapsedTileStrip
          tiles={siblings}
          onTileClick={onSiblingClick}
          className="border-t border-foreground/[0.04]"
        />
      )}
    </motion.div>
  );
}

/**
 * Mini grid for children within an expanded tile
 */
function ChildrenGrid({
  items,
  onTileClick,
}: {
  items: TileItem[];
  onTileClick: (item: TileItem) => void;
}) {
  // Simple responsive grid for children
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.2,
              delay: getStaggerDelay(index),
            }}
          >
            <ChildTile item={item} onClick={() => onTileClick(item)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Simplified tile for children within expanded parent
 */
function ChildTile({
  item,
  onClick,
}: {
  item: TileItem;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-full p-3 rounded-xl text-left",
        "bg-foreground/[0.02] hover:bg-foreground/[0.04]",
        "border border-foreground/[0.04] hover:border-foreground/[0.08]",
        "transition-colors duration-150",
        "cursor-pointer"
      )}
    >
      <div className="flex flex-col gap-1">
        {/* Label */}
        <span className="text-sm font-normal text-foreground truncate">
          {item.label}
        </span>
        {/* Subtitle if present */}
        {item.subtitle && (
          <span className="text-xs text-muted-foreground/60 truncate">
            {item.subtitle}
          </span>
        )}
        {/* Count */}
        <span className="text-lg font-extralight text-foreground/60 tabular-nums">
          {item.count}
        </span>
      </div>
    </motion.button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ExpandableTile({
  item,
  bucket,
  isSelected,
  visualState,
  children = [],
  siblings = [],
  nestedExpanded,
  onClick,
  onBack,
  onChildClick,
  onSiblingClick,
}: ExpandableTileProps) {
  const isExpanded = visualState === "expanded" || visualState === "nested-expanded";
  const isCollapsedSibling = visualState === "collapsed-sibling";

  // For collapsed siblings, render minimal version
  if (isCollapsedSibling) {
    return null; // Collapsed siblings are rendered in the strip, not individually
  }

  // For expanded tiles, render the expanded content
  if (isExpanded && children.length > 0) {
    return (
      <motion.div
        layout
        layoutId={`expandable-${item.id}`}
        transition={layoutTransition}
        className="w-full"
      >
        <ExpandedContent
          item={item}
          children={children}
          siblings={siblings}
          nestedExpanded={nestedExpanded}
          onBack={onBack || (() => {})}
          onChildClick={onChildClick || (() => {})}
          onSiblingClick={onSiblingClick || (() => {})}
        />
      </motion.div>
    );
  }

  // For normal tiles, render the standard tile
  return (
    <motion.div
      layout
      layoutId={`expandable-${item.id}`}
      variants={tileContainerVariants}
      initial="normal"
      animate="normal"
      exit="exit"
      transition={tileContainerTransition}
    >
      <Tile
        id={item.id}
        label={item.label}
        subtitle={item.subtitle}
        icon={getTileIcon(item, bucket)}
        count={item.count}
        fileCount={item.fileCount}
        bucket={bucket}
        isSelected={isSelected}
        onClick={onClick}
      />
    </motion.div>
  );
}

export type { ExpandableTileProps };
