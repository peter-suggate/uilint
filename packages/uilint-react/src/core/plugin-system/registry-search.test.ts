/**
 * Tests for PluginRegistry search-related methods
 *
 * Tests getAllSearchItems() and getPreviewPanel() which power the
 * two-panel command palette.
 */

import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { createPluginRegistry } from "./registry";
import type { Plugin, PluginServices, SearchItem } from "./types";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockServices(): PluginServices {
  return {
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
    getState: () => ({}),
    setState: () => {},
    openInspector: () => {},
    closeCommandPalette: () => {},
    closeInspector: () => {},
    invalidateCategory: () => {},
  };
}

function createMockPlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    id: `test-plugin-${Math.random().toString(36).slice(2)}`,
    name: "Test Plugin",
    version: "1.0.0",
    ...overrides,
  };
}

function createSearchItem(overrides: Partial<SearchItem> = {}): SearchItem {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    section: "rules",
    label: "Test Item",
    searchFields: { label: "Test Item" },
    ...overrides,
  };
}

// ============================================================================
// getAllSearchItems Tests
// ============================================================================

describe("getAllSearchItems", () => {
  it("returns empty array when no services are set", () => {
    const registry = createPluginRegistry();
    const plugin = createMockPlugin({
      id: "plugin-a",
      getSearchItems: vi.fn(() => [createSearchItem()]),
    });

    registry.register(plugin);
    registry.markPluginInitialized("plugin-a");
    // Services not set

    const items = registry.getAllSearchItems();
    expect(items).toEqual([]);
  });

  it("aggregates items from multiple plugins", () => {
    const registry = createPluginRegistry();
    const services = createMockServices();
    registry.setServices(services);

    const itemA = createSearchItem({ id: "item-a", label: "Item A" });
    const itemB = createSearchItem({ id: "item-b", label: "Item B" });
    const itemC = createSearchItem({ id: "item-c", label: "Item C" });

    const pluginA = createMockPlugin({
      id: "plugin-a",
      getSearchItems: vi.fn(() => [itemA, itemB]),
    });
    const pluginB = createMockPlugin({
      id: "plugin-b",
      getSearchItems: vi.fn(() => [itemC]),
    });

    registry.register(pluginA);
    registry.register(pluginB);
    registry.markPluginInitialized("plugin-a");
    registry.markPluginInitialized("plugin-b");

    const items = registry.getAllSearchItems();
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.id)).toContain("item-a");
    expect(items.map((i) => i.id)).toContain("item-b");
    expect(items.map((i) => i.id)).toContain("item-c");
  });

  it("catches errors from plugins and continues", () => {
    const registry = createPluginRegistry();
    const services = createMockServices();
    registry.setServices(services);

    const goodItem = createSearchItem({ id: "good-item" });

    const errorPlugin = createMockPlugin({
      id: "error-plugin",
      getSearchItems: vi.fn(() => {
        throw new Error("Plugin error");
      }),
    });
    const goodPlugin = createMockPlugin({
      id: "good-plugin",
      getSearchItems: vi.fn(() => [goodItem]),
    });

    registry.register(errorPlugin);
    registry.register(goodPlugin);
    registry.markPluginInitialized("error-plugin");
    registry.markPluginInitialized("good-plugin");

    const items = registry.getAllSearchItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("good-item");
  });

  it("skips uninitialized plugins", () => {
    const registry = createPluginRegistry();
    const services = createMockServices();
    registry.setServices(services);

    const plugin = createMockPlugin({
      id: "uninit-plugin",
      getSearchItems: vi.fn(() => [createSearchItem()]),
    });

    registry.register(plugin);
    // Not calling markPluginInitialized

    const items = registry.getAllSearchItems();
    expect(items).toEqual([]);
    expect(plugin.getSearchItems).not.toHaveBeenCalled();
  });

  it("skips plugins without getSearchItems", () => {
    const registry = createPluginRegistry();
    const services = createMockServices();
    registry.setServices(services);

    const plugin = createMockPlugin({
      id: "no-search",
      // No getSearchItems defined
    });

    registry.register(plugin);
    registry.markPluginInitialized("no-search");

    const items = registry.getAllSearchItems();
    expect(items).toEqual([]);
  });
});

// ============================================================================
// getPreviewPanel Tests
// ============================================================================

describe("getPreviewPanel", () => {
  it("returns null when no services are set", () => {
    const registry = createPluginRegistry();
    const plugin = createMockPlugin({
      id: "plugin-a",
      getPreviewPanel: vi.fn(() => ({ element: createElement("div") })),
    });

    registry.register(plugin);
    registry.markPluginInitialized("plugin-a");
    // Services not set

    const item = createSearchItem();
    const result = registry.getPreviewPanel(item);
    expect(result).toBeNull();
  });

  it("returns first non-null result from plugins", () => {
    const registry = createPluginRegistry();
    const services = createMockServices();
    registry.setServices(services);

    const expectedElement = createElement("div", null, "Preview A");

    const pluginA = createMockPlugin({
      id: "plugin-a",
      getPreviewPanel: vi.fn(() => null),
    });
    const pluginB = createMockPlugin({
      id: "plugin-b",
      getPreviewPanel: vi.fn(() => ({ element: expectedElement })),
    });

    registry.register(pluginA);
    registry.register(pluginB);
    registry.markPluginInitialized("plugin-a");
    registry.markPluginInitialized("plugin-b");

    const item = createSearchItem();
    const result = registry.getPreviewPanel(item);

    expect(result).not.toBeNull();
    expect(result!.element).toBe(expectedElement);
  });

  it("returns null when no plugin provides preview", () => {
    const registry = createPluginRegistry();
    const services = createMockServices();
    registry.setServices(services);

    const pluginA = createMockPlugin({
      id: "plugin-a",
      getPreviewPanel: vi.fn(() => null),
    });
    const pluginB = createMockPlugin({
      id: "plugin-b",
      getPreviewPanel: vi.fn(() => null),
    });

    registry.register(pluginA);
    registry.register(pluginB);
    registry.markPluginInitialized("plugin-a");
    registry.markPluginInitialized("plugin-b");

    const item = createSearchItem();
    const result = registry.getPreviewPanel(item);
    expect(result).toBeNull();
  });

  it("catches errors gracefully from plugin getPreviewPanel", () => {
    const registry = createPluginRegistry();
    const services = createMockServices();
    registry.setServices(services);

    const expectedElement = createElement("div", null, "Good Preview");

    const errorPlugin = createMockPlugin({
      id: "error-plugin",
      getPreviewPanel: vi.fn(() => {
        throw new Error("Preview error");
      }),
    });
    const goodPlugin = createMockPlugin({
      id: "good-plugin",
      getPreviewPanel: vi.fn(() => ({ element: expectedElement })),
    });

    registry.register(errorPlugin);
    registry.register(goodPlugin);
    registry.markPluginInitialized("error-plugin");
    registry.markPluginInitialized("good-plugin");

    const item = createSearchItem();
    const result = registry.getPreviewPanel(item);

    expect(result).not.toBeNull();
    expect(result!.element).toBe(expectedElement);
  });

  it("skips uninitialized plugins", () => {
    const registry = createPluginRegistry();
    const services = createMockServices();
    registry.setServices(services);

    const plugin = createMockPlugin({
      id: "uninit-plugin",
      getPreviewPanel: vi.fn(() => ({
        element: createElement("div"),
      })),
    });

    registry.register(plugin);
    // Not calling markPluginInitialized

    const item = createSearchItem();
    const result = registry.getPreviewPanel(item);
    expect(result).toBeNull();
    expect(plugin.getPreviewPanel).not.toHaveBeenCalled();
  });

  it("skips plugins without getPreviewPanel", () => {
    const registry = createPluginRegistry();
    const services = createMockServices();
    registry.setServices(services);

    const plugin = createMockPlugin({
      id: "no-preview",
      // No getPreviewPanel defined
    });

    registry.register(plugin);
    registry.markPluginInitialized("no-preview");

    const item = createSearchItem();
    const result = registry.getPreviewPanel(item);
    expect(result).toBeNull();
  });
});
