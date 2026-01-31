/**
 * Tests for category-slice.ts
 *
 * Tests the Zustand slice for managing category providers in the command palette sidebar,
 * including selectors for aggregating items from child categories.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createCategorySlice,
  selectChildCategoryIds,
  selectIsParentCategory,
  selectCategoryItems,
  selectAggregatedCategoryItems,
  type CategorySlice,
  type CategoryCache,
} from "./category-slice";
import type { CategoryProvider, CategoryItem, PluginServices } from "../plugin-system/types";

// Mock PluginServices
const mockServices: PluginServices = {
  getState: () => ({}),
  setState: () => {},
  subscribe: () => () => {},
  websocket: {
    send: () => {},
    on: () => () => {},
    off: () => {},
    connect: async () => {},
    disconnect: () => {},
    isConnected: () => false,
  },
  openInspector: () => {},
  closeInspector: () => {},
  closeCommandPalette: () => {},
  invalidateCategory: () => {},
};

// Helper to create a mock category provider
function createMockProvider(
  id: string,
  label: string,
  options: {
    parentId?: string;
    priority?: number;
    isDynamic?: boolean;
    items?: CategoryItem[];
    getSubCategories?: (services: PluginServices) => CategoryProvider[];
  } = {}
): CategoryProvider {
  return {
    id,
    label,
    priority: options.priority ?? 1,
    parentId: options.parentId,
    isDynamic: options.isDynamic,
    getItems: () => options.items ?? [],
    getItemCount: () => options.items?.length ?? 0,
    searchKeys: ["title", "subtitle"],
    getSubCategories: options.getSubCategories,
  };
}

// Helper to create a mock category cache entry
function createMockCache(items: CategoryItem[]): CategoryCache {
  return {
    items,
    state: "loaded",
    loadedAt: Date.now(),
    count: items.length,
  };
}

// Helper to create a mock CategoryItem
function createMockItem(id: string, title: string, priority = 1): CategoryItem {
  return {
    id,
    title,
    subtitle: `Subtitle for ${title}`,
    priority,
  };
}

describe("category-slice selectors", () => {
  describe("selectChildCategoryIds", () => {
    it("returns empty array for category with no children", () => {
      const state: CategorySlice = {
        categoryProviders: new Map([
          ["standalone", createMockProvider("standalone", "Standalone")],
        ]),
        categoryCache: new Map(),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      const childIds = selectChildCategoryIds(state, "standalone");
      expect(childIds).toEqual([]);
    });

    it("returns child category IDs for parent with direct children", () => {
      const state: CategorySlice = {
        categoryProviders: new Map([
          ["eslint:commands", createMockProvider("eslint:commands", "Commands", { parentId: "eslint" })],
          ["eslint:issues", createMockProvider("eslint:issues", "Issues", { parentId: "eslint" })],
          ["vision:commands", createMockProvider("vision:commands", "Commands", { parentId: "vision" })],
        ]),
        categoryCache: new Map(),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      const childIds = selectChildCategoryIds(state, "eslint");
      expect(childIds).toContain("eslint:commands");
      expect(childIds).toContain("eslint:issues");
      expect(childIds).not.toContain("vision:commands");
      expect(childIds).toHaveLength(2);
    });

    it("returns dynamic subcategory IDs from dynamic providers", () => {
      const dynamicSubCategories: CategoryProvider[] = [
        createMockProvider("eslint:rule:no-unused-vars", "no-unused-vars", { parentId: "eslint" }),
        createMockProvider("eslint:rule:no-console", "no-console", { parentId: "eslint" }),
      ];

      const dynamicProvider = createMockProvider("eslint:dynamic-rules", "Issues by Rule", {
        parentId: "eslint",
        isDynamic: true,
        getSubCategories: () => dynamicSubCategories,
      });

      const state: CategorySlice = {
        categoryProviders: new Map([
          ["eslint:commands", createMockProvider("eslint:commands", "Commands", { parentId: "eslint" })],
          ["eslint:dynamic-rules", dynamicProvider],
        ]),
        categoryCache: new Map(),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      const childIds = selectChildCategoryIds(state, "eslint");
      expect(childIds).toContain("eslint:commands");
      expect(childIds).toContain("eslint:dynamic-rules");
      expect(childIds).toContain("eslint:rule:no-unused-vars");
      expect(childIds).toContain("eslint:rule:no-console");
      expect(childIds).toHaveLength(4);
    });

    it("returns empty array when categoryServices is null", () => {
      const dynamicProvider = createMockProvider("eslint:dynamic-rules", "Issues by Rule", {
        parentId: "eslint",
        isDynamic: true,
        getSubCategories: () => [
          createMockProvider("eslint:rule:no-unused-vars", "no-unused-vars", { parentId: "eslint" }),
        ],
      });

      const state: CategorySlice = {
        categoryProviders: new Map([
          ["eslint:commands", createMockProvider("eslint:commands", "Commands", { parentId: "eslint" })],
          ["eslint:dynamic-rules", dynamicProvider],
        ]),
        categoryCache: new Map(),
        categoryLoadingPromises: new Map(),
        categoryServices: null, // No services
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      const childIds = selectChildCategoryIds(state, "eslint");
      // Only direct children, not dynamic ones (since services is null)
      expect(childIds).toContain("eslint:commands");
      expect(childIds).toContain("eslint:dynamic-rules");
      expect(childIds).not.toContain("eslint:rule:no-unused-vars");
      expect(childIds).toHaveLength(2);
    });
  });

  describe("selectIsParentCategory", () => {
    it("returns false for category with no children", () => {
      const state: CategorySlice = {
        categoryProviders: new Map([
          ["standalone", createMockProvider("standalone", "Standalone")],
        ]),
        categoryCache: new Map(),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      expect(selectIsParentCategory(state, "standalone")).toBe(false);
    });

    it("returns true for category with children", () => {
      const state: CategorySlice = {
        categoryProviders: new Map([
          ["eslint:commands", createMockProvider("eslint:commands", "Commands", { parentId: "eslint" })],
        ]),
        categoryCache: new Map(),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      expect(selectIsParentCategory(state, "eslint")).toBe(true);
    });
  });

  describe("selectCategoryItems", () => {
    it("returns empty array for null categoryId", () => {
      const state: CategorySlice = {
        categoryProviders: new Map(),
        categoryCache: new Map(),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      expect(selectCategoryItems(state, null)).toEqual([]);
    });

    it("returns cached items for category", () => {
      const items = [
        createMockItem("item1", "Item 1"),
        createMockItem("item2", "Item 2"),
      ];

      const state: CategorySlice = {
        categoryProviders: new Map(),
        categoryCache: new Map([
          ["eslint:commands", createMockCache(items)],
        ]),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      const result = selectCategoryItems(state, "eslint:commands");
      expect(result).toEqual(items);
    });

    it("returns empty array for category not in cache", () => {
      const state: CategorySlice = {
        categoryProviders: new Map(),
        categoryCache: new Map(),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      expect(selectCategoryItems(state, "nonexistent")).toEqual([]);
    });
  });

  describe("selectAggregatedCategoryItems", () => {
    it("returns empty array for null categoryId", () => {
      const state: CategorySlice = {
        categoryProviders: new Map(),
        categoryCache: new Map(),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      expect(selectAggregatedCategoryItems(state, null)).toEqual([]);
    });

    it("returns direct items for category without children", () => {
      const items = [
        createMockItem("item1", "Item 1"),
        createMockItem("item2", "Item 2"),
      ];

      const state: CategorySlice = {
        categoryProviders: new Map([
          ["standalone", createMockProvider("standalone", "Standalone")],
        ]),
        categoryCache: new Map([
          ["standalone", createMockCache(items)],
        ]),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      expect(selectAggregatedCategoryItems(state, "standalone")).toEqual(items);
    });

    it("aggregates items from all child categories", () => {
      const commandItems = [
        createMockItem("cmd1", "Command 1", 1),
        createMockItem("cmd2", "Command 2", 1),
      ];
      const issueItems = [
        createMockItem("issue1", "Issue 1", 0), // Higher priority (lower number)
        createMockItem("issue2", "Issue 2", 2),
      ];

      const state: CategorySlice = {
        categoryProviders: new Map([
          ["eslint:commands", createMockProvider("eslint:commands", "Commands", { parentId: "eslint" })],
          ["eslint:issues", createMockProvider("eslint:issues", "Issues", { parentId: "eslint" })],
        ]),
        categoryCache: new Map([
          ["eslint:commands", createMockCache(commandItems)],
          ["eslint:issues", createMockCache(issueItems)],
        ]),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      const result = selectAggregatedCategoryItems(state, "eslint");

      // Should include all items from both categories
      expect(result).toHaveLength(4);
      expect(result.map((i) => i.id)).toContain("cmd1");
      expect(result.map((i) => i.id)).toContain("cmd2");
      expect(result.map((i) => i.id)).toContain("issue1");
      expect(result.map((i) => i.id)).toContain("issue2");

      // Should be sorted by priority (issue1 with priority 0 should be first)
      expect(result[0].id).toBe("issue1");
    });

    it("deduplicates items by ID", () => {
      const items1 = [
        createMockItem("shared", "Shared Item"),
        createMockItem("unique1", "Unique 1"),
      ];
      const items2 = [
        createMockItem("shared", "Shared Item Duplicate"), // Same ID
        createMockItem("unique2", "Unique 2"),
      ];

      const state: CategorySlice = {
        categoryProviders: new Map([
          ["parent:child1", createMockProvider("parent:child1", "Child 1", { parentId: "parent" })],
          ["parent:child2", createMockProvider("parent:child2", "Child 2", { parentId: "parent" })],
        ]),
        categoryCache: new Map([
          ["parent:child1", createMockCache(items1)],
          ["parent:child2", createMockCache(items2)],
        ]),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      const result = selectAggregatedCategoryItems(state, "parent");

      // Should only have 3 items (shared item deduplicated)
      expect(result).toHaveLength(3);
      const ids = result.map((i) => i.id);
      expect(ids.filter((id) => id === "shared")).toHaveLength(1);
    });

    it("includes items from dynamic subcategories", () => {
      const commandItems = [createMockItem("cmd1", "Command 1")];
      const rule1Items = [createMockItem("rule1-issue", "Rule 1 Issue", 0)];
      const rule2Items = [createMockItem("rule2-issue", "Rule 2 Issue", 0)];

      const dynamicProvider = createMockProvider("eslint:dynamic-rules", "Issues by Rule", {
        parentId: "eslint",
        isDynamic: true,
        getSubCategories: () => [
          createMockProvider("eslint:rule:no-unused-vars", "no-unused-vars", { parentId: "eslint" }),
          createMockProvider("eslint:rule:no-console", "no-console", { parentId: "eslint" }),
        ],
      });

      const state: CategorySlice = {
        categoryProviders: new Map([
          ["eslint:commands", createMockProvider("eslint:commands", "Commands", { parentId: "eslint" })],
          ["eslint:dynamic-rules", dynamicProvider],
        ]),
        categoryCache: new Map([
          ["eslint:commands", createMockCache(commandItems)],
          ["eslint:dynamic-rules", createMockCache([])], // Dynamic provider itself has no items
          ["eslint:rule:no-unused-vars", createMockCache(rule1Items)],
          ["eslint:rule:no-console", createMockCache(rule2Items)],
        ]),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      const result = selectAggregatedCategoryItems(state, "eslint");

      // Should include items from commands and both dynamic rule categories
      expect(result).toHaveLength(3);
      expect(result.map((i) => i.id)).toContain("cmd1");
      expect(result.map((i) => i.id)).toContain("rule1-issue");
      expect(result.map((i) => i.id)).toContain("rule2-issue");
    });

    it("handles missing cache entries gracefully", () => {
      const commandItems = [createMockItem("cmd1", "Command 1")];

      const state: CategorySlice = {
        categoryProviders: new Map([
          ["eslint:commands", createMockProvider("eslint:commands", "Commands", { parentId: "eslint" })],
          ["eslint:issues", createMockProvider("eslint:issues", "Issues", { parentId: "eslint" })],
        ]),
        categoryCache: new Map([
          ["eslint:commands", createMockCache(commandItems)],
          // eslint:issues not in cache
        ]),
        categoryLoadingPromises: new Map(),
        categoryServices: mockServices,
        categoryTree: [],
        initializeCategoryRegistry: () => {},
        registerCategoryProvider: () => {},
        unregisterCategoryProvider: () => {},
        registerCategoryProvidersFromPlugin: () => {},
        loadCategoryItems: async () => [],
        invalidateCategoryCache: () => {},
        searchCategoryItems: () => [],
      };

      const result = selectAggregatedCategoryItems(state, "eslint");

      // Should still return items from cached category
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("cmd1");
    });
  });
});
