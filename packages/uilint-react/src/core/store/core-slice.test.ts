/**
 * Unit tests for core-slice.ts
 *
 * Tests the core UI state slice including:
 * - Initial state values
 * - Command palette actions
 * - Inspector actions
 * - Alt key mode actions
 * - Selection actions
 */

import { describe, it, expect, vi } from "vitest";
import {
  createCoreSlice,
  type CoreSlice,
  type CommandPaletteFilter,
  type MobileState,
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

  describe("Mobile State Initial Values", () => {
    it("has isMobile as false by default", () => {
      const { getState } = createTestSlice();
      expect(getState().mobile.isMobile).toBe(false);
    });

    it("has isTablet as false by default", () => {
      const { getState } = createTestSlice();
      expect(getState().mobile.isTablet).toBe(false);
    });

    it("has isTouchDevice as false by default", () => {
      const { getState } = createTestSlice();
      expect(getState().mobile.isTouchDevice).toBe(false);
    });

    it("has isSmallScreen as false by default", () => {
      const { getState } = createTestSlice();
      expect(getState().mobile.isSmallScreen).toBe(false);
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

  });

  describe("closeCommandPalette", () => {
    it("sets open to false", () => {
      const { getState } = createTestSlice();

      getState().openCommandPalette();
      expect(getState().commandPalette.open).toBe(true);

      getState().closeCommandPalette();

      expect(getState().commandPalette.open).toBe(false);
    });

    it("resets query and index", () => {
      const { getState } = createTestSlice();

      // Set up various state
      getState().openCommandPalette();
      getState().setCommandPaletteQuery("search term");
      getState().setCommandPaletteSelectedIndex(3);

      getState().closeCommandPalette();

      expect(getState().commandPalette.open).toBe(false);
      expect(getState().commandPalette.query).toBe("");
      expect(getState().commandPalette.selectedIndex).toBe(0);
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
// Mobile State Actions Tests
// ============================================================================

describe("Core Slice - Mobile State Actions", () => {
  describe("setMobileState", () => {
    it("updates all mobile state properties", () => {
      const { getState } = createTestSlice();

      const newState: MobileState = {
        isMobile: true,
        isTablet: false,
        isTouchDevice: true,
        isSmallScreen: true,
      };

      getState().setMobileState(newState);

      expect(getState().mobile).toEqual(newState);
    });

    it("can set mobile device state", () => {
      const { getState } = createTestSlice();

      getState().setMobileState({
        isMobile: true,
        isTablet: false,
        isTouchDevice: true,
        isSmallScreen: false,
      });

      expect(getState().mobile.isMobile).toBe(true);
      expect(getState().mobile.isTouchDevice).toBe(true);
    });

    it("can set tablet device state", () => {
      const { getState } = createTestSlice();

      getState().setMobileState({
        isMobile: false,
        isTablet: true,
        isTouchDevice: true,
        isSmallScreen: false,
      });

      expect(getState().mobile.isTablet).toBe(true);
      expect(getState().mobile.isMobile).toBe(false);
    });

    it("can set small screen state", () => {
      const { getState } = createTestSlice();

      getState().setMobileState({
        isMobile: true,
        isTablet: false,
        isTouchDevice: false,
        isSmallScreen: true,
      });

      expect(getState().mobile.isSmallScreen).toBe(true);
    });

    it("can update state multiple times (simulating resize)", () => {
      const { getState } = createTestSlice();

      // Start at desktop
      getState().setMobileState({
        isMobile: false,
        isTablet: false,
        isTouchDevice: false,
        isSmallScreen: false,
      });
      expect(getState().mobile.isMobile).toBe(false);

      // Resize to tablet
      getState().setMobileState({
        isMobile: false,
        isTablet: true,
        isTouchDevice: false,
        isSmallScreen: false,
      });
      expect(getState().mobile.isTablet).toBe(true);

      // Resize to mobile
      getState().setMobileState({
        isMobile: true,
        isTablet: false,
        isTouchDevice: false,
        isSmallScreen: false,
      });
      expect(getState().mobile.isMobile).toBe(true);
      expect(getState().mobile.isTablet).toBe(false);
    });

    it("does not affect other state when updating mobile state", () => {
      const { getState } = createTestSlice();

      // Set up various state
      getState().openCommandPalette();
      getState().setSelectedElementId("element-123");

      getState().setMobileState({
        isMobile: true,
        isTablet: false,
        isTouchDevice: true,
        isSmallScreen: true,
      });

      // Verify other state is preserved
      expect(getState().commandPalette.open).toBe(true);
      expect(getState().selectedElementId).toBe("element-123");
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
// Heatmap Filter Actions Tests
// ============================================================================

describe("Core Slice - Heatmap Filter Actions", () => {
  describe("heatmapFilter Initial State", () => {
    it("has mode as 'all' by default", () => {
      const { getState } = createTestSlice();
      expect(getState().heatmapFilter.mode).toBe("all");
    });

    it("has empty highlightedLocs array by default", () => {
      const { getState } = createTestSlice();
      expect(getState().heatmapFilter.highlightedLocs).toEqual([]);
    });

    it("has filterLabel as null by default", () => {
      const { getState } = createTestSlice();
      expect(getState().heatmapFilter.filterLabel).toBeNull();
    });
  });

  describe("setHeatmapFilter", () => {
    it("sets mode to 'related-only' when locs provided", () => {
      const { getState } = createTestSlice();

      getState().setHeatmapFilter(["loc1", "loc2"]);

      expect(getState().heatmapFilter.mode).toBe("related-only");
    });

    it("sets mode to 'all' when empty locs provided", () => {
      const { getState } = createTestSlice();

      getState().setHeatmapFilter(["loc1"]);
      expect(getState().heatmapFilter.mode).toBe("related-only");

      getState().setHeatmapFilter([]);

      expect(getState().heatmapFilter.mode).toBe("all");
    });

    it("stores the provided locations", () => {
      const { getState } = createTestSlice();
      const locs = ["file.tsx:10:5", "file.tsx:25:10"];

      getState().setHeatmapFilter(locs);

      expect(getState().heatmapFilter.highlightedLocs).toEqual(locs);
    });

    it("sets filterLabel when provided", () => {
      const { getState } = createTestSlice();

      getState().setHeatmapFilter(["loc1"], "Duplicate Pair");

      expect(getState().heatmapFilter.filterLabel).toBe("Duplicate Pair");
    });

    it("sets filterLabel to null when not provided", () => {
      const { getState } = createTestSlice();

      getState().setHeatmapFilter(["loc1"]);

      expect(getState().heatmapFilter.filterLabel).toBeNull();
    });

    it("can update filter multiple times", () => {
      const { getState } = createTestSlice();

      getState().setHeatmapFilter(["loc1"], "First");
      expect(getState().heatmapFilter.highlightedLocs).toEqual(["loc1"]);
      expect(getState().heatmapFilter.filterLabel).toBe("First");

      getState().setHeatmapFilter(["loc2", "loc3"], "Second");
      expect(getState().heatmapFilter.highlightedLocs).toEqual(["loc2", "loc3"]);
      expect(getState().heatmapFilter.filterLabel).toBe("Second");
    });
  });

  describe("clearHeatmapFilter", () => {
    it("resets mode to 'all'", () => {
      const { getState } = createTestSlice();

      getState().setHeatmapFilter(["loc1", "loc2"]);
      expect(getState().heatmapFilter.mode).toBe("related-only");

      getState().clearHeatmapFilter();

      expect(getState().heatmapFilter.mode).toBe("all");
    });

    it("clears highlightedLocs to empty array", () => {
      const { getState } = createTestSlice();

      getState().setHeatmapFilter(["loc1", "loc2"]);

      getState().clearHeatmapFilter();

      expect(getState().heatmapFilter.highlightedLocs).toEqual([]);
    });

    it("clears filterLabel to null", () => {
      const { getState } = createTestSlice();

      getState().setHeatmapFilter(["loc1"], "Some Label");

      getState().clearHeatmapFilter();

      expect(getState().heatmapFilter.filterLabel).toBeNull();
    });

    it("can be called when filter is already clear", () => {
      const { getState } = createTestSlice();

      getState().clearHeatmapFilter();
      getState().clearHeatmapFilter();

      expect(getState().heatmapFilter.mode).toBe("all");
      expect(getState().heatmapFilter.highlightedLocs).toEqual([]);
      expect(getState().heatmapFilter.filterLabel).toBeNull();
    });
  });

  describe("heatmap filter integration", () => {
    it("preserves other state when setting filter", () => {
      const { getState } = createTestSlice();

      getState().setSelectedElementId("element-1");
      getState().openInspector("test-panel");

      getState().setHeatmapFilter(["loc1"], "Test");

      expect(getState().selectedElementId).toBe("element-1");
      expect(getState().inspector.open).toBe(true);
    });

    it("preserves filter when other state changes", () => {
      const { getState } = createTestSlice();

      getState().setHeatmapFilter(["loc1", "loc2"], "Duplicate Pair");

      getState().openCommandPalette();
      getState().setSelectedElementId("element-1");

      expect(getState().heatmapFilter.mode).toBe("related-only");
      expect(getState().heatmapFilter.highlightedLocs).toEqual(["loc1", "loc2"]);
      expect(getState().heatmapFilter.filterLabel).toBe("Duplicate Pair");
    });
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
