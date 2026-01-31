/**
 * useCategoryRegistry - React hook for accessing the category registry
 *
 * Provides reactive access to category providers and their loading states.
 * Automatically subscribes to registry changes and triggers re-renders.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  categoryRegistry,
  type CategoryNode,
} from "../../core/plugin-system/category-registry";
import type { CategoryItem } from "../../core/plugin-system/types";

/**
 * Hook return type
 */
export interface UseCategoryRegistryReturn {
  /** Category tree for sidebar display (empty categories filtered out) */
  categoryTree: CategoryNode[];
  /** Load items for a specific category */
  loadItems: (categoryId: string) => Promise<CategoryItem[]>;
  /** Get cached items for a category */
  getCachedItems: (categoryId: string) => CategoryItem[];
  /** Search items across categories */
  searchItems: (query: string, categoryId?: string) => CategoryItem[];
  /** Invalidate cache for a category or all categories */
  invalidate: (categoryId?: string) => void;
  /** Whether any category is currently loading */
  isLoading: boolean;
}

/**
 * React hook for using the category registry
 *
 * @example
 * ```tsx
 * function CategorySidebar() {
 *   const { categoryTree, loadItems, isLoading } = useCategoryRegistry();
 *
 *   return (
 *     <div>
 *       {categoryTree.map(category => (
 *         <CategoryItem
 *           key={category.id}
 *           category={category}
 *           onClick={() => loadItems(category.id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCategoryRegistry(): UseCategoryRegistryReturn {
  // Force re-render when registry changes
  // We use the counter value as a dependency for memos that need to update
  const [updateCounter, forceUpdate] = useState(0);

  // Subscribe to registry changes
  useEffect(() => {
    const unsubscribe = categoryRegistry.subscribe(() => {
      forceUpdate((n) => n + 1);
    });
    return unsubscribe;
  }, []);

  // Get category tree (memoized based on update counter)
  const categoryTree = useMemo(() => {
    return categoryRegistry.getCategoryTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateCounter]);

  // Check if any category is loading
  const isLoading = useMemo(() => {
    const providers = categoryRegistry.getAllProviders();
    return providers.some(
      (p) => categoryRegistry.getLoadingState(p.id) === "loading"
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateCounter]);

  // Load items for a category
  const loadItems = useCallback(async (categoryId: string) => {
    return categoryRegistry.loadItems(categoryId);
  }, []);

  // Get cached items - depends on updateCounter so reference changes when cache updates
  // This ensures consumers (like CommandPalette's categoryItems memo) re-compute
  const getCachedItems = useCallback((categoryId: string) => {
    return categoryRegistry.getCachedItems(categoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateCounter]);

  // Search items
  const searchItems = useCallback(
    (query: string, categoryId?: string) => {
      return categoryRegistry.searchItems(query, categoryId);
    },
    []
  );

  // Invalidate cache
  const invalidate = useCallback((categoryId?: string) => {
    categoryRegistry.invalidate(categoryId);
  }, []);

  return {
    categoryTree,
    loadItems,
    getCachedItems,
    searchItems,
    invalidate,
    isLoading,
  };
}
