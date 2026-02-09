/**
 * Tests for useTileItems hook and tile helper functions
 * @vitest-environment jsdom
 *
 * Tests tile item filtering, deduplication, and computation from providers.
 *
 * Note: Filters have been removed from the tile system. The hook now always
 * returns root-level tiles, and expansion to children is handled by the
 * ExpandableTileGrid component. isTerminal is always false at root level.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { act } from "react";
import type { TileItem, Plugin, PluginServices } from "../../core/plugin-system/types";
import {
  filterByQuery,
  dedupeItems,
} from "../../core/store/tile-selectors";

// ============================================================================
// Mock pluginRegistry and getPluginServices
// ============================================================================

type TileProvider = NonNullable<Plugin['tileProvider']>;
type TileProviderEntry = { pluginId: string; provider: TileProvider };

const mockGetAllTileProviders = vi.fn<() => TileProviderEntry[]>(() => []);

vi.mock("../../core/plugin-system/registry", () => ({
  pluginRegistry: {
    getAllTileProviders: () => mockGetAllTileProviders(),
  },
}));

const mockPluginServices: PluginServices = {
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
    getElements: () => [],
  },
  getState: () => ({}),
  setState: () => {},
  openInspector: () => {},
  closeCommandPalette: () => {},
  closeInspector: () => {},
  invalidateCategory: () => {},
};

vi.mock("../../core/store/composed-store", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../core/store/composed-store")>();
  return {
    ...original,
    getPluginServices: () => mockPluginServices,
  };
});

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

function createMockTileProvider(
  overrides: Partial<TileProvider> = {}
): TileProvider {
  return {
    getTileItems: vi.fn(() => []),
    ...overrides,
  };
}

/**
 * Set up the composed store for hook tests.
 */
function setupStore(options: { query?: string } = {}) {
  createComposedStore({
    websocket: mockPluginServices.websocket,
    domObserver: mockPluginServices.domObserver,
  });

  const api = getStoreApi();
  if (api && options.query) {
    api.setState((state) => ({
      ...state,
      commandPalette: {
        ...state.commandPalette,
        query: options.query ?? "",
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

// ============================================================================
// Hook Integration Tests
// ============================================================================

describe("useTileItems hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllTileProviders.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
    resetStore();
    vi.resetAllMocks();
  });

  describe("computes items from providers", () => {
    it("returns empty items when no providers", () => {
      mockGetAllTileProviders.mockReturnValue([]);
      setupStore();

      const { result } = renderHook(() => useTileItems());

      expect(result.current.items).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it("computes items from provider", () => {
      const items = [
        createMockTileItem({ id: "item-1", label: "Item 1" }),
        createMockTileItem({ id: "item-2", label: "Item 2" }),
      ];
      const provider = createMockTileProvider({
        getTileItems: vi.fn(() => items),
      });
      mockGetAllTileProviders.mockReturnValue([{ pluginId: "test-plugin", provider }]);
      setupStore();

      const { result } = renderHook(() => useTileItems());

      expect(result.current.items).toHaveLength(2);
      expect(result.current.items[0].id).toBe("item-1");
    });

    it("always passes empty filters to provider (no filter system)", () => {
      const provider = createMockTileProvider({
        getTileItems: vi.fn(() => []),
      });
      mockGetAllTileProviders.mockReturnValue([{ pluginId: "test-plugin", provider }]);

      setupStore();

      renderHook(() => useTileItems());

      // Should be called with services and empty array (no filters)
      expect(provider.getTileItems).toHaveBeenCalledWith(
        expect.anything(),
        [] // Empty filters - filtering has been removed
      );
    });

    it("adds providerId to item metadata", () => {
      const items = [createMockTileItem({ id: "item-1" })];
      const provider = createMockTileProvider({
        getTileItems: vi.fn(() => items),
      });
      mockGetAllTileProviders.mockReturnValue([{ pluginId: "my-plugin", provider }]);
      setupStore();

      const { result } = renderHook(() => useTileItems());

      expect(result.current.items[0].metadata?.providerId).toBe("my-plugin");
    });
  });

  describe("filters and deduplicates items", () => {
    it("filters items by query from store", () => {
      const items = [
        createMockTileItem({ id: "1", label: "Button Component" }),
        createMockTileItem({ id: "2", label: "Input Field" }),
      ];
      const provider = createMockTileProvider({
        getTileItems: vi.fn(() => items),
      });
      mockGetAllTileProviders.mockReturnValue([{ pluginId: "test-plugin", provider }]);
      setupStore({ query: "button" });

      const { result } = renderHook(() => useTileItems());

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].label).toBe("Button Component");
    });

    it("deduplicates items by id", () => {
      const items = [
        createMockTileItem({ id: "shared", label: "First" }),
        createMockTileItem({ id: "shared", label: "Second" }),
      ];
      const provider = createMockTileProvider({
        getTileItems: vi.fn(() => items),
      });
      mockGetAllTileProviders.mockReturnValue([{ pluginId: "test-plugin", provider }]);
      setupStore();

      const { result } = renderHook(() => useTileItems());

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].label).toBe("First");
    });
  });

  describe("isTerminal behavior", () => {
    it("returns false always (expansion handles drill-down)", () => {
      const provider = createMockTileProvider();
      mockGetAllTileProviders.mockReturnValue([{ pluginId: "test-plugin", provider }]);
      setupStore();

      const { result } = renderHook(() => useTileItems());

      // isTerminal is always false at root level
      expect(result.current.isTerminal).toBe(false);
    });

    it("returns false even with provider.isTerminal defined", () => {
      // isTerminal on providers is no longer called since filters are removed
      const provider = createMockTileProvider({
        isTerminal: vi.fn(() => true),
      });
      mockGetAllTileProviders.mockReturnValue([{ pluginId: "test-plugin", provider }]);

      setupStore();

      const { result } = renderHook(() => useTileItems());

      // isTerminal is always false - expansion model handles drill-down
      expect(result.current.isTerminal).toBe(false);
    });
  });

  describe("reacts to query changes", () => {
    it("recomputes items when query changes", () => {
      const items = [
        createMockTileItem({ id: "btn", label: "Button" }),
        createMockTileItem({ id: "inp", label: "Input" }),
      ];
      const provider = createMockTileProvider({
        getTileItems: vi.fn(() => items),
      });
      mockGetAllTileProviders.mockReturnValue([{ pluginId: "test-plugin", provider }]);

      const api = setupStore();

      const { result } = renderHook(() => useTileItems());

      // Initially all items
      expect(result.current.items).toHaveLength(2);

      // Update query
      act(() => {
        api?.setState((state) => ({
          ...state,
          commandPalette: {
            ...state.commandPalette,
            query: "button",
          },
        }));
      });

      // Now filtered to just Button
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].label).toBe("Button");
    });
  });

  describe("handles provider errors gracefully", () => {
    it("continues with other providers when one throws", () => {
      const errorProvider = createMockTileProvider({
        getTileItems: vi.fn(() => {
          throw new Error("Provider error");
        }),
      });
      const workingProvider = createMockTileProvider({
        getTileItems: vi.fn(() => [createMockTileItem({ id: "item-1", label: "Working" })]),
      });
      mockGetAllTileProviders.mockReturnValue([
        { pluginId: "error-plugin", provider: errorProvider },
        { pluginId: "working-plugin", provider: workingProvider },
      ]);
      setupStore();

      const { result } = renderHook(() => useTileItems());

      // Should still get items from the working provider
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].label).toBe("Working");
    });
  });
});
