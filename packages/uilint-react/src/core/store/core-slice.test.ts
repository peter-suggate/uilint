/**
 * Unit tests for core-slice.ts
 *
 * Tests the core UI state slice including:
 * - Initial state values
 * - Command palette actions
 * - Inspector actions
 * - Floating icon actions
 * - Alt key mode actions
 * - Selection actions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createCoreSlice,
  type CoreSlice,
  type CommandPaletteFilter,
  type FloatingIconPosition,
} from "./core-slice";
import type { PluginServices, WebSocketService, DOMObserverService } from "../plugin-system/types";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create mock WebSocket service
 */
function createMockWebSocketService(overrides?: Partial<WebSocketService>): WebSocketService {
  return {
    isConnected: false,
    url: "ws://localhost:9234",
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    onConnectionChange: vi.fn(() => vi.fn()),
    ...overrides,
  };
}

/**
 * Create mock DOM observer service
 */
function createMockDOMObserverService(overrides?: Partial<DOMObserverService>): DOMObserverService {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    onElementsAdded: vi.fn(() => vi.fn()),
    onElementsRemoved: vi.fn(() => vi.fn()),
    ...overrides,
  };
}

/**
 * Create mock plugin services
 */
function createMockServices(overrides?: Partial<PluginServices>): PluginServices {
  return {
    websocket: createMockWebSocketService(),
    domObserver: createMockDOMObserverService(),
    getState: vi.fn(),
    setState: vi.fn(),
    openInspector: vi.fn(),
    closeCommandPalette: vi.fn(),
    ...overrides,
  };
}

/**
 * Create a test instance of the core slice with mock set/get functions.
 * Returns the slice state/actions and the mocked set function for verification.
 */
function createTestSlice(services?: PluginServices) {
  const mockServices = services ?? createMockServices();
  const sliceCreator = createCoreSlice(mockServices);

  // Track state updates
  let currentState: CoreSlice;

  // Mock set function that merges partial state
  const mockSet = vi.fn((partial: Partial<CoreSlice> | ((state: CoreSlice) => Partial<CoreSlice>)) => {
    if (typeof partial === "function") {
      const updates = partial(currentState);
      currentState = { ...currentState, ...updates };
    } else {
      currentState = { ...currentState, ...partial };
    }
  });

  // Mock get function that returns current state
  const mockGet = vi.fn(() => currentState);

  // Initialize the slice
  // @ts-expect-error - We're using simplified mock functions
  currentState = sliceCreator(mockSet, mockGet);

  return {
    getState: () => currentState,
    set: mockSet,
    get: mockGet,
    services: mockServices,
  };
}

// ============================================================================
// Initial State Tests
// ============================================================================

describe("Core Slice - Initial State", () => {
  it("has floatingIconPosition as null by default", () => {
    const { getState } = createTestSlice();
    expect(getState().floatingIconPosition).toBeNull();
  });

  it("has altKeyHeld as false by default", () => {
    const { getState } = createTestSlice();
    expect(getState().altKeyHeld).toBe(false);
  });

  it("has selectedElementId as null by default", () => {
    const { getState } = createTestSlice();
    expect(getState().selectedElementId).toBeNull();
  });

  it("has hoveredElementId as null by default", () => {
    const { getState } = createTestSlice();
    expect(getState().hoveredElementId).toBeNull();
  });

  describe("Command Palette Initial State", () => {
    it("has command palette closed by default", () => {
      const { getState } = createTestSlice();
      expect(getState().commandPalette.open).toBe(false);
    });

    it("has empty query by default", () => {
      const { getState } = createTestSlice();
      expect(getState().commandPalette.query).toBe("");
    });

    it("has selectedIndex as 0 by default", () => {
      const { getState } = createTestSlice();
      expect(getState().commandPalette.selectedIndex).toBe(0);
    });

    it("has empty filters array by default", () => {
      const { getState } = createTestSlice();
      expect(getState().commandPalette.filters).toEqual([]);
    });
  });

  describe("Inspector Initial State", () => {
    it("has inspector closed by default", () => {
      const { getState } = createTestSlice();
      expect(getState().inspector.open).toBe(false);
    });

    it("has panelId as null by default", () => {
      const { getState } = createTestSlice();
      expect(getState().inspector.panelId).toBeNull();
    });

    it("has data as null by default", () => {
      const { getState } = createTestSlice();
      expect(getState().inspector.data).toBeNull();
    });

    it("has docked as true by default", () => {
      const { getState } = createTestSlice();
      expect(getState().inspector.docked).toBe(true);
    });

    it("has default width of 400", () => {
      const { getState } = createTestSlice();
      expect(getState().inspector.width).toBe(400);
    });

    it("has floatingPosition as null by default", () => {
      const { getState } = createTestSlice();
      expect(getState().inspector.floatingPosition).toBeNull();
    });

    it("has floatingSize as null by default", () => {
      const { getState } = createTestSlice();
      expect(getState().inspector.floatingSize).toBeNull();
    });
  });

  describe("WebSocket Initial State", () => {
    it("has wsConnected reflecting service state", () => {
      const services = createMockServices({
        websocket: createMockWebSocketService({ isConnected: true }),
      });
      const { getState } = createTestSlice(services);
      expect(getState().wsConnected).toBe(true);
    });

    it("has wsUrl reflecting service url", () => {
      const services = createMockServices({
        websocket: createMockWebSocketService({ url: "ws://custom:8080" }),
      });
      const { getState } = createTestSlice(services);
      expect(getState().wsUrl).toBe("ws://custom:8080");
    });

    it("has default wsUrl as ws://localhost:9234", () => {
      const { getState } = createTestSlice();
      expect(getState().wsUrl).toBe("ws://localhost:9234");
    });
  });
});

// ============================================================================
// Command Palette Actions Tests
// ============================================================================

describe("Core Slice - Command Palette Actions", () => {
  describe("openCommandPalette", () => {
    it("sets open to true", () => {
      const { getState } = createTestSlice();

      getState().openCommandPalette();

      expect(getState().commandPalette.open).toBe(true);
    });

    it("resets query to empty string", () => {
      const { getState } = createTestSlice();

      // First set a query
      getState().setCommandPaletteQuery("test query");
      expect(getState().commandPalette.query).toBe("test query");

      // Open should reset query
      getState().openCommandPalette();

      expect(getState().commandPalette.query).toBe("");
    });

    it("resets selectedIndex to 0", () => {
      const { getState } = createTestSlice();

      // First set a selected index
      getState().setCommandPaletteSelectedIndex(5);
      expect(getState().commandPalette.selectedIndex).toBe(5);

      // Open should reset index
      getState().openCommandPalette();

      expect(getState().commandPalette.selectedIndex).toBe(0);
    });

    it("preserves existing filters when opening", () => {
      const { getState } = createTestSlice();

      const filter: CommandPaletteFilter = {
        type: "rule",
        value: "uilint/semantic",
        label: "Semantic",
      };
      getState().addFilter(filter);

      getState().openCommandPalette();

      expect(getState().commandPalette.filters).toHaveLength(1);
      expect(getState().commandPalette.filters[0]).toEqual(filter);
    });
  });

  describe("closeCommandPalette", () => {
    it("sets open to false", () => {
      const { getState } = createTestSlice();

      getState().openCommandPalette();
      expect(getState().commandPalette.open).toBe(true);

      getState().closeCommandPalette();

      expect(getState().commandPalette.open).toBe(false);
    });

    it("resets to default state", () => {
      const { getState } = createTestSlice();

      // Set up various state
      getState().openCommandPalette();
      getState().setCommandPaletteQuery("search term");
      getState().setCommandPaletteSelectedIndex(3);
      getState().addFilter({ type: "rule", value: "test", label: "Test" });

      getState().closeCommandPalette();

      expect(getState().commandPalette.open).toBe(false);
      expect(getState().commandPalette.query).toBe("");
      expect(getState().commandPalette.selectedIndex).toBe(0);
      expect(getState().commandPalette.filters).toEqual([]);
    });
  });

  describe("setCommandPaletteQuery", () => {
    it("updates the query", () => {
      const { getState } = createTestSlice();

      getState().setCommandPaletteQuery("new search");

      expect(getState().commandPalette.query).toBe("new search");
    });

    it("resets selectedIndex to 0 when query changes", () => {
      const { getState } = createTestSlice();

      getState().setCommandPaletteSelectedIndex(5);

      getState().setCommandPaletteQuery("search");

      expect(getState().commandPalette.selectedIndex).toBe(0);
    });

    it("can set empty query", () => {
      const { getState } = createTestSlice();

      getState().setCommandPaletteQuery("test");
      getState().setCommandPaletteQuery("");

      expect(getState().commandPalette.query).toBe("");
    });
  });

  describe("setCommandPaletteSelectedIndex", () => {
    it("updates the selected index", () => {
      const { getState } = createTestSlice();

      getState().setCommandPaletteSelectedIndex(3);

      expect(getState().commandPalette.selectedIndex).toBe(3);
    });

    it("can set index to 0", () => {
      const { getState } = createTestSlice();

      getState().setCommandPaletteSelectedIndex(5);
      getState().setCommandPaletteSelectedIndex(0);

      expect(getState().commandPalette.selectedIndex).toBe(0);
    });

    it("preserves query when changing index", () => {
      const { getState } = createTestSlice();

      getState().setCommandPaletteQuery("test query");
      getState().setCommandPaletteSelectedIndex(2);

      expect(getState().commandPalette.query).toBe("test query");
    });
  });

  describe("addFilter", () => {
    it("adds a filter to the filters array", () => {
      const { getState } = createTestSlice();

      const filter: CommandPaletteFilter = {
        type: "rule",
        value: "uilint/semantic",
        label: "Semantic Rule",
      };

      getState().addFilter(filter);

      expect(getState().commandPalette.filters).toHaveLength(1);
      expect(getState().commandPalette.filters[0]).toEqual(filter);
    });

    it("can add multiple filters", () => {
      const { getState } = createTestSlice();

      const filter1: CommandPaletteFilter = { type: "rule", value: "rule1", label: "Rule 1" };
      const filter2: CommandPaletteFilter = { type: "file", value: "file.tsx", label: "file.tsx" };
      const filter3: CommandPaletteFilter = { type: "plugin", value: "eslint", label: "ESLint" };

      getState().addFilter(filter1);
      getState().addFilter(filter2);
      getState().addFilter(filter3);

      expect(getState().commandPalette.filters).toHaveLength(3);
      expect(getState().commandPalette.filters[0]).toEqual(filter1);
      expect(getState().commandPalette.filters[1]).toEqual(filter2);
      expect(getState().commandPalette.filters[2]).toEqual(filter3);
    });

    it("resets selectedIndex to 0 when adding filter", () => {
      const { getState } = createTestSlice();

      getState().setCommandPaletteSelectedIndex(5);

      getState().addFilter({ type: "issue", value: "issue1", label: "Issue 1" });

      expect(getState().commandPalette.selectedIndex).toBe(0);
    });

    it("supports all filter types", () => {
      const { getState } = createTestSlice();

      const filterTypes: CommandPaletteFilter["type"][] = [
        "rule",
        "issue",
        "loc",
        "file",
        "capture",
        "plugin",
      ];

      filterTypes.forEach((type, index) => {
        getState().addFilter({ type, value: `value-${index}`, label: `Label ${index}` });
      });

      expect(getState().commandPalette.filters).toHaveLength(6);
      filterTypes.forEach((type, index) => {
        expect(getState().commandPalette.filters[index].type).toBe(type);
      });
    });
  });

  describe("removeFilter", () => {
    it("removes filter at specified index", () => {
      const { getState } = createTestSlice();

      getState().addFilter({ type: "rule", value: "rule1", label: "Rule 1" });
      getState().addFilter({ type: "file", value: "file.tsx", label: "file.tsx" });
      getState().addFilter({ type: "plugin", value: "eslint", label: "ESLint" });

      getState().removeFilter(1);

      expect(getState().commandPalette.filters).toHaveLength(2);
      expect(getState().commandPalette.filters[0].value).toBe("rule1");
      expect(getState().commandPalette.filters[1].value).toBe("eslint");
    });

    it("removes first filter correctly", () => {
      const { getState } = createTestSlice();

      getState().addFilter({ type: "rule", value: "rule1", label: "Rule 1" });
      getState().addFilter({ type: "file", value: "file.tsx", label: "file.tsx" });

      getState().removeFilter(0);

      expect(getState().commandPalette.filters).toHaveLength(1);
      expect(getState().commandPalette.filters[0].value).toBe("file.tsx");
    });

    it("removes last filter correctly", () => {
      const { getState } = createTestSlice();

      getState().addFilter({ type: "rule", value: "rule1", label: "Rule 1" });
      getState().addFilter({ type: "file", value: "file.tsx", label: "file.tsx" });

      getState().removeFilter(1);

      expect(getState().commandPalette.filters).toHaveLength(1);
      expect(getState().commandPalette.filters[0].value).toBe("rule1");
    });

    it("resets selectedIndex to 0 when removing filter", () => {
      const { getState } = createTestSlice();

      getState().addFilter({ type: "rule", value: "rule1", label: "Rule 1" });
      getState().setCommandPaletteSelectedIndex(5);

      getState().removeFilter(0);

      expect(getState().commandPalette.selectedIndex).toBe(0);
    });

    it("handles removing from empty array gracefully", () => {
      const { getState } = createTestSlice();

      // Should not throw
      getState().removeFilter(0);

      expect(getState().commandPalette.filters).toEqual([]);
    });
  });

  describe("clearFilters", () => {
    it("removes all filters", () => {
      const { getState } = createTestSlice();

      getState().addFilter({ type: "rule", value: "rule1", label: "Rule 1" });
      getState().addFilter({ type: "file", value: "file.tsx", label: "file.tsx" });
      getState().addFilter({ type: "plugin", value: "eslint", label: "ESLint" });

      getState().clearFilters();

      expect(getState().commandPalette.filters).toEqual([]);
    });

    it("resets selectedIndex to 0", () => {
      const { getState } = createTestSlice();

      getState().addFilter({ type: "rule", value: "rule1", label: "Rule 1" });
      getState().setCommandPaletteSelectedIndex(3);

      getState().clearFilters();

      expect(getState().commandPalette.selectedIndex).toBe(0);
    });

    it("works when filters are already empty", () => {
      const { getState } = createTestSlice();

      getState().clearFilters();

      expect(getState().commandPalette.filters).toEqual([]);
    });

    it("preserves query when clearing filters", () => {
      const { getState } = createTestSlice();

      getState().setCommandPaletteQuery("test query");
      getState().addFilter({ type: "rule", value: "rule1", label: "Rule 1" });

      getState().clearFilters();

      expect(getState().commandPalette.query).toBe("test query");
    });
  });
});

// ============================================================================
// Inspector Actions Tests
// ============================================================================

describe("Core Slice - Inspector Actions", () => {
  describe("openInspector", () => {
    it("sets open to true", () => {
      const { getState } = createTestSlice();

      getState().openInspector("test-panel");

      expect(getState().inspector.open).toBe(true);
    });

    it("sets panelId to the provided value", () => {
      const { getState } = createTestSlice();

      getState().openInspector("element-inspector");

      expect(getState().inspector.panelId).toBe("element-inspector");
    });

    it("sets data when provided", () => {
      const { getState } = createTestSlice();

      const data = { elementId: "el-123", ruleId: "uilint/semantic" };
      getState().openInspector("issue-panel", data);

      expect(getState().inspector.data).toEqual(data);
    });

    it("sets data to null when not provided", () => {
      const { getState } = createTestSlice();

      getState().openInspector("test-panel");

      expect(getState().inspector.data).toBeNull();
    });

    it("preserves docked state when opening", () => {
      const { getState } = createTestSlice();

      // Toggle to floating
      getState().toggleInspectorDocked();
      expect(getState().inspector.docked).toBe(false);

      getState().openInspector("test-panel");

      expect(getState().inspector.docked).toBe(false);
    });

    it("preserves width when opening", () => {
      const { getState } = createTestSlice();

      getState().setInspectorWidth(500);

      getState().openInspector("test-panel");

      expect(getState().inspector.width).toBe(500);
    });

    it("can switch panels while open", () => {
      const { getState } = createTestSlice();

      getState().openInspector("panel-1", { foo: "bar" });
      expect(getState().inspector.panelId).toBe("panel-1");
      expect(getState().inspector.data).toEqual({ foo: "bar" });

      getState().openInspector("panel-2", { baz: "qux" });

      expect(getState().inspector.open).toBe(true);
      expect(getState().inspector.panelId).toBe("panel-2");
      expect(getState().inspector.data).toEqual({ baz: "qux" });
    });
  });

  describe("closeInspector", () => {
    it("sets open to false", () => {
      const { getState } = createTestSlice();

      getState().openInspector("test-panel");
      expect(getState().inspector.open).toBe(true);

      getState().closeInspector();

      expect(getState().inspector.open).toBe(false);
    });

    it("clears panelId to null", () => {
      const { getState } = createTestSlice();

      getState().openInspector("test-panel");

      getState().closeInspector();

      expect(getState().inspector.panelId).toBeNull();
    });

    it("clears data to null", () => {
      const { getState } = createTestSlice();

      getState().openInspector("test-panel", { key: "value" });

      getState().closeInspector();

      expect(getState().inspector.data).toBeNull();
    });

    it("preserves docked state when closing", () => {
      const { getState } = createTestSlice();

      getState().toggleInspectorDocked();
      getState().openInspector("test-panel");

      getState().closeInspector();

      expect(getState().inspector.docked).toBe(false);
    });

    it("preserves width when closing", () => {
      const { getState } = createTestSlice();

      getState().setInspectorWidth(600);
      getState().openInspector("test-panel");

      getState().closeInspector();

      expect(getState().inspector.width).toBe(600);
    });

    it("preserves floating position when closing", () => {
      const { getState } = createTestSlice();

      getState().setInspectorFloatingPosition({ x: 100, y: 200 });
      getState().openInspector("test-panel");

      getState().closeInspector();

      expect(getState().inspector.floatingPosition).toEqual({ x: 100, y: 200 });
    });
  });

  describe("toggleInspectorDocked", () => {
    it("toggles from docked to floating", () => {
      const { getState } = createTestSlice();

      expect(getState().inspector.docked).toBe(true);

      getState().toggleInspectorDocked();

      expect(getState().inspector.docked).toBe(false);
    });

    it("toggles from floating to docked", () => {
      const { getState } = createTestSlice();

      getState().toggleInspectorDocked();
      expect(getState().inspector.docked).toBe(false);

      getState().toggleInspectorDocked();

      expect(getState().inspector.docked).toBe(true);
    });

    it("preserves open state when toggling", () => {
      const { getState } = createTestSlice();

      getState().openInspector("test-panel");

      getState().toggleInspectorDocked();

      expect(getState().inspector.open).toBe(true);
    });
  });

  describe("setInspectorWidth", () => {
    it("updates the width", () => {
      const { getState } = createTestSlice();

      getState().setInspectorWidth(500);

      expect(getState().inspector.width).toBe(500);
    });

    it("can set various widths", () => {
      const { getState } = createTestSlice();

      const widths = [200, 300, 400, 500, 600, 800];
      widths.forEach((width) => {
        getState().setInspectorWidth(width);
        expect(getState().inspector.width).toBe(width);
      });
    });

    it("preserves other inspector state when updating width", () => {
      const { getState } = createTestSlice();

      getState().openInspector("test-panel", { key: "value" });
      getState().toggleInspectorDocked();

      getState().setInspectorWidth(550);

      expect(getState().inspector.open).toBe(true);
      expect(getState().inspector.panelId).toBe("test-panel");
      expect(getState().inspector.data).toEqual({ key: "value" });
      expect(getState().inspector.docked).toBe(false);
    });
  });

  describe("setInspectorFloatingPosition", () => {
    it("updates the floating position", () => {
      const { getState } = createTestSlice();

      getState().setInspectorFloatingPosition({ x: 100, y: 200 });

      expect(getState().inspector.floatingPosition).toEqual({ x: 100, y: 200 });
    });

    it("can update position multiple times", () => {
      const { getState } = createTestSlice();

      getState().setInspectorFloatingPosition({ x: 0, y: 0 });
      expect(getState().inspector.floatingPosition).toEqual({ x: 0, y: 0 });

      getState().setInspectorFloatingPosition({ x: 500, y: 300 });
      expect(getState().inspector.floatingPosition).toEqual({ x: 500, y: 300 });
    });

    it("preserves other inspector state", () => {
      const { getState } = createTestSlice();

      getState().openInspector("test-panel");
      getState().setInspectorWidth(500);

      getState().setInspectorFloatingPosition({ x: 150, y: 250 });

      expect(getState().inspector.open).toBe(true);
      expect(getState().inspector.width).toBe(500);
    });
  });

  describe("setInspectorFloatingSize", () => {
    it("updates the floating size", () => {
      const { getState } = createTestSlice();

      getState().setInspectorFloatingSize({ width: 400, height: 600 });

      expect(getState().inspector.floatingSize).toEqual({ width: 400, height: 600 });
    });

    it("can update size multiple times", () => {
      const { getState } = createTestSlice();

      getState().setInspectorFloatingSize({ width: 300, height: 400 });
      expect(getState().inspector.floatingSize).toEqual({ width: 300, height: 400 });

      getState().setInspectorFloatingSize({ width: 500, height: 700 });
      expect(getState().inspector.floatingSize).toEqual({ width: 500, height: 700 });
    });

    it("preserves other inspector state", () => {
      const { getState } = createTestSlice();

      getState().openInspector("test-panel");
      getState().setInspectorFloatingPosition({ x: 100, y: 100 });

      getState().setInspectorFloatingSize({ width: 350, height: 450 });

      expect(getState().inspector.open).toBe(true);
      expect(getState().inspector.floatingPosition).toEqual({ x: 100, y: 100 });
    });
  });
});

// ============================================================================
// Floating Icon Actions Tests
// ============================================================================

describe("Core Slice - Floating Icon Actions", () => {
  describe("setFloatingIconPosition", () => {
    it("updates the position", () => {
      const { getState } = createTestSlice();

      const position: FloatingIconPosition = { x: 100, y: 50 };
      getState().setFloatingIconPosition(position);

      expect(getState().floatingIconPosition).toEqual(position);
    });

    it("can set position to various coordinates", () => {
      const { getState } = createTestSlice();

      const positions: FloatingIconPosition[] = [
        { x: 0, y: 0 },
        { x: 100, y: 200 },
        { x: -50, y: 300 },
        { x: 1920, y: 1080 },
      ];

      positions.forEach((position) => {
        getState().setFloatingIconPosition(position);
        expect(getState().floatingIconPosition).toEqual(position);
      });
    });

    it("overwrites previous position", () => {
      const { getState } = createTestSlice();

      getState().setFloatingIconPosition({ x: 100, y: 100 });
      getState().setFloatingIconPosition({ x: 200, y: 200 });

      expect(getState().floatingIconPosition).toEqual({ x: 200, y: 200 });
    });
  });
});

// ============================================================================
// Alt Key Mode Actions Tests
// ============================================================================

describe("Core Slice - Alt Key Mode Actions", () => {
  describe("setAltKeyHeld", () => {
    it("sets altKeyHeld to true", () => {
      const { getState } = createTestSlice();

      getState().setAltKeyHeld(true);

      expect(getState().altKeyHeld).toBe(true);
    });

    it("sets altKeyHeld to false", () => {
      const { getState } = createTestSlice();

      getState().setAltKeyHeld(true);
      getState().setAltKeyHeld(false);

      expect(getState().altKeyHeld).toBe(false);
    });

    it("can toggle multiple times", () => {
      const { getState } = createTestSlice();

      getState().setAltKeyHeld(true);
      expect(getState().altKeyHeld).toBe(true);

      getState().setAltKeyHeld(false);
      expect(getState().altKeyHeld).toBe(false);

      getState().setAltKeyHeld(true);
      expect(getState().altKeyHeld).toBe(true);
    });
  });
});

// ============================================================================
// Selection Actions Tests
// ============================================================================

describe("Core Slice - Selection Actions", () => {
  describe("setSelectedElementId", () => {
    it("sets the selected element ID", () => {
      const { getState } = createTestSlice();

      getState().setSelectedElementId("element-123");

      expect(getState().selectedElementId).toBe("element-123");
    });

    it("can clear selection by setting to null", () => {
      const { getState } = createTestSlice();

      getState().setSelectedElementId("element-123");
      expect(getState().selectedElementId).toBe("element-123");

      getState().setSelectedElementId(null);

      expect(getState().selectedElementId).toBeNull();
    });

    it("can change selection", () => {
      const { getState } = createTestSlice();

      getState().setSelectedElementId("element-1");
      getState().setSelectedElementId("element-2");

      expect(getState().selectedElementId).toBe("element-2");
    });

    it("does not affect hovered element", () => {
      const { getState } = createTestSlice();

      getState().setHoveredElementId("hovered-element");

      getState().setSelectedElementId("selected-element");

      expect(getState().hoveredElementId).toBe("hovered-element");
      expect(getState().selectedElementId).toBe("selected-element");
    });
  });

  describe("setHoveredElementId", () => {
    it("sets the hovered element ID", () => {
      const { getState } = createTestSlice();

      getState().setHoveredElementId("element-456");

      expect(getState().hoveredElementId).toBe("element-456");
    });

    it("can clear hover by setting to null", () => {
      const { getState } = createTestSlice();

      getState().setHoveredElementId("element-456");
      expect(getState().hoveredElementId).toBe("element-456");

      getState().setHoveredElementId(null);

      expect(getState().hoveredElementId).toBeNull();
    });

    it("can change hovered element rapidly", () => {
      const { getState } = createTestSlice();

      const elementIds = ["el-1", "el-2", "el-3", "el-4", "el-5"];
      elementIds.forEach((id) => {
        getState().setHoveredElementId(id);
        expect(getState().hoveredElementId).toBe(id);
      });
    });

    it("does not affect selected element", () => {
      const { getState } = createTestSlice();

      getState().setSelectedElementId("selected-element");

      getState().setHoveredElementId("hovered-element");

      expect(getState().selectedElementId).toBe("selected-element");
      expect(getState().hoveredElementId).toBe("hovered-element");
    });
  });

  describe("selection and hover interaction", () => {
    it("allows same element to be both selected and hovered", () => {
      const { getState } = createTestSlice();

      getState().setSelectedElementId("element-1");
      getState().setHoveredElementId("element-1");

      expect(getState().selectedElementId).toBe("element-1");
      expect(getState().hoveredElementId).toBe("element-1");
    });

    it("allows independent clearing of selection and hover", () => {
      const { getState } = createTestSlice();

      getState().setSelectedElementId("element-1");
      getState().setHoveredElementId("element-2");

      getState().setHoveredElementId(null);

      expect(getState().selectedElementId).toBe("element-1");
      expect(getState().hoveredElementId).toBeNull();
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Core Slice - Integration", () => {
  it("maintains independent state between command palette and inspector", () => {
    const { getState } = createTestSlice();

    getState().openCommandPalette();
    getState().openInspector("test-panel", { data: "value" });

    expect(getState().commandPalette.open).toBe(true);
    expect(getState().inspector.open).toBe(true);

    getState().closeCommandPalette();

    expect(getState().commandPalette.open).toBe(false);
    expect(getState().inspector.open).toBe(true);
  });

  it("maintains selection state when opening/closing UI elements", () => {
    const { getState } = createTestSlice();

    getState().setSelectedElementId("element-123");
    getState().setHoveredElementId("element-456");

    getState().openCommandPalette();
    getState().openInspector("panel");

    expect(getState().selectedElementId).toBe("element-123");
    expect(getState().hoveredElementId).toBe("element-456");

    getState().closeCommandPalette();
    getState().closeInspector();

    expect(getState().selectedElementId).toBe("element-123");
    expect(getState().hoveredElementId).toBe("element-456");
  });

  it("preserves floating icon position through other state changes", () => {
    const { getState } = createTestSlice();

    getState().setFloatingIconPosition({ x: 500, y: 100 });

    getState().openCommandPalette();
    getState().setCommandPaletteQuery("test");
    getState().openInspector("panel");
    getState().setSelectedElementId("el-1");

    expect(getState().floatingIconPosition).toEqual({ x: 500, y: 100 });
  });

  it("preserves alt key state through other state changes", () => {
    const { getState } = createTestSlice();

    getState().setAltKeyHeld(true);

    getState().openCommandPalette();
    getState().openInspector("panel");

    expect(getState().altKeyHeld).toBe(true);

    getState().closeCommandPalette();
    getState().closeInspector();

    expect(getState().altKeyHeld).toBe(true);
  });
});

// ============================================================================
// Service Integration Tests
// ============================================================================

describe("Core Slice - Service Integration", () => {
  it("uses websocket service isConnected value", () => {
    const connectedServices = createMockServices({
      websocket: createMockWebSocketService({ isConnected: true }),
    });
    const { getState: getConnectedState } = createTestSlice(connectedServices);

    const disconnectedServices = createMockServices({
      websocket: createMockWebSocketService({ isConnected: false }),
    });
    const { getState: getDisconnectedState } = createTestSlice(disconnectedServices);

    expect(getConnectedState().wsConnected).toBe(true);
    expect(getDisconnectedState().wsConnected).toBe(false);
  });

  it("uses websocket service url value", () => {
    const customUrlServices = createMockServices({
      websocket: createMockWebSocketService({ url: "ws://custom-server:8080" }),
    });
    const { getState } = createTestSlice(customUrlServices);

    expect(getState().wsUrl).toBe("ws://custom-server:8080");
  });
});
