/**
 * TreemapGrid - Zoomable treemap orchestrator
 *
 * Main component that replaces ExpandableTileGrid with a treemap-based
 * visualization. Manages zoom state and renders cells with crossfade
 * transitions between zoom levels.
 *
 * Three visual states:
 * - Root view: All items as treemap cells
 * - Zoomed view: ContextStrip at top + zoomed content below
 * - Custom content: renderZoomedContent callback for deep views
 */
import React, { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import { calculateTreemapLayout } from "./layout/treemap-layout";
import type { TreemapItem } from "./layout/treemap-layout";
import { TreemapCell } from "./TreemapCell";
import { ContextStrip, type ContextStripItem } from "./ContextStrip";
import type { BaseTileItem } from "./TileGrid";
import {
  rootTreemapVariants,
  zoomedViewVariants,
  zoomTransition,
} from "./animations/treemap-animations";

// ============================================================================
// Types
// ============================================================================

export interface TreemapGridProps<T extends BaseTileItem> {
  /** Root-level items (rules) */
  items: T[];
  /** ID of the zoomed item, or null */
  zoomedId: string | null;
  /** Children to show inside the zoomed item */
  zoomedChildren: T[];
  /** Available width for the treemap */
  availableWidth: number;
  /** Available height for the treemap */
  availableHeight: number;
  /** Callback when a root cell is clicked */
  onCellClick: (item: T) => void;
  /** Callback when a child cell is clicked */
  onChildClick: (item: T) => void;
  /** Callback when back/zoom-out is triggered */
  onBack: () => void;
  /** Custom render for zoomed content (replaces default child treemap) */
  renderZoomedContent?: (
    item: T,
    children: T[],
    availableWidth: number,
    availableHeight: number
  ) => React.ReactNode;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_HEIGHT = 200;
const CONTEXT_STRIP_HEIGHT = 44;
const TREEMAP_GAP = 2;

// ============================================================================
// Sub-components
// ============================================================================

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center justify-center py-16 px-8 text-center"
    >
      <div className="mb-4 opacity-30">
        <Sparkles size={28} strokeWidth={1.5} />
      </div>
      <div className="text-sm font-normal text-foreground/60 mb-1">
        No items to display
      </div>
      <div className="text-xs text-muted-foreground/70">
        Try adjusting your filters or search query
      </div>
    </motion.div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function toTreemapItems(items: BaseTileItem[]): TreemapItem[] {
  return items.map((item) => ({
    id: item.id,
    value: item.count,
    label: item.label,
  }));
}

function toContextStripItems(items: BaseTileItem[]): ContextStripItem[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    count: item.count,
    severityCounts: item.severityCounts,
  }));
}

// ============================================================================
// Main Component
// ============================================================================

export function TreemapGrid<T extends BaseTileItem>({
  items,
  zoomedId,
  zoomedChildren,
  availableWidth,
  availableHeight,
  onCellClick,
  onChildClick,
  onBack,
  renderZoomedContent,
}: TreemapGridProps<T>) {
  // Find zoomed item
  const zoomedItem = useMemo(
    () => items.find((item) => item.id === zoomedId) ?? null,
    [items, zoomedId]
  );

  // Calculate root treemap layout
  const rootLayout = useMemo(() => {
    const height = Math.max(MIN_HEIGHT, availableHeight);
    return calculateTreemapLayout(toTreemapItems(items), {
      width: availableWidth,
      height,
      gap: TREEMAP_GAP,
    });
  }, [items, availableWidth, availableHeight]);

  // Calculate children treemap layout (when zoomed)
  const childrenLayout = useMemo(() => {
    if (!zoomedId || zoomedChildren.length === 0) return null;
    const childHeight = Math.max(
      MIN_HEIGHT,
      availableHeight - CONTEXT_STRIP_HEIGHT
    );
    return calculateTreemapLayout(toTreemapItems(zoomedChildren), {
      width: availableWidth,
      height: childHeight,
      gap: TREEMAP_GAP,
    });
  }, [zoomedId, zoomedChildren, availableWidth, availableHeight]);

  // Context strip items
  const stripItems = useMemo(() => toContextStripItems(items), [items]);

  // Handle empty state
  if (items.length === 0) {
    return <EmptyState />;
  }

  const height = Math.max(MIN_HEIGHT, availableHeight);

  return (
    <div
      className="relative"
      style={{
        width: availableWidth,
        height,
        minHeight: MIN_HEIGHT,
      }}
    >
      <AnimatePresence mode="wait">
        {/* ============================================================= */}
        {/* State A: Root treemap (no zoom) */}
        {/* ============================================================= */}
        {!zoomedId && (
          <motion.div
            key="root-treemap"
            variants={rootTreemapVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={zoomTransition}
            className="absolute inset-0"
          >
            {items.map((item, index) => {
              const cell = rootLayout.cells.get(item.id);
              if (!cell) return null;

              return (
                <TreemapCell
                  key={item.id}
                  id={item.id}
                  label={item.label}
                  subtitle={item.subtitle}
                  count={item.count}
                  fileCount={item.fileCount}
                  severityCounts={item.severityCounts}
                  x={cell.x}
                  y={cell.y}
                  width={cell.width}
                  height={cell.height}
                  areaFraction={cell.areaFraction}
                  index={index}
                  onClick={() => onCellClick(item)}
                />
              );
            })}
          </motion.div>
        )}

        {/* ============================================================= */}
        {/* State B: Zoomed view (ContextStrip + content) */}
        {/* ============================================================= */}
        {zoomedId && zoomedItem && (
          <motion.div
            key={`zoomed-${zoomedId}`}
            variants={zoomedViewVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={zoomTransition}
            className="absolute inset-0 flex flex-col"
          >
            {/* Context strip - sibling navigation */}
            <ContextStrip
              items={stripItems}
              activeId={zoomedId}
              onItemClick={(id) => {
                if (id === zoomedId) {
                  onBack();
                } else {
                  // Switch to different sibling
                  const target = items.find((item) => item.id === id);
                  if (target) onCellClick(target);
                }
              }}
            />

            {/* Zoomed content area */}
            <div className="flex-1 relative overflow-hidden">
              {renderZoomedContent ? (
                renderZoomedContent(
                  zoomedItem,
                  zoomedChildren,
                  availableWidth,
                  height - CONTEXT_STRIP_HEIGHT
                )
              ) : childrenLayout ? (
                /* Default: child treemap */
                zoomedChildren.map((child, index) => {
                  const cell = childrenLayout.cells.get(child.id);
                  if (!cell) return null;

                  return (
                    <TreemapCell
                      key={child.id}
                      id={child.id}
                      label={child.label}
                      subtitle={child.subtitle}
                      count={child.count}
                      fileCount={child.fileCount}
                      severityCounts={child.severityCounts}
                      x={cell.x}
                      y={cell.y}
                      width={cell.width}
                      height={cell.height}
                      areaFraction={cell.areaFraction}
                      index={index}
                      onClick={() => onChildClick(child)}
                    />
                  );
                })
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
