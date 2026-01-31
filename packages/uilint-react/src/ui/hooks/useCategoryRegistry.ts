/**
 * useCategoryRegistry - React hook for accessing the category registry
 *
 * Provides reactive access to category providers and their loading states
 * using Zustand selectors for automatic re-renders when state changes.
 */

import { useCallback } from "react";
import { useComposedStore } from "../../core/store/composed-store";
import {
  selectCategoryItems,
  selectAnyCategoryLoading,
  type CategoryNode,
} from "../../core/store/category-slice";
import type { CategoryItem } from "../../core/plugin-system/types";

/**
 * Hook return type
 */
export interface UseCategoryRegistryReturn {
  /** Category tree for sidebar display (empty categories filtered out) */
  categoryTree: CategoryNode[];
  /** Load items for a specific category */
  loadItems: (categoryId: string) => Promise<CategoryItem[]>;
  /** Get cached items for a category (reactive) */
  getCachedItems: (categoryId: string) => CategoryItem[];
  /** Search items across categories */
  searchItems: (query: string, categoryId?: string) => CategoryItem[];
  /** Invalidate cache for a category or all categories */
  invalidate: (categoryId?: string) => void;
  /** Whether any category is currently loading */
  isLoading: boolean;
}

/**
 * React hook for using the category registry via Zustand selectors.
 *
 * All state access is reactive - components will automatically re-render
 * when the relevant state changes.
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
  // Use stored state for reactive updates
  const categoryTree = useComposedStore((s) => s.categoryTree);
  const isLoading = useComposedStore(selectAnyCategoryLoading);

  // Get actions from store
  const loadCategoryItems = useComposedStore((s) => s.loadCategoryItems);
  const invalidateCategoryCache = useComposedStore((s) => s.invalidateCategoryCache);
  const searchCategoryItems = useComposedStore((s) => s.searchCategoryItems);
  const categoryCache = useComposedStore((s) => s.categoryCache);

  // Wrap actions in stable callbacks
  const loadItems = useCallback(
    (categoryId: string) => loadCategoryItems(categoryId),
    [loadCategoryItems]
  );

  const getCachedItems = useCallback(
    (categoryId: string) => categoryCache.get(categoryId)?.items ?? [],
    [categoryCache]
  );

  const searchItems = useCallback(
    (query: string, categoryId?: string) => searchCategoryItems(query, categoryId),
    [searchCategoryItems]
  );

  const invalidate = useCallback(
    (categoryId?: string) => invalidateCategoryCache(categoryId),
    [invalidateCategoryCache]
  );

  return {
    categoryTree,
    loadItems,
    getCachedItems,
    searchItems,
    invalidate,
    isLoading,
  };
}

/**
 * Hook to get cached items for a specific category.
 * More efficient than useCategoryRegistry when you only need items for one category.
 *
 * @param categoryId - The category ID to get items for
 * @returns Array of cached items (empty if not loaded)
 *
 * @example
 * ```tsx
 * function CategoryItemsList({ categoryId }: { categoryId: string }) {
 *   const items = useCategoryItems(categoryId);
 *   return <ul>{items.map(item => <li key={item.id}>{item.title}</li>)}</ul>;
 * }
 * ```
 */
export function useCategoryItems(categoryId: string | null): CategoryItem[] {
  return useComposedStore((state) => selectCategoryItems(state, categoryId));
}

/**
 * Hook to load items for a category.
 * Returns a stable callback that loads items on demand.
 *
 * @returns Function to load items for a category
 */
export function useLoadCategoryItems(): (categoryId: string) => Promise<CategoryItem[]> {
  return useComposedStore((s) => s.loadCategoryItems);
}
