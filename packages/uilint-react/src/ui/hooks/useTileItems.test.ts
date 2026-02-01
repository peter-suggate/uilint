/**
 * Tests for useTileItems hook and tile selectors
 * @vitest-environment jsdom
 *
 * Tests tile item filtering, deduplication, and state access via zustand selectors.
 * Uses real store slices with configurable initial state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { act } from "react";
import type { TileItem, TileFilter, CategoryProvider } from "../../core/plugin-system/types";
import {
  selectRawTileItems,
  selectTileItemsLoading,
  filterByQuery,
  dedupeItems,
} from "../../core/store/tile-selectors";
import type { CoreSlice } from "../../core/store/core-slice";

// ============================================================================
// Mock pluginRegistry for isTerminal tests
// ============================================================================

const mockGetAllCategoryProviders = vi.fn<() => CategoryProvider[]>(() => []);

vi.mock("../../core/plugin-system/registry", () => ({
  pluginRegistry: {
    getAllCategoryProviders: () => mockGetAllCategoryProviders(),
  },
}));

// Import hook after mocks are set up
import { useTileItems } from "./useTileItems";
import {
  createComposedStore,
  resetStore,
  getStoreApi,
} from "../../core/store/composed-store";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockTileItem(overrides: Partial<TileItem> = {}): TileItem {
  return {
    id: `tile-${Math.random().toString(36).slice(2)}`,
    label: "Test Tile",
    count: 1,
    ...overrides,
  };
}

function createMockCategoryProvider(
  overrides: Partial<CategoryProvider> = {}
): CategoryProvider {
  return {
    id: `provider-${Math.random().toString(36).slice(2)}`,
    label: "Test Provider",
    priority: 1,
    getItems: vi.fn(() => []),
    ...overrides,
  };
}

/**
 * Create a minimal state object for testing selectors directly.
 * This allows testing selector logic without needing the full store.
 */
function createTestState(overrides: {
  tileItems?: TileItem[];
  tileItemsLoading?: boolean;
} = {}): CoreSlice {
  return {
    commandPalette: {
      open: false,
      query: "",
      selectedIndex: 0,
      filters: [],
      selectedCategoryIds: new Set(),
      tileItems: overrides.tileItems ?? [],
      tileItemsLoading: overrides.tileItemsLoading ?? false,
    },
    // Other required fields with defaults
    floatingIconPosition: null,
    altKeyHeld: false,
    selectedElementId: null,
    hoveredElementId: null,
    inspector: { open: false, selectedRuleId: null, highlightRuleId: null },
    heatmapFilter: { includeRuleIds: [], excludeRuleIds: [] },
    mobile: { showAllIssues: false, selectedIssueIndex: 0 },
  } as CoreSlice;
}

/**
 * Set up the composed store with specific tile items state.
 * Returns store API for direct state manipulation in tests.
 */
function setupStoreWithTileItems(items: TileItem[], loading = false) {
  // Create a fresh store
  createComposedStore({
    websocket: {
      isConnected: false,
      url: "ws://test:9234",
      connect: () => {},
      disconnect: () => {},
      send: () => {},
      on: () => () => {},
      onConnectionChange: () => () => {},
    },
    domObserver: {
      start: () => {},
      stop: () => {},
      onElementsAdded: () => () => {},
      onElementsRemoved: () => () => {},
    },
  });

  // Get the store API and set tile items state
  const api = getStoreApi();
  if (api) {
    api.setState((state) => ({
      ...state,
      commandPalette: {
        ...state.commandPalette,
        tileItems: items,
        tileItemsLoading: loading,
      },
    }));
  }

  return api;
}

// ============================================================================
// Pure Function Unit Tests
// ============================================================================

describe("Tile Helper Functions", () => {
  describe("filterByQuery", () => {
    it("returns all items when query is empty", () => {
      const items = [
        createMockTileItem({ id: "1", label: "Item 1" }),
        createMockTileItem({ id: "2", label: "Item 2" }),
      ];
      expect(filterByQuery(items, "")).toHaveLength(2);
    });

    it("filters items by label (case-insensitive)", () => {
      const items = [
        createMockTileItem({ id: "1", label: "Button Component" }),
        createMockTileItem({ id: "2", label: "Input Field" }),
        createMockTileItem({ id: "3", label: "Card Layout" }),
      ];
      const result = filterByQuery(items, "button");
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Button Component");
    });

    it("filters items by subtitle", () => {
      const items = [
        createMockTileItem({ id: "1", label: "Item 1", subtitle: "Primary button" }),
        createMockTileItem({ id: "2", label: "Item 2", subtitle: "Secondary input" }),
        createMockTileItem({ id: "3", label: "Item 3", subtitle: "Tertiary card" }),
      ];
      const result = filterByQuery(items, "input");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
    });

    it("returns all items when query is whitespace only", () => {
      const items = [
        createMockTileItem({ id: "1", label: "Item 1" }),
        createMockTileItem({ id: "2", label: "Item 2" }),
      ];
      expect(filterByQuery(items, "   ")).toHaveLength(2);
    });
  });

  describe("dedupeItems", () => {
    it("keeps first occurrence when duplicates exist", () => {
      const items = [
        createMockTileItem({ id: "shared-id", label: "First Item" }),
        createMockTileItem({ id: "shared-id", label: "Second Item" }),
      ];
      const result = dedupeItems(items);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("First Item");
    });

    it("keeps all items when no duplicates", () => {
      const items = [
        createMockTileItem({ id: "1", label: "Item 1" }),
        createMockTileItem({ id: "2", label: "Item 2" }),
        createMockTileItem({ id: "3", label: "Item 3" }),
      ];
      expect(dedupeItems(items)).toHaveLength(3);
    });
  });
});

describe("Tile Selectors", () => {
  describe("selectRawTileItems", () => {
    it("returns tile items from state", () => {
      const items = [createMockTileItem({ id: "1" })];
      const state = createTestState({ tileItems: items });
      expect(selectRawTileItems(state)).toBe(items);
    });

    it("returns empty array when no items", () => {
      const state = createTestState({ tileItems: [] });
      expect(selectRawTileItems(state)).toEqual([]);
    });
  });

  describe("selectTileItemsLoading", () => {
    it("returns false when not loading", () => {
      const state = createTestState({ tileItemsLoading: false });
      expect(selectTileItemsLoading(state)).toBe(false);
    });

    it("returns true when loading", () => {
      const state = createTestState({ tileItemsLoading: true });
      expect(selectTileItemsLoading(state)).toBe(true);
    });
  });
});

// ============================================================================
// Hook Integration Tests (Using Real Store)
// ============================================================================

describe("useTileItems hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllCategoryProviders.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
    resetStore();
    vi.resetAllMocks();
  });

  describe("returns state from store", () => {
    it("returns empty items when store is empty", () => {
      setupStoreWithTileItems([]);

      const { result } = renderHook(() =>
        useTileItems([], "", new Set<string>())
      );

      expect(result.current.items).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isTerminal).toBe(false);
    });

    it("returns items from store", () => {
      const items = [
        createMockTileItem({ id: "item-1", label: "Item 1" }),
        createMockTileItem({ id: "item-2", label: "Item 2" }),
      ];
      setupStoreWithTileItems(items);

      const { result } = renderHook(() =>
        useTileItems([], "", new Set<string>())
      );

      expect(result.current.items).toHaveLength(2);
      expect(result.current.items[0].id).toBe("item-1");
    });

    it("returns loading state from store", () => {
      setupStoreWithTileItems([], true);

      const { result } = renderHook(() =>
        useTileItems([], "", new Set<string>())
      );

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("filters and deduplicates items", () => {
    it("filters items by query", () => {
      const items = [
        createMockTileItem({ id: "1", label: "Button Component" }),
        createMockTileItem({ id: "2", label: "Input Field" }),
      ];
      setupStoreWithTileItems(items);

      const { result } = renderHook(() =>
        useTileItems([], "button", new Set<string>())
      );

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].label).toBe("Button Component");
    });

    it("deduplicates items by id", () => {
      const items = [
        createMockTileItem({ id: "shared", label: "First" }),
        createMockTileItem({ id: "shared", label: "Second" }),
      ];
      setupStoreWithTileItems(items);

      const { result } = renderHook(() =>
        useTileItems([], "", new Set<string>())
      );

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].label).toBe("First");
    });
  });

  describe("computes isTerminal from providers", () => {
    it("returns isTerminal from provider", () => {
      const provider = createMockCategoryProvider({
        getTileItems: vi.fn(() => []),
        isTerminal: vi.fn(() => true),
      });
      mockGetAllCategoryProviders.mockReturnValue([provider]);
      setupStoreWithTileItems([]);

      const filters: TileFilter[] = [{ type: "rule", id: "rule-1", label: "Rule 1" }];
      const { result } = renderHook(() =>
        useTileItems(filters, "", new Set<string>())
      );

      expect(result.current.isTerminal).toBe(true);
    });
  });

  describe("reacts to store updates", () => {
    it("updates when store state changes", () => {
      const api = setupStoreWithTileItems([]);

      const { result } = renderHook(() =>
        useTileItems([], "", new Set<string>())
      );

      expect(result.current.items).toHaveLength(0);

      // Update store with new items
      act(() => {
        api?.setState((state) => ({
          ...state,
          commandPalette: {
            ...state.commandPalette,
            tileItems: [createMockTileItem({ id: "new-item", label: "New Item" })],
          },
        }));
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].label).toBe("New Item");
    });
  });
});
