/**
 * ExpandableContainer - Generic expandable container for hierarchical tiles
 *
 * A reusable container component that handles the expansion/collapse behavior
 * for hierarchical tile structures. When collapsed, it renders the tile content.
 * When expanded, it shows a glassmorphic container with header, children, and
 * optional sibling strip.
 *
 * @template T - The type of the data payload in hierarchy nodes
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import type { ExpandableContainerProps, HierarchyNode } from "./types";
import { TileHeader } from "./TileHeader";
import { SiblingStrip } from "./SiblingStrip";
import {
  expansionWrapperVariants,
  childrenContainerVariants,
  getStaggerDelay,
  crispEase,
  DURATIONS,
} from "./animations/expansion-animations";

// ============================================================================
// Types
// ============================================================================

/**
 * Extended props for ExpandableContainer including className
 */
interface ExpandableContainerPropsWithClassName<T>
  extends ExpandableContainerProps<T> {
  /** Additional CSS class names */
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Default children grid when no custom renderChildren is provided
 */
function DefaultChildrenGrid<T>({
  children,
  layout,
  onChildClick,
}: {
  children: HierarchyNode<T>[];
  layout: "grid" | "list" | "masonry";
  onChildClick?: (node: HierarchyNode<T>) => void;
}) {
  const gridClassName = cn(
    layout === "list"
      ? "flex flex-col gap-2"
      : layout === "masonry"
        ? "columns-2 sm:columns-3 gap-2"
        : "grid grid-cols-2 sm:grid-cols-3 gap-2"
  );

  return (
    <div className={gridClassName}>
      <AnimatePresence mode="popLayout">
        {children.map((child, index) => (
          <motion.div
            key={child.id}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.2,
              delay: getStaggerDelay(index),
              ease: crispEase,
            }}
            className={layout === "masonry" ? "break-inside-avoid mb-2" : ""}
          >
            <DefaultChildTile node={child} onClick={() => onChildClick?.(child)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Default tile for children within expanded container
 */
function DefaultChildTile<T>({
  node,
  onClick,
}: {
  node: HierarchyNode<T>;
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
        {/* Icon if present */}
        {node.icon && (
          <div className="text-muted-foreground mb-1">{node.icon}</div>
        )}
        {/* Label */}
        <span className="text-sm font-normal text-foreground truncate">
          {node.label}
        </span>
        {/* Subtitle if present */}
        {node.subtitle && (
          <span className="text-xs text-muted-foreground/60 truncate">
            {node.subtitle}
          </span>
        )}
        {/* Count */}
        {node.count !== undefined && (
          <span className="text-lg font-extralight text-foreground/60 tabular-nums">
            {node.count}
          </span>
        )}
      </div>
    </motion.button>
  );
}

/**
 * Expanded content with header, children area, and optional sibling strip
 */
function ExpandedContent<T>({
  node,
  onCollapse,
  siblings,
  onSiblingClick,
  renderHeader,
  renderChildren,
  layout = "grid",
  showSiblingStrip = true,
  className,
}: {
  node: HierarchyNode<T>;
  onCollapse: () => void;
  siblings?: HierarchyNode<T>[];
  onSiblingClick?: (node: HierarchyNode<T>) => void;
  renderHeader?: (node: HierarchyNode<T>) => React.ReactNode;
  renderChildren?: (node: HierarchyNode<T>) => React.ReactNode;
  layout?: "grid" | "list" | "masonry";
  showSiblingStrip?: boolean;
  className?: string;
}) {
  const hasCustomChildren = !!renderChildren;
  const hasChildNodes = node.children && node.children.length > 0;
  const hasSiblings = siblings && siblings.length > 0;

  return (
    <motion.div
      variants={expansionWrapperVariants}
      initial="collapsed"
      animate="expanded"
      exit="collapsed"
      transition={{ duration: DURATIONS.expand, ease: crispEase }}
      className={cn(
        "w-full",
        "rounded-2xl",
        "border border-foreground/[0.06]",
        "bg-background/40 backdrop-blur-sm",
        "overflow-hidden",
        className
      )}
    >
      {/* Header - custom or default TileHeader */}
      {renderHeader ? (
        renderHeader(node)
      ) : (
        <TileHeader
          label={node.label}
          subtitle={node.subtitle}
          icon={node.icon}
          count={node.count}
          onBack={onCollapse}
        />
      )}

      {/* Children area */}
      <motion.div
        variants={childrenContainerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="p-3"
      >
        {hasCustomChildren ? (
          // Custom children renderer (e.g., FileSourceView for leaf nodes)
          renderChildren(node)
        ) : hasChildNodes ? (
          // Default grid of child tiles
          <DefaultChildrenGrid
            children={node.children!}
            layout={layout}
            onChildClick={onSiblingClick}
          />
        ) : (
          // Empty state when no children
          <div className="text-sm text-muted-foreground/60 text-center py-4">
            No children to display
          </div>
        )}
      </motion.div>

      {/* Optional sibling strip */}
      {showSiblingStrip && hasSiblings && onSiblingClick && (
        <SiblingStrip
          items={siblings}
          onItemClick={onSiblingClick}
          className="border-t border-foreground/[0.04]"
        />
      )}
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ExpandableContainer - Generic container for expandable hierarchical tiles
 *
 * Handles the expansion/collapse behavior and rendering for hierarchical
 * tile structures. Supports custom renderers for header, children, and tiles.
 *
 * @template T - The type of the data payload in hierarchy nodes
 *
 * @example
 * ```tsx
 * <ExpandableContainer
 *   node={categoryNode}
 *   isExpanded={expandedId === categoryNode.id}
 *   onExpand={() => setExpandedId(categoryNode.id)}
 *   onCollapse={() => setExpandedId(null)}
 *   siblings={siblingCategories}
 *   onSiblingClick={(sibling) => setExpandedId(sibling.id)}
 *   renderTile={(node) => <CategoryTile node={node} />}
 * />
 * ```
 */
export function ExpandableContainer<T>({
  node,
  isExpanded,
  onExpand,
  onCollapse,
  siblings,
  onSiblingClick,
  renderHeader,
  renderChildren,
  renderTile,
  layout = "grid",
  showSiblingStrip = true,
  className,
}: ExpandableContainerPropsWithClassName<T>) {
  // When expanded, render the expanded content
  if (isExpanded) {
    return (
      <motion.div
        layout
        layoutId={`expandable-container-${node.id}`}
        transition={{ duration: 0.25, ease: crispEase }}
        className="w-full"
      >
        <ExpandedContent
          node={node}
          onCollapse={onCollapse}
          siblings={siblings}
          onSiblingClick={onSiblingClick}
          renderHeader={renderHeader}
          renderChildren={renderChildren}
          layout={layout}
          showSiblingStrip={showSiblingStrip}
          className={className}
        />
      </motion.div>
    );
  }

  // When not expanded, render the tile content
  return (
    <motion.div
      layout
      layoutId={`expandable-container-${node.id}`}
      transition={{ duration: 0.25, ease: crispEase }}
      className={className}
    >
      {renderTile ? (
        // Custom tile renderer
        renderTile(node)
      ) : (
        // Default clickable tile
        <motion.button
          onClick={onExpand}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "w-full p-4 rounded-xl text-left",
            "bg-foreground/[0.02] hover:bg-foreground/[0.04]",
            "border border-foreground/[0.04] hover:border-foreground/[0.08]",
            "transition-colors duration-150",
            "cursor-pointer"
          )}
        >
          <div className="flex flex-col gap-1">
            {node.icon && (
              <div className="text-muted-foreground mb-1">{node.icon}</div>
            )}
            <span className="text-base font-medium text-foreground truncate">
              {node.label}
            </span>
            {node.subtitle && (
              <span className="text-sm text-muted-foreground/70 truncate">
                {node.subtitle}
              </span>
            )}
            {node.count !== undefined && (
              <span className="text-2xl font-extralight text-foreground/60 tabular-nums mt-1">
                {node.count}
              </span>
            )}
          </div>
        </motion.button>
      )}
    </motion.div>
  );
}

export type { ExpandableContainerPropsWithClassName as ExpandableContainerComponentProps };
