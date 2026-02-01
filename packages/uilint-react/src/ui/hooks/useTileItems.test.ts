/**
 * Tests for useTileItems hook
 * @vitest-environment jsdom
 *
 * Tests tile item aggregation, filtering, deduplication, and loading states.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { TileItem, TileFilter, CategoryProvider, PluginServices } from "../../core/plugin-system/types";

// ============================================================================
// Mocks - Set up before importing the hook
// ============================================================================

const mockGetAllCategoryProviders = vi.fn<() => CategoryProvider[]>(() => []);
const mockGetPluginServices = vi.fn<() => PluginServices | null>(() => null);

vi.mock("../../core/plugin-system/registry", () => ({
  pluginRegistry: {
    getAllCategoryProviders: () => mockGetAllCategoryProviders(),
  },
}));

vi.mock("../../core/store", () => ({
  getPluginServices: () => mockGetPluginServices(),
}));

// Import the hook after mocks are set up
import { useTileItems } from "./useTileItems";

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

function createMockServices(): PluginServices {
  return {
    websocket: {
      isConnected: false,
      url: "ws://localhost:9234",
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      on: vi.fn(() => vi.fn()),
      onConnectionChange: vi.fn(() => vi.fn()),
    },
    domObserver: {
      start: vi.fn(),
      stop: vi.fn(),
      onElementsAdded: vi.fn(() => vi.fn()),
      onElementsRemoved: vi.fn(() => vi.fn()),
    },
    getState: vi.fn(),
    setState: vi.fn(),
    openInspector: vi.fn(),
    closeInspector: vi.fn(),
    closeCommandPalette: vi.fn(),
    invalidateCategory: vi.fn(),
  };
}

// ============================================================================
// useTileItems Tests
// ============================================================================

describe("useTileItems", () => {
  let mockServices: PluginServices;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServices = createMockServices();
    mockGetAllCategoryProviders.mockReturnValue([]);
    mockGetPluginServices.mockReturnValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("empty items when no category providers have getTileItems", () => {
    it("returns empty items when no category providers exist", () => {
      mockGetAllCategoryProviders.mockReturnValue([]);
      mockGetPluginServices.mockReturnValue(mockServices);

      const { result } = renderHook(() =>
        useTileItems([], "", new Set<string>())
      );

      expect(result.current.items).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isTerminal).toBe(false);
    });

    it("returns empty items when no category providers have getTileItems", () => {
      const provider = createMockCategoryProvider({
        id: "provider-no-tiles",
        getTileItems: undefined,
      });
      mockGetAllCategoryProviders.mockReturnValue([provider]);
      mockGetPluginServices.mockReturnValue(mockServices);

      const { result } = renderHook(() =>
        useTileItems([], "", new Set<string>())
      );

      expect(result.current.items).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it("returns empty items when services are not initialized", () => {
      const provider = createMockCategoryProvider({
        getTileItems: vi.fn(() => [createMockTileItem()]),
      });
      mockGetAllCategoryProviders.mockReturnValue([provider]);
      mockGetPluginServices.mockReturnValue(null);

      const { result } = renderHook(() =>
        useTileItems([], "", new Set<string>())
      );

      expect(result.current.items).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("returns items from providers that have getTileItems", () => {
    it("returns items from providers that have getTileItems", async () => {
      const items = [
        createMockTileItem({ id: "item-1", label: "Item 1" }),
        createMockTileItem({ id: "item-2", label: "Item 2" }),
      ];
      const provider = createMockCategoryProvider({
        id: "provider-with-tiles",
        getTileItems: vi.fn(() => items),
      });
      mockGetAllCategoryProviders.mockReturnValue([provider]);
      mockGetPluginServices.mockReturnValue(mockServices);

      const { result } = renderHook(() =>
        useTileItems([], "", new Set<string>())
      );

      await waitFor(() => {
        expect(result.current.items).toHaveLength(2);
      });

      expect(result.current.items[0].id).toBe("item-1");
      expect(result.current.items[1].id).toBe("item-2");
    });

    it("only uses providers from selected categories when provided", async () => {
      const provider1 = createMockCategoryProvider({
        id: "selected-provider",
        getTileItems: vi.fn(() => [
          createMockTileItem({ id: "selected-item", label: "Selected" }),
        ]),
      });
      const provider2 = createMockCategoryProvider({
        id: "other-provider",
        getTileItems: vi.fn(() => [
          createMockTileItem({ id: "other-item", label: "Other" }),
        ]),
      });
      mockGetAllCategoryProviders.mockReturnValue([provider1, provider2]);
      mockGetPluginServices.mockReturnValue(mockServices);

      const selectedCategories = new Set(["selected-provider"]);
      const { result } = renderHook(() =>
        useTileItems([], "", selectedCategories)
      );

      await waitFor(() => {
        expect(result.current.items).toHaveLength(1);
      });

      expect(result.current.items[0].id).toBe("selected-item");
    });
  });

  describe("filters items by query text (matching label and subtitle)", () => {
    it("filters items by label (case-insensitive)", async () => {
      const items = [
        createMockTileItem({ id: "1", label: "Button Component" }),
        createMockTileItem({ id: "2", label: "Input Field" }),
        createMockTileItem({ id: "3", label: "Card Layout" }),
      ];
      const provider = createMockCategoryProvider({
        getTileItems: vi.fn(() => items),
      });
      mockGetAllCategoryProviders.mockReturnValue([provider]);
      mockGetPluginServices.mockReturnValue(mockServices);

      const { result } = renderHook(() =>
        useTileItems([], "button", new Set<string>())
      );

      await waitFor(() => {
        expect(result.current.items).toHaveLength(1);
      });

      expect(result.current.items[0].label).toBe("Button Component");
    });

    it("filters items by subtitle", async () => {
      const items = [
        createMockTileItem({ id: "1", label: "Item 1", subtitle: "Primary button" }),
        createMockTileItem({ id: "2", label: "Item 2", subtitle: "Secondary input" }),
        createMockTileItem({ id: "3", label: "Item 3", subtitle: "Tertiary card" }),
      ];
      const provider = createMockCategoryProvider({
        getTileItems: vi.fn(() => items),
      });
      mockGetAllCategoryProviders.mockReturnValue([provider]);
      mockGetPluginServices.mockReturnValue(mockServices);

      const { result } = renderHook(() =>
        useTileItems([], "input", new Set<string>())
      );

      await waitFor(() => {
        expect(result.current.items).toHaveLength(1);
      });

      expect(result.current.items[0].id).toBe("2");
    });
  });

  describe("deduplicates items by id", () => {
    it("removes duplicate items keeping the first occurrence", async () => {
      const provider1 = createMockCategoryProvider({
        id: "provider-1",
        getTileItems: vi.fn(() => [
          createMockTileItem({ id: "shared-id", label: "First Provider Item" }),
        ]),
      });
      const provider2 = createMockCategoryProvider({
        id: "provider-2",
        getTileItems: vi.fn(() => [
          createMockTileItem({ id: "shared-id", label: "Second Provider Item" }),
        ]),
      });
      mockGetAllCategoryProviders.mockReturnValue([provider1, provider2]);
      mockGetPluginServices.mockReturnValue(mockServices);

      const { result } = renderHook(() =>
        useTileItems([], "", new Set<string>())
      );

      await waitFor(() => {
        expect(result.current.items).toHaveLength(1);
      });

      expect(result.current.items[0].label).toBe("First Provider Item");
    });
  });

  describe("returns isTerminal=true when any provider isTerminal returns true", () => {
    it("returns isTerminal=true when any provider isTerminal returns true", () => {
      const filters: TileFilter[] = [
        { type: "rule", id: "rule-1", label: "Rule 1" },
      ];
      const provider = createMockCategoryProvider({
        getTileItems: vi.fn(() => []),
        isTerminal: vi.fn(() => true),
      });
      mockGetAllCategoryProviders.mockReturnValue([provider]);
      mockGetPluginServices.mockReturnValue(mockServices);

      const { result } = renderHook(() =>
        useTileItems(filters, "", new Set<string>())
      );

      expect(result.current.isTerminal).toBe(true);
      expect(provider.isTerminal).toHaveBeenCalledWith(filters);
    });

    it("returns isTerminal=false when no provider isTerminal returns true", () => {
      const filters: TileFilter[] = [
        { type: "rule", id: "rule-1", label: "Rule 1" },
      ];
      const provider = createMockCategoryProvider({
        getTileItems: vi.fn(() => []),
        isTerminal: vi.fn(() => false),
      });
      mockGetAllCategoryProviders.mockReturnValue([provider]);
      mockGetPluginServices.mockReturnValue(mockServices);

      const { result } = renderHook(() =>
        useTileItems(filters, "", new Set<string>())
      );

      expect(result.current.isTerminal).toBe(false);
    });
  });

  describe("handles loading state for async providers", () => {
    it("sets isLoading=true while fetching async items", async () => {
      let resolvePromise: (items: TileItem[]) => void = () => {};
      const asyncPromise = new Promise<TileItem[]>((resolve) => {
        resolvePromise = resolve;
      });

      const provider = createMockCategoryProvider({
        getTileItems: vi.fn(() => asyncPromise),
      });
      mockGetAllCategoryProviders.mockReturnValue([provider]);
      mockGetPluginServices.mockReturnValue(mockServices);

      const { result } = renderHook(() =>
        useTileItems([], "", new Set<string>())
      );

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);
      expect(result.current.items).toEqual([]);

      // Resolve the promise
      resolvePromise([createMockTileItem({ id: "async-item" })]);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.items).toHaveLength(1);
    });

    it("handles provider errors gracefully", async () => {
      const errorProvider = createMockCategoryProvider({
        id: "error-provider",
        getTileItems: vi.fn(() => {
          throw new Error("Provider error");
        }),
      });
      const successProvider = createMockCategoryProvider({
        id: "success-provider",
        getTileItems: vi.fn(() => [createMockTileItem({ id: "success-item" })]),
      });
      mockGetAllCategoryProviders.mockReturnValue([errorProvider, successProvider]);
      mockGetPluginServices.mockReturnValue(mockServices);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() =>
        useTileItems([], "", new Set<string>())
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].id).toBe("success-item");

      consoleSpy.mockRestore();
    });
  });
});
