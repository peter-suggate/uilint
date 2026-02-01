/**
 * Category Registry
 *
 * Manages category providers contributed by plugins for the command palette sidebar.
 * Handles lazy loading with priority-based scheduling, caching, and item aggregation.
 */

import { devWarn, devError } from "uilint-core";
import type {
  CategoryProvider,
  CategoryItem,
  CategoryLoadingState,
  CategoryPriority,
  PluginServices,
  Plugin,
} from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Cached category data with loading state.
 */
interface CategoryCache {
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

/**
 * Options for configuring the category registry.
 */
export interface CategoryRegistryOptions {
  /** Cache TTL in milliseconds (default: 30000 = 30s) */
  cacheTTL?: number;
  /** Maximum concurrent loads (default: 3) */
  maxConcurrentLoads?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CACHE_TTL = 30000; // 30 seconds
const DEFAULT_MAX_CONCURRENT_LOADS = 3;

// ============================================================================
// Category Registry Class
// ============================================================================

/**
 * Registry for managing category providers and their lazy-loaded items.
 */
export class CategoryRegistry {
  private providers: Map<string, CategoryProvider> = new Map();
  private cache: Map<string, CategoryCache> = new Map();
  private loadingPromises: Map<string, Promise<CategoryItem[]>> = new Map();
  private services: PluginServices | null = null;
  private options: Required<CategoryRegistryOptions>;
  private listeners: Set<() => void> = new Set();

  constructor(options: CategoryRegistryOptions = {}) {
    this.options = {
      cacheTTL: options.cacheTTL ?? DEFAULT_CACHE_TTL,
      maxConcurrentLoads: options.maxConcurrentLoads ?? DEFAULT_MAX_CONCURRENT_LOADS,
    };
  }

  /**
   * Initialize the registry with plugin services.
   */
  initialize(services: PluginServices): void {
    this.services = services;
  }

  /**
   * Register a category provider.
   */
  registerProvider(provider: CategoryProvider): void {
    if (this.providers.has(provider.id)) {
      devWarn(
        `[CategoryRegistry] Provider "${provider.id}" already registered. Skipping.`
      );
      return;
    }

    this.providers.set(provider.id, provider);
    this.cache.set(provider.id, {
      items: [],
      state: "idle",
      loadedAt: 0,
    });

    this.notifyListeners();
  }

  /**
   * Unregister a category provider.
   */
  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId);
    this.cache.delete(providerId);
    this.loadingPromises.delete(providerId);
    this.notifyListeners();
  }

  /**
   * Register all category providers from a plugin.
   */
  registerFromPlugin(plugin: Plugin): void {
    if (!plugin.categoryProviders) return;

    for (const provider of plugin.categoryProviders) {
      // Automatically set parentId to plugin ID if not specified
      const providerWithParent: CategoryProvider = {
        ...provider,
        parentId: provider.parentId ?? plugin.id,
      };
      this.registerProvider(providerWithParent);
    }
  }

  /**
   * Get a category provider by ID.
   */
  getProvider(providerId: string): CategoryProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get all registered providers.
   */
  getAllProviders(): CategoryProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get the loading state for a category.
   */
  getLoadingState(providerId: string): CategoryLoadingState {
    return this.cache.get(providerId)?.state ?? "idle";
  }

  /**
   * Get cached items for a category (empty if not loaded).
   */
  getCachedItems(providerId: string): CategoryItem[] {
    return this.cache.get(providerId)?.items ?? [];
  }

  /**
   * Check if a category's cache is still valid.
   */
  isCacheValid(providerId: string): boolean {
    const cached = this.cache.get(providerId);
    if (!cached || cached.state !== "loaded") return false;
    return Date.now() - cached.loadedAt < this.options.cacheTTL;
  }

  /**
   * Load items for a category.
   * Returns cached items if valid, otherwise loads fresh data.
   * Handles both static and dynamic providers.
   */
  async loadItems(providerId: string): Promise<CategoryItem[]> {
    let provider = this.providers.get(providerId);

    // If not found, check dynamic providers
    if (!provider) {
      provider = this.findDynamicProvider(providerId);
    }

    if (!provider) {
      devWarn(`[CategoryRegistry] Unknown provider: ${providerId}`);
      return [];
    }

    if (!this.services) {
      devWarn("[CategoryRegistry] Services not initialized");
      return [];
    }

    // Return cached items if valid
    if (this.isCacheValid(providerId)) {
      return this.cache.get(providerId)!.items;
    }

    // Return existing loading promise if already loading
    const existingPromise = this.loadingPromises.get(providerId);
    if (existingPromise) {
      return existingPromise;
    }

    // Start loading
    const loadPromise = this.loadItemsInternal(providerId, provider);
    this.loadingPromises.set(providerId, loadPromise);

    try {
      const items = await loadPromise;
      return items;
    } finally {
      this.loadingPromises.delete(providerId);
    }
  }

  /**
   * Find a dynamic provider by searching through all dynamic parent providers.
   */
  private findDynamicProvider(providerId: string): CategoryProvider | undefined {
    if (!this.services) return undefined;

    for (const provider of this.providers.values()) {
      if (provider.isDynamic && provider.getSubCategories) {
        const subCategories = provider.getSubCategories(this.services);
        const found = subCategories.find((sub) => sub.id === providerId);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }

  /**
   * Internal method to load items from a provider.
   */
  private async loadItemsInternal(
    providerId: string,
    provider: CategoryProvider
  ): Promise<CategoryItem[]> {
    // Update state to loading
    this.updateCache(providerId, { state: "loading" });
    this.notifyListeners();

    try {
      const items = await provider.getItems(this.services!);

      // Sort items by priority
      const sortedItems = items.sort(
        (a, b) => (a.priority ?? 1) - (b.priority ?? 1)
      );

      // Update cache with loaded items
      this.updateCache(providerId, {
        items: sortedItems,
        state: "loaded",
        loadedAt: Date.now(),
        count: sortedItems.length,
        error: undefined,
      });

      this.notifyListeners();
      return sortedItems;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      this.updateCache(providerId, {
        state: "error",
        error: errorMessage,
      });

      this.notifyListeners();
      devError(
        `[CategoryRegistry] Failed to load items for "${providerId}":`,
        error
      );
      return [];
    }
  }

  /**
   * Load item count for a category without loading full items.
   */
  async loadItemCount(providerId: string): Promise<number> {
    const provider = this.providers.get(providerId);
    if (!provider || !this.services) return 0;

    // Use cached count if available
    const cached = this.cache.get(providerId);
    if (cached?.count !== undefined) {
      return cached.count;
    }

    // Use getItemCount if available, otherwise load items
    if (provider.getItemCount) {
      try {
        const count = await provider.getItemCount(this.services);
        this.updateCache(providerId, { count });
        this.notifyListeners();
        return count;
      } catch (error) {
        devError(
          `[CategoryRegistry] Failed to get count for "${providerId}":`,
          error
        );
        return 0;
      }
    }

    // Fallback: load items to get count
    const items = await this.loadItems(providerId);
    return items.length;
  }

  /**
   * Load categories by priority.
   * Loads P0 immediately, schedules P1-P3 appropriately.
   */
  async loadByPriority(visibleCategoryIds?: string[]): Promise<void> {
    if (!this.services) return;

    const providers = this.getAllProviders();

    // Group by priority
    const byPriority: Map<CategoryPriority, CategoryProvider[]> = new Map([
      [0, []],
      [1, []],
      [2, []],
      [3, []],
    ]);

    for (const provider of providers) {
      const priorityList = byPriority.get(provider.priority);
      if (priorityList) {
        priorityList.push(provider);
      }
    }

    // Load P0 (immediate) synchronously
    const p0Providers = byPriority.get(0) ?? [];
    await Promise.all(p0Providers.map((p) => this.loadItems(p.id)));

    // Load visible categories with high priority
    if (visibleCategoryIds) {
      const visiblePromises = visibleCategoryIds
        .filter((id) => !this.isCacheValid(id))
        .map((id) => this.loadItems(id));
      await Promise.all(visiblePromises);
    }

    // Load P1 (high priority) - item counts only
    const p1Providers = byPriority.get(1) ?? [];
    await Promise.all(p1Providers.map((p) => this.loadItemCount(p.id)));

    // Schedule P2 and P3 for idle time
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => {
        const p2Providers = byPriority.get(2) ?? [];
        p2Providers.forEach((p) => this.loadItemCount(p.id));
      });

      requestIdleCallback(
        () => {
          const p3Providers = byPriority.get(3) ?? [];
          p3Providers.forEach((p) => this.loadItemCount(p.id));
        },
        { timeout: 5000 }
      );
    }
  }

  /**
   * Prefetch low-priority categories during idle time.
   */
  prefetchLowPriority(): void {
    if (typeof requestIdleCallback === "undefined") return;

    requestIdleCallback(
      () => {
        const providers = this.getAllProviders().filter(
          (p) => p.priority >= 2 && !this.isCacheValid(p.id)
        );

        // Load one at a time during idle
        const loadNext = (index: number) => {
          if (index >= providers.length) return;

          this.loadItemCount(providers[index].id).then(() => {
            requestIdleCallback(() => loadNext(index + 1));
          });
        };

        loadNext(0);
      },
      { timeout: 10000 }
    );
  }

  /**
   * Invalidate cache for one or all categories.
   */
  invalidate(providerId?: string): void {
    if (providerId) {
      const cached = this.cache.get(providerId);
      if (cached) {
        this.cache.set(providerId, {
          ...cached,
          state: "idle",
          loadedAt: 0,
        });
      }
    } else {
      // Invalidate all
      for (const [id, cached] of this.cache) {
        this.cache.set(id, {
          ...cached,
          state: "idle",
          loadedAt: 0,
        });
      }
    }
    this.notifyListeners();
  }

  /**
   * Build the category tree for the sidebar.
   * Groups categories by parent plugin and filters out empty categories.
   * Expands dynamic providers to include their sub-categories.
   */
  getCategoryTree(): CategoryNode[] {
    const nodes: CategoryNode[] = [];
    const pluginGroups: Map<string, CategoryNode[]> = new Map();

    // First, expand dynamic providers to get all categories
    const allProviders: CategoryProvider[] = [];
    for (const provider of this.providers.values()) {
      if (provider.isDynamic && provider.getSubCategories && this.services) {
        // Get dynamic sub-categories
        const subCategories = provider.getSubCategories(this.services);
        for (const subCategory of subCategories) {
          // Register the sub-category temporarily for caching
          if (!this.providers.has(subCategory.id)) {
            // Set parent to the dynamic provider's parent
            const subWithParent: CategoryProvider = {
              ...subCategory,
              parentId: subCategory.parentId ?? provider.parentId,
            };
            allProviders.push(subWithParent);

            // Initialize cache if needed
            if (!this.cache.has(subCategory.id)) {
              this.cache.set(subCategory.id, {
                items: [],
                state: "idle",
                loadedAt: 0,
              });
            }
          }
        }
      } else {
        allProviders.push(provider);
      }
    }

    for (const provider of allProviders) {
      const cached = this.cache.get(provider.id);
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
          label: parentId, // Will be replaced with plugin name in UI
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

  /**
   * Search items across all categories or a specific category.
   */
  searchItems(query: string, categoryId?: string): CategoryItem[] {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];

    const results: CategoryItem[] = [];
    const providersToSearch = categoryId
      ? [this.providers.get(categoryId)].filter(Boolean) as CategoryProvider[]
      : this.getAllProviders();

    for (const provider of providersToSearch) {
      const cached = this.cache.get(provider.id);
      if (!cached || cached.state !== "loaded") continue;

      const matchingItems = cached.items.filter((item) => {
        // Use custom filter predicate if provided
        if (provider.filterPredicate) {
          return provider.filterPredicate(item, normalizedQuery);
        }

        // Default search: check searchKeys or title/subtitle
        const searchKeys = provider.searchKeys ?? ["title", "subtitle"];
        return searchKeys.some((key) => {
          const value = key === "title" ? item.title :
            key === "subtitle" ? item.subtitle :
              item.metadata?.[key];
          return typeof value === "string" &&
            value.toLowerCase().includes(normalizedQuery);
        });
      });

      results.push(...matchingItems);
    }

    // Sort by priority
    return results.sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));
  }

  /**
   * Subscribe to registry changes.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Update cache for a provider.
   */
  private updateCache(
    providerId: string,
    update: Partial<CategoryCache>
  ): void {
    const existing = this.cache.get(providerId) ?? {
      items: [],
      state: "idle" as const,
      loadedAt: 0,
    };
    this.cache.set(providerId, { ...existing, ...update });
  }

  /**
   * Notify all listeners of changes.
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Clear all providers and cache.
   */
  clear(): void {
    this.providers.clear();
    this.cache.clear();
    this.loadingPromises.clear();
    this.notifyListeners();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Factory function to create a new CategoryRegistry instance.
 */
export function createCategoryRegistry(
  options?: CategoryRegistryOptions
): CategoryRegistry {
  return new CategoryRegistry(options);
}

/**
 * Singleton instance of the category registry.
 */
export const categoryRegistry = createCategoryRegistry();
