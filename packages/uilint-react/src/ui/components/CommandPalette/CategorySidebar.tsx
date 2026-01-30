/**
 * CategorySidebar - Finder-style category navigation for command palette
 *
 * Design principles:
 * - Narrow, subtle sidebar (110px)
 * - Muted colors, minimal visual weight
 * - Categories with zero items are hidden
 * - Glassmorphic styling with shadcn conventions
 * - Visual hierarchy through opacity/weight, not color
 */

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../../lib/utils";
import type { CategoryNode } from "../../../core/plugin-system/category-registry";

// ============================================================================
// Variants
// ============================================================================

const sidebarVariants = cva(
  "shrink-0 py-2 border-r overflow-y-auto overflow-x-hidden",
  {
    variants: {
      size: {
        default: "w-28",
        compact: "w-24",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const sidebarItemVariants = cva(
  "flex items-center justify-between mx-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer select-none",
  {
    variants: {
      state: {
        default: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        selected: "bg-muted text-foreground",
        loading: "text-muted-foreground/50",
      },
    },
    defaultVariants: {
      state: "default",
    },
  }
);

const sidebarGroupVariants = cva(
  "mx-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
  {
    variants: {
      state: {
        default: "text-muted-foreground/50",
        expanded: "text-muted-foreground/70",
      },
    },
    defaultVariants: {
      state: "default",
    },
  }
);

// ============================================================================
// Animation variants
// ============================================================================

const itemMotionVariants = {
  initial: { opacity: 0, x: -4 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -4 },
};

const countMotionVariants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
};

// Crisp easing
const crispEase = [0.32, 0.72, 0, 1] as const;

// ============================================================================
// Types
// ============================================================================

export interface CategorySidebarProps extends VariantProps<typeof sidebarVariants> {
  /** Category tree from registry */
  categories: CategoryNode[];
  /** Currently selected category ID (null = "All") */
  selectedId: string | null;
  /** Callback when category is selected */
  onSelect: (categoryId: string | null) => void;
  /** Whether sidebar has keyboard focus */
  isFocused?: boolean;
  /** Additional class name */
  className?: string;
}

interface SidebarItemProps {
  category: CategoryNode;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}

interface SidebarGroupProps {
  label: string;
  children: CategoryNode[];
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  startIndex: number;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Loading skeleton for sidebar items
 */
function ItemSkeleton() {
  return (
    <div
      className={cn(sidebarItemVariants({ state: "loading" }))}
      style={{ height: 28 }}
    >
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        style={{
          width: "60%",
          height: 10,
          borderRadius: 4,
          background: "var(--uilint-text-muted)",
          opacity: 0.2,
        }}
      />
    </div>
  );
}

/**
 * Count badge for sidebar items
 */
function CountBadge({ count, isLoading }: { count?: number; isLoading: boolean }) {
  if (isLoading) {
    return (
      <motion.div
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 1, repeat: Infinity }}
        style={{
          width: 16,
          height: 10,
          borderRadius: 4,
          background: "var(--uilint-text-muted)",
          opacity: 0.15,
        }}
      />
    );
  }

  if (count === undefined) return null;

  return (
    <motion.span
      variants={countMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.15, ease: crispEase }}
      className="text-[10px] tabular-nums text-muted-foreground/60"
    >
      {count}
    </motion.span>
  );
}

/**
 * Individual sidebar item
 */
function SidebarItem({ category, isSelected, onClick, index }: SidebarItemProps) {
  const state = category.isLoading ? "loading" : isSelected ? "selected" : "default";

  return (
    <motion.div
      variants={itemMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.1, delay: index * 0.02, ease: crispEase }}
    >
      <div
        className={cn(sidebarItemVariants({ state }))}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        style={{
          borderLeft: isSelected
            ? "2px solid var(--uilint-accent)"
            : "2px solid transparent",
          paddingLeft: isSelected ? 8 : 10,
        }}
      >
        <span className="truncate">{category.label}</span>
        <CountBadge count={category.count} isLoading={category.isLoading} />
      </div>
    </motion.div>
  );
}

/**
 * Group of sidebar items under a plugin
 */
function SidebarGroup({
  label,
  children,
  selectedId,
  onSelect,
  startIndex,
}: SidebarGroupProps) {
  // Calculate total count for group
  const totalCount = children.reduce((sum, c) => sum + (c.count ?? 0), 0);
  const isAnyLoading = children.some((c) => c.isLoading);

  return (
    <div className="mb-1">
      {/* Group header */}
      <div className={cn(sidebarGroupVariants({ state: "default" }))}>
        <span className="truncate">{label}</span>
        {!isAnyLoading && totalCount > 0 && (
          <span className="ml-1 opacity-50">({totalCount})</span>
        )}
      </div>

      {/* Group items */}
      <AnimatePresence mode="popLayout">
        {children.map((category, index) => (
          <SidebarItem
            key={category.id}
            category={category}
            isSelected={selectedId === category.id}
            onClick={() => onSelect(category.id)}
            index={startIndex + index}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * "All" category item - always shown at top
 */
function AllCategoryItem({
  isSelected,
  onClick,
  totalCount,
}: {
  isSelected: boolean;
  onClick: () => void;
  totalCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.1 }}
    >
      <div
        className={cn(sidebarItemVariants({ state: isSelected ? "selected" : "default" }))}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        style={{
          borderLeft: isSelected
            ? "2px solid var(--uilint-accent)"
            : "2px solid transparent",
          paddingLeft: isSelected ? 8 : 10,
          fontWeight: 500,
        }}
      >
        <span>All</span>
        {totalCount > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground/60">
            {totalCount}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Divider between sections
 */
function SidebarDivider() {
  return (
    <div
      className="mx-3 my-1.5"
      style={{
        height: 1,
        background: "var(--uilint-border)",
        opacity: 0.3,
      }}
    />
  );
}

/**
 * CategorySidebar - Main component
 *
 * @example
 * ```tsx
 * <CategorySidebar
 *   categories={categoryTree}
 *   selectedId={selectedCategoryId}
 *   onSelect={setSelectedCategory}
 * />
 * ```
 */
export function CategorySidebar({
  categories,
  selectedId,
  onSelect,
  isFocused = false,
  size,
  className,
}: CategorySidebarProps) {
  // Calculate total count across all categories
  const totalCount = React.useMemo(() => {
    let count = 0;
    for (const category of categories) {
      if (category.children) {
        count += category.children.reduce((sum, c) => sum + (c.count ?? 0), 0);
      } else {
        count += category.count ?? 0;
      }
    }
    return count;
  }, [categories]);

  // Separate top-level items from plugin groups
  const { topLevel, groups } = React.useMemo(() => {
    const topLevel: CategoryNode[] = [];
    const groups: CategoryNode[] = [];

    for (const node of categories) {
      if (node.children && node.children.length > 0) {
        groups.push(node);
      } else if (!node.parentId) {
        topLevel.push(node);
      }
    }

    return { topLevel, groups };
  }, [categories]);

  // Track item indices for staggered animation
  let itemIndex = 1; // Start at 1 (after "All")

  return (
    <div
      className={cn(sidebarVariants({ size }), className)}
      style={{
        borderColor: "var(--uilint-border)",
        opacity: isFocused ? 1 : 0.85,
        transition: "opacity 0.15s ease",
      }}
      role="navigation"
      aria-label="Category navigation"
    >
      {/* "All" category - always first */}
      <AllCategoryItem
        isSelected={selectedId === null}
        onClick={() => onSelect(null)}
        totalCount={totalCount}
      />

      {/* Divider if there are other categories */}
      {(topLevel.length > 0 || groups.length > 0) && <SidebarDivider />}

      {/* Top-level categories (not in a group) */}
      <AnimatePresence mode="popLayout">
        {topLevel.map((category) => {
          const idx = itemIndex++;
          return (
            <SidebarItem
              key={category.id}
              category={category}
              isSelected={selectedId === category.id}
              onClick={() => onSelect(category.id)}
              index={idx}
            />
          );
        })}
      </AnimatePresence>

      {/* Plugin groups */}
      {groups.map((group) => {
        const startIdx = itemIndex;
        itemIndex += group.children?.length ?? 0;
        return (
          <SidebarGroup
            key={group.id}
            label={group.label}
            children={group.children ?? []}
            selectedId={selectedId}
            onSelect={onSelect}
            startIndex={startIdx}
          />
        );
      })}

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="px-3 py-4 text-center">
          <div className="text-[10px] text-muted-foreground/50">
            No categories
          </div>
        </div>
      )}
    </div>
  );
}

export { sidebarVariants, sidebarItemVariants };
