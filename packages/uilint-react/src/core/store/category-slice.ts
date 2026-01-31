/**
 * Category Registry Slice
 *
 * Zustand slice for managing category providers in the command palette sidebar.
 * Replaces the old subscription-based CategoryRegistry with reactive state.
 */

import type { StateCreator } from "zustand";
import type {
  CategoryProvider,
  CategoryItem,
  CategoryLoadingState,
  CategoryPriority,
  PluginServices,
  Plugin,
} from "../plugin-system/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Cached category data with loading state.
 */
export interface CategoryCache {
  /** Loaded items (empty until loaded) */
  items: CategoryItem[];
  /** Current loading state */
  state: CategoryLoadingState;
  /** Timestamp when items were loaded */
  loadedAt: number;
  /** Error message if loading failed */
  error?: string;
  /** Item count (may be available before items are loaded) */
  count?: number;
}

/**
 * A category node for the sidebar tree structure.
 */
export interface CategoryNode {
  /** Category ID */
  id: string;
  /** Display label */
  label: string;
  /** Item count (undefined if not yet loaded) */
  count?: number;
  /** Whether the category is currently loading */
  isLoading: boolean;
  /** Child categories (for plugin grouping) */
  children?: CategoryNode[];
  /** Parent plugin ID */
  parentId?: string;
  /** Load priority */
  priority: CategoryPriority;
}

// ============================================================================
// Slice Interface
// ============================================================================

/**
 * Category registry slice state and actions.
 */
export interface CategorySlice {
  // ============ State ============
  /** Registered category providers */
  categoryProviders: Map<string, CategoryProvider>;
  /** Cache for loaded items */
  categoryCache: Map<string, CategoryCache>;
  /** Active loading promises (for deduplication) */
  categoryLoadingPromises: Map<string, Promise<CategoryItem[]>>;
  /** Plugin services reference */
  categoryServices: PluginServices | null;
  /** Computed category tree for sidebar display */
  categoryTree: CategoryNode[];

  // ============ Actions ============
  /** Initialize the category registry with services */
  initializeCategoryRegistry: (services: PluginServices) => void;
  /** Register a category provider */
  registerCategoryProvider: (provider: CategoryProvider) => void;
  /** Unregister a category provider */
  unregisterCategoryProvider: (providerId: string) => void;
  /** Register all category providers from a plugin */
  registerCategoryProvidersFromPlugin: (plugin: Plugin) => void;
  /** Load items for a category (async, updates state when done) */
  loadCategoryItems: (categoryId: string) => Promise<CategoryItem[]>;
  /** Invalidate cache for one or all categories */
  invalidateCategoryCache: (categoryId?: string) => void;
  /** Search items across categories */
  searchCategoryItems: (query: string, categoryId?: string) => CategoryItem[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CACHE_TTL = 30000; // 30 seconds

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a category's cache is still valid.
 */
function isCacheValid(cache: CategoryCache | undefined): boolean {
  if (!cache || cache.state !== "loaded") return false;
  return Date.now() - cache.loadedAt < DEFAULT_CACHE_TTL;
}

/**
 * Find a dynamic provider by searching through all dynamic parent providers.
 */
function findDynamicProvider(
  providers: Map<string, CategoryProvider>,
  providerId: string,
  services: PluginServices | null
): CategoryProvider | undefined {
  if (!services) return undefined;

  for (const provider of providers.values()) {
    if (provider.isDynamic && provider.getSubCategories) {
      const subCategories = provider.getSubCategories(services);
      const found = subCategories.find((sub) => sub.id === providerId);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * Build the category tree from providers and cache.
 * This is called internally to update the stored categoryTree state.
 */
function buildCategoryTree(
  categoryProviders: Map<string, CategoryProvider>,
  categoryCache: Map<string, CategoryCache>,
  categoryServices: PluginServices | null
): CategoryNode[] {
  const nodes: CategoryNode[] = [];
  const pluginGroups: Map<string, CategoryNode[]> = new Map();

  // First, expand dynamic providers to get all categories
  const allProviders: CategoryProvider[] = [];
  for (const provider of categoryProviders.values()) {
    if (provider.isDynamic && provider.getSubCategories && categoryServices) {
      // Get dynamic sub-categories
      const subCategories = provider.getSubCategories(categoryServices);
      for (const subCategory of subCategories) {
        const subWithParent: CategoryProvider = {
          ...subCategory,
          parentId: subCategory.parentId ?? provider.parentId,
        };
        allProviders.push(subWithParent);
      }
    } else {
      allProviders.push(provider);
    }
  }

  for (const provider of allProviders) {
    const cached = categoryCache.get(provider.id);
    const count = cached?.count;

    // Skip categories with zero items (unless still loading or count unknown)
    if (count === 0 && cached?.state === "loaded") {
      continue;
    }

    const node: CategoryNode = {
      id: provider.id,
      label: provider.label,
      count,
      isLoading: cached?.state === "loading",
      parentId: provider.parentId,
      priority: provider.priority,
    };

    if (provider.parentId) {
      const group = pluginGroups.get(provider.parentId) ?? [];
      group.push(node);
      pluginGroups.set(provider.parentId, group);
    } else {
      nodes.push(node);
    }
  }

  // Merge groups into parent nodes
  for (const [parentId, children] of pluginGroups) {
    // Sort children by priority
    children.sort((a, b) => a.priority - b.priority);

    // Find or create parent node
    const existingParent = nodes.find((n) => n.id === parentId);
    if (existingParent) {
      existingParent.children = children;
    } else {
      // Create a synthetic parent node for the plugin
      nodes.push({
        id: parentId,
        label: parentId,
        isLoading: false,
        priority: Math.min(...children.map((c) => c.priority)) as CategoryPriority,
        children,
      });
    }
  }

  // Sort top-level nodes by priority
  nodes.sort((a, b) => a.priority - b.priority);

  return nodes;
}

// ============================================================================
// Slice Creator
// ============================================================================

/**
 * Create the category registry slice.
 */
export const createCategorySlice: StateCreator<CategorySlice> = (set, get) => ({
  // ============ State ============
  categoryProviders: new Map(),
  categoryCache: new Map(),
  categoryLoadingPromises: new Map(),
  categoryServices: null,
  categoryTree: [],

  // ============ Actions ============
  initializeCategoryRegistry: (services) => {
    const { categoryProviders, categoryCache } = get();
    set({
      categoryServices: services,
      categoryTree: buildCategoryTree(categoryProviders, categoryCache, services),
    });
  },

  registerCategoryProvider: (provider) => {
    const { categoryProviders, categoryCache, categoryServices } = get();

    if (categoryProviders.has(provider.id)) {
      console.warn(
        `[CategorySlice] Provider "${provider.id}" already registered. Skipping.`
      );
      return;
    }

    const newProviders = new Map(categoryProviders);
    newProviders.set(provider.id, provider);

    const newCache = new Map(categoryCache);
    newCache.set(provider.id, {
      items: [],
      state: "idle",
      loadedAt: 0,
    });

    set({
      categoryProviders: newProviders,
      categoryCache: newCache,
      categoryTree: buildCategoryTree(newProviders, newCache, categoryServices),
    });
  },

  unregisterCategoryProvider: (providerId) => {
    const { categoryProviders, categoryCache, categoryLoadingPromises, categoryServices } = get();

    const newProviders = new Map(categoryProviders);
    newProviders.delete(providerId);

    const newCache = new Map(categoryCache);
    newCache.delete(providerId);

    const newPromises = new Map(categoryLoadingPromises);
    newPromises.delete(providerId);

    set({
      categoryProviders: newProviders,
      categoryCache: newCache,
      categoryLoadingPromises: newPromises,
      categoryTree: buildCategoryTree(newProviders, newCache, categoryServices),
    });
  },

  registerCategoryProvidersFromPlugin: (plugin) => {
    if (!plugin.categoryProviders) return;

    for (const provider of plugin.categoryProviders) {
      const providerWithParent: CategoryProvider = {
        ...provider,
        parentId: provider.parentId ?? plugin.id,
      };
      get().registerCategoryProvider(providerWithParent);
    }
  },

  loadCategoryItems: async (categoryId) => {
    const {
      categoryProviders,
      categoryCache,
      categoryLoadingPromises,
      categoryServices,
    } = get();

    let provider = categoryProviders.get(categoryId);

    // If not found, check dynamic providers
    if (!provider) {
      provider = findDynamicProvider(categoryProviders, categoryId, categoryServices);
    }

    if (!provider) {
      console.warn(`[CategorySlice] Unknown provider: ${categoryId}`);
      return [];
    }

    if (!categoryServices) {
      console.warn("[CategorySlice] Services not initialized");
      return [];
    }

    // Return cached items if valid
    const cached = categoryCache.get(categoryId);
    if (isCacheValid(cached)) {
      return cached!.items;
    }

    // Return existing loading promise if already loading
    const existingPromise = categoryLoadingPromises.get(categoryId);
    if (existingPromise) {
      return existingPromise;
    }

    // Update state to loading
    const newCache = new Map(categoryCache);
    newCache.set(categoryId, {
      ...newCache.get(categoryId),
      items: [],
      state: "loading",
      loadedAt: 0,
    } as CategoryCache);
    set({
      categoryCache: newCache,
      categoryTree: buildCategoryTree(categoryProviders, newCache, categoryServices),
    });

    // Create loading promise
    const loadPromise = (async () => {
      try {
        const items = await provider!.getItems(categoryServices);

        // Sort items by priority
        const sortedItems = items.sort(
          (a, b) => (a.priority ?? 1) - (b.priority ?? 1)
        );

        // Update cache with loaded items
        const { categoryProviders: currentProviders, categoryServices: currentServices } = get();
        const updatedCache = new Map(get().categoryCache);
        updatedCache.set(categoryId, {
          items: sortedItems,
          state: "loaded",
          loadedAt: Date.now(),
          count: sortedItems.length,
          error: undefined,
        });

        // Remove loading promise
        const updatedPromises = new Map(get().categoryLoadingPromises);
        updatedPromises.delete(categoryId);

        set({
          categoryCache: updatedCache,
          categoryLoadingPromises: updatedPromises,
          categoryTree: buildCategoryTree(currentProviders, updatedCache, currentServices),
        });

        return sortedItems;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Update cache with error
        const { categoryProviders: currentProviders, categoryServices: currentServices } = get();
        const updatedCache = new Map(get().categoryCache);
        updatedCache.set(categoryId, {
          ...updatedCache.get(categoryId),
          state: "error",
          error: errorMessage,
        } as CategoryCache);

        // Remove loading promise
        const updatedPromises = new Map(get().categoryLoadingPromises);
        updatedPromises.delete(categoryId);

        set({
          categoryCache: updatedCache,
          categoryLoadingPromises: updatedPromises,
          categoryTree: buildCategoryTree(currentProviders, updatedCache, currentServices),
        });

        console.error(
          `[CategorySlice] Failed to load items for "${categoryId}":`,
          error
        );
        return [];
      }
    })();

    // Store loading promise
    const newPromises = new Map(categoryLoadingPromises);
    newPromises.set(categoryId, loadPromise);
    set({ categoryLoadingPromises: newPromises });

    return loadPromise;
  },

  invalidateCategoryCache: (categoryId) => {
    const { categoryCache, categoryProviders, categoryServices } = get();
    const newCache = new Map(categoryCache);

    if (categoryId) {
      const cached = newCache.get(categoryId);
      if (cached) {
        newCache.set(categoryId, {
          ...cached,
          state: "idle",
          loadedAt: 0,
        });
      }
    } else {
      // Invalidate all
      for (const [id, cached] of newCache) {
        newCache.set(id, {
          ...cached,
          state: "idle",
          loadedAt: 0,
        });
      }
    }

    set({
      categoryCache: newCache,
      categoryTree: buildCategoryTree(categoryProviders, newCache, categoryServices),
    });
  },

  searchCategoryItems: (query, categoryId) => {
    const { categoryProviders, categoryCache, categoryServices } = get();
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];

    const results: CategoryItem[] = [];
    const providersToSearch = categoryId
      ? [categoryProviders.get(categoryId)].filter(Boolean) as CategoryProvider[]
      : Array.from(categoryProviders.values());

    for (const provider of providersToSearch) {
      const cached = categoryCache.get(provider.id);
      if (!cached || cached.state !== "loaded") continue;

      const matchingItems = cached.items.filter((item) => {
        // Use custom filter predicate if provided
        if (provider.filterPredicate) {
          return provider.filterPredicate(item, normalizedQuery);
        }

        // Default search: check searchKeys or title/subtitle
        const searchKeys = provider.searchKeys ?? ["title", "subtitle"];
        return searchKeys.some((key) => {
          const value =
            key === "title"
              ? item.title
              : key === "subtitle"
                ? item.subtitle
                : item.metadata?.[key];
          return (
            typeof value === "string" &&
            value.toLowerCase().includes(normalizedQuery)
          );
        });
      });

      results.push(...matchingItems);
    }

    // Sort by priority
    return results.sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));
  },
});

// ============================================================================
// Selectors
// ============================================================================

// Stable empty array for selectors (avoid creating new references)
const EMPTY_ITEMS: CategoryItem[] = [];

/**
 * Selector to get cached items for a category.
 * Use with: useComposedStore((s) => selectCategoryItems(s, categoryId))
 */
export function selectCategoryItems(
  state: CategorySlice,
  categoryId: string | null
): CategoryItem[] {
  if (!categoryId) return EMPTY_ITEMS;
  return state.categoryCache.get(categoryId)?.items ?? EMPTY_ITEMS;
}

/**
 * Selector to check if a category is loading.
 */
export function selectCategoryIsLoading(
  state: CategorySlice,
  categoryId: string
): boolean {
  return state.categoryCache.get(categoryId)?.state === "loading";
}

/**
 * Selector to check if any category is loading.
 */
export function selectAnyCategoryLoading(state: CategorySlice): boolean {
  for (const cache of state.categoryCache.values()) {
    if (cache.state === "loading") return true;
  }
  return false;
}

/**
 * Selector to build the category tree for the sidebar.
 */
export function selectCategoryTree(state: CategorySlice): CategoryNode[] {
  const { categoryProviders, categoryCache, categoryServices } = state;
  const nodes: CategoryNode[] = [];
  const pluginGroups: Map<string, CategoryNode[]> = new Map();

  // First, expand dynamic providers to get all categories
  const allProviders: CategoryProvider[] = [];
  for (const provider of categoryProviders.values()) {
    if (provider.isDynamic && provider.getSubCategories && categoryServices) {
      // Get dynamic sub-categories
      const subCategories = provider.getSubCategories(categoryServices);
      for (const subCategory of subCategories) {
        const subWithParent: CategoryProvider = {
          ...subCategory,
          parentId: subCategory.parentId ?? provider.parentId,
        };
        allProviders.push(subWithParent);
      }
    } else {
      allProviders.push(provider);
    }
  }

  for (const provider of allProviders) {
    const cached = categoryCache.get(provider.id);
    const count = cached?.count;

    // Skip categories with zero items (unless still loading or count unknown)
    if (count === 0 && cached?.state === "loaded") {
      continue;
    }

    const node: CategoryNode = {
      id: provider.id,
      label: provider.label,
      count,
      isLoading: cached?.state === "loading",
      parentId: provider.parentId,
      priority: provider.priority,
    };

    if (provider.parentId) {
      const group = pluginGroups.get(provider.parentId) ?? [];
      group.push(node);
      pluginGroups.set(provider.parentId, group);
    } else {
      nodes.push(node);
    }
  }

  // Merge groups into parent nodes
  for (const [parentId, children] of pluginGroups) {
    // Sort children by priority
    children.sort((a, b) => a.priority - b.priority);

    // Find or create parent node
    const existingParent = nodes.find((n) => n.id === parentId);
    if (existingParent) {
      existingParent.children = children;
    } else {
      // Create a synthetic parent node for the plugin
      nodes.push({
        id: parentId,
        label: parentId,
        isLoading: false,
        priority: Math.min(...children.map((c) => c.priority)) as CategoryPriority,
        children,
      });
    }
  }

  // Sort top-level nodes by priority
  nodes.sort((a, b) => a.priority - b.priority);

  return nodes;
}
