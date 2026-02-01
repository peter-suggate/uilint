/**
 * CategorySidebar - Finder-style category navigation for command palette
 *
 * Design principles:
 * - Narrow, subtle sidebar (110px)
 * - Muted colors, minimal visual weight
 * - Categories with zero items are hidden
 * - Glassmorphic styling with shadcn conventions
 * - Visual hierarchy through opacity/weight, not color
 * - Multi-select support with checkbox-style toggles
 */

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../../lib/utils";
import type { CategoryNode } from "../../../core/store/category-slice";

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
        // Multi-select states
        checked: "", // Styles applied via inline styles for accent color
        unchecked: "", // Muted/grayed out state
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

const checkboxMotionVariants = {
  checked: { scale: 1, opacity: 1 },
  unchecked: { scale: 0.8, opacity: 0 },
};

// Crisp easing
const crispEase = [0.32, 0.72, 0, 1] as const;

// ============================================================================
// Types
// ============================================================================

export interface CategorySidebarProps extends VariantProps<typeof sidebarVariants> {
  /** Category tree from registry */
  categories: CategoryNode[];
  /** Currently selected category ID (null = "All") - used for single-select mode */
  selectedId: string | null;
  /** Callback when category is selected - used for single-select mode */
  onSelect: (categoryId: string | null) => void;
  /** Set of currently selected category IDs for multi-select mode */
  selectedCategoryIds?: Set<string>;
  /** Callback when a category is toggled in multi-select mode */
  onToggleCategory?: (categoryId: string) => void;
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
  /** Whether this item is in multi-select mode */
  isMultiSelect?: boolean;
  /** Whether this item is checked (for multi-select) */
  isChecked?: boolean;
}

interface SidebarGroupProps {
  label: string;
  children: CategoryNode[];
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  startIndex: number;
  /** Whether this group is in multi-select mode */
  isMultiSelect?: boolean;
  /** Set of checked category IDs (for multi-select) */
  selectedCategoryIds?: Set<string>;
  /** Whether all categories are implicitly selected (empty set) */
  allImplicitlySelected?: boolean;
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
 * Checkbox indicator for multi-select mode
 */
function CheckboxIndicator({ isChecked }: { isChecked: boolean }) {
  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: 2,
        border: isChecked
          ? "1.5px solid var(--uilint-accent)"
          : "1.5px solid var(--uilint-text-muted)",
        backgroundColor: isChecked ? "var(--uilint-accent)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginRight: 6,
        transition: "all 0.15s ease",
        opacity: isChecked ? 1 : 0.5,
      }}
    >
      <motion.div
        variants={checkboxMotionVariants}
        animate={isChecked ? "checked" : "unchecked"}
        transition={{ duration: 0.1, ease: crispEase }}
        style={{
          width: 6,
          height: 6,
          backgroundColor: "var(--uilint-bg)",
          borderRadius: 1,
          // Checkmark using CSS clip-path
          clipPath: isChecked
            ? "polygon(14% 44%, 0% 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)"
            : "none",
        }}
      />
    </div>
  );
}

/**
 * Individual sidebar item
 */
function SidebarItem({
  category,
  isSelected,
  onClick,
  index,
  isMultiSelect = false,
  isChecked = false,
}: SidebarItemProps) {
  // Determine state based on mode
  const getState = () => {
    if (category.isLoading) return "loading";
    if (isMultiSelect) {
      return isChecked ? "checked" : "unchecked";
    }
    return isSelected ? "selected" : "default";
  };

  const state = getState();

  // Multi-select inline styles
  const getMultiSelectStyles = (): React.CSSProperties => {
    if (!isMultiSelect) {
      return {
        borderLeft: isSelected
          ? "2px solid var(--uilint-accent)"
          : "2px solid transparent",
        paddingLeft: isSelected ? 8 : 10,
      };
    }

    // Multi-select mode styles
    if (isChecked) {
      return {
        backgroundColor: "color-mix(in srgb, var(--uilint-accent) 15%, transparent)",
        color: "var(--uilint-text)",
        fontWeight: 600,
        borderLeft: "2px solid var(--uilint-accent)",
        paddingLeft: 8,
      };
    }

    // Unchecked state - muted/grayed out
    return {
      color: "var(--uilint-text-muted)",
      opacity: 0.6,
      borderLeft: "2px solid transparent",
      paddingLeft: 10,
    };
  };

  return (
    <motion.div
      variants={itemMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.1, delay: index * 0.02, ease: crispEase }}
    >
      <div
        className={cn(sidebarItemVariants({ state: isMultiSelect ? "default" : state }))}
        onClick={onClick}
        role={isMultiSelect ? "checkbox" : "button"}
        aria-checked={isMultiSelect ? isChecked : undefined}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        style={getMultiSelectStyles()}
      >
        {isMultiSelect && <CheckboxIndicator isChecked={isChecked} />}
        <span className="truncate" style={{ flex: 1 }}>{category.label}</span>
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
  isMultiSelect = false,
  selectedCategoryIds,
  allImplicitlySelected = false,
}: SidebarGroupProps) {
  // Calculate total count for group
  const totalCount = children.reduce((sum, c) => sum + (c.count ?? 0), 0);
  const isAnyLoading = children.some((c) => c.isLoading);

  // Helper to determine if a category is checked in multi-select mode
  const isCategoryChecked = (categoryId: string): boolean => {
    if (!isMultiSelect) return false;
    // When selectedCategoryIds is empty, all are implicitly selected
    if (allImplicitlySelected) return true;
    return selectedCategoryIds?.has(categoryId) ?? false;
  };

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
            isMultiSelect={isMultiSelect}
            isChecked={isCategoryChecked(category.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * "All" category item - always shown at top
 * In multi-select mode, clicking "All" resets to having all categories selected (empty set = all)
 */
function AllCategoryItem({
  isSelected,
  onClick,
  totalCount,
  isMultiSelect = false,
  allImplicitlySelected = false,
}: {
  isSelected: boolean;
  onClick: () => void;
  totalCount: number;
  isMultiSelect?: boolean;
  allImplicitlySelected?: boolean;
}) {
  // In multi-select mode, "All" is highlighted when all categories are implicitly selected
  const isHighlighted = isMultiSelect ? allImplicitlySelected : isSelected;

  // Styles for multi-select "All" button
  const getStyles = (): React.CSSProperties => {
    if (isMultiSelect) {
      if (allImplicitlySelected) {
        return {
          backgroundColor: "color-mix(in srgb, var(--uilint-accent) 15%, transparent)",
          color: "var(--uilint-text)",
          fontWeight: 600,
          borderLeft: "2px solid var(--uilint-accent)",
          paddingLeft: 8,
        };
      }
      return {
        color: "var(--uilint-text-muted)",
        opacity: 0.7,
        borderLeft: "2px solid transparent",
        paddingLeft: 10,
        fontWeight: 500,
      };
    }

    return {
      borderLeft: isSelected
        ? "2px solid var(--uilint-accent)"
        : "2px solid transparent",
      paddingLeft: isSelected ? 8 : 10,
      fontWeight: 500,
    };
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.1 }}
    >
      <div
        className={cn(sidebarItemVariants({ state: isMultiSelect ? "default" : (isHighlighted ? "selected" : "default") }))}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        style={getStyles()}
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
 * Supports two modes:
 * 1. Single-select mode (default): Uses selectedId and onSelect props
 * 2. Multi-select mode: Uses selectedCategoryIds and onToggleCategory props
 *    - When selectedCategoryIds is empty, ALL categories are implicitly selected
 *    - Clicking a category toggles its selection
 *    - Clicking "All" resets to all selected (empty set)
 *
 * @example
 * ```tsx
 * // Single-select mode
 * <CategorySidebar
 *   categories={categoryTree}
 *   selectedId={selectedCategoryId}
 *   onSelect={setSelectedCategory}
 * />
 *
 * // Multi-select mode
 * <CategorySidebar
 *   categories={categoryTree}
 *   selectedId={null}
 *   onSelect={() => {}}
 *   selectedCategoryIds={selectedIds}
 *   onToggleCategory={handleToggle}
 * />
 * ```
 */
export function CategorySidebar({
  categories,
  selectedId,
  onSelect,
  selectedCategoryIds,
  onToggleCategory,
  isFocused = false,
  size,
  className,
}: CategorySidebarProps) {
  // Determine if we're in multi-select mode
  const isMultiSelect = selectedCategoryIds !== undefined && onToggleCategory !== undefined;

  // When selectedCategoryIds is empty, all categories are implicitly selected
  const allImplicitlySelected = isMultiSelect && selectedCategoryIds.size === 0;

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

  // Helper to determine if a category is checked in multi-select mode
  const isCategoryChecked = (categoryId: string): boolean => {
    if (!isMultiSelect) return false;
    // When selectedCategoryIds is empty, all are implicitly selected
    if (allImplicitlySelected) return true;
    return selectedCategoryIds.has(categoryId);
  };

  // Handle click - either toggle (multi-select) or select (single-select)
  const handleCategoryClick = (categoryId: string) => {
    if (isMultiSelect && onToggleCategory) {
      onToggleCategory(categoryId);
    } else {
      onSelect(categoryId);
    }
  };

  // Handle "All" click - in multi-select mode, reset to all selected
  const handleAllClick = () => {
    if (isMultiSelect) {
      // In multi-select, clicking "All" should reset to empty set (all selected)
      // This is handled by the parent - they can clear the set on receiving null
      onSelect(null);
    } else {
      onSelect(null);
    }
  };

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
        onClick={handleAllClick}
        totalCount={totalCount}
        isMultiSelect={isMultiSelect}
        allImplicitlySelected={allImplicitlySelected}
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
              onClick={() => handleCategoryClick(category.id)}
              index={idx}
              isMultiSelect={isMultiSelect}
              isChecked={isCategoryChecked(category.id)}
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
            onSelect={handleCategoryClick}
            startIndex={startIdx}
            isMultiSelect={isMultiSelect}
            selectedCategoryIds={selectedCategoryIds}
            allImplicitlySelected={allImplicitlySelected}
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
