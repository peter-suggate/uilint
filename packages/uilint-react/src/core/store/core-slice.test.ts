/**
 * Unit tests for core-slice.ts
 *
 * Tests are organized around USER SCENARIOS and BEHAVIORS rather than
 * individual state properties. Each test describes a meaningful workflow.
 */

import { describe, it, expect, vi } from "vitest";
import {
  createCoreSlice,
  type CoreSlice,
  type MobileState,
} from "./core-slice";
import type { PluginServices, WebSocketService, DOMObserverService, TileItem } from "../plugin-system/types";

// ============================================================================
// Test Helpers
// ============================================================================

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

function createMockDOMObserverService(overrides?: Partial<DOMObserverService>): DOMObserverService {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    onElementsAdded: vi.fn(() => vi.fn()),
    onElementsRemoved: vi.fn(() => vi.fn()),
    ...overrides,
  };
}

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

function createTestSlice(services?: PluginServices) {
  const mockServices = services ?? createMockServices();
  const sliceCreator = createCoreSlice(mockServices);

  let currentState: CoreSlice;

  const mockSet = vi.fn((partial: Partial<CoreSlice> | ((state: CoreSlice) => Partial<CoreSlice>)) => {
    if (typeof partial === "function") {
      const updates = partial(currentState);
      currentState = { ...currentState, ...updates };
    } else {
      currentState = { ...currentState, ...partial };
    }
  });

  const mockGet = vi.fn(() => currentState);

  // @ts-expect-error - We're using simplified mock functions
  currentState = sliceCreator(mockSet, mockGet);

  return {
    getState: () => currentState,
    set: mockSet,
    get: mockGet,
    services: mockServices,
  };
}

function createMockTile(id: string, label: string): TileItem {
  return {
    id,
    label,
    icon: "test-icon",
    count: 1,
    severity: "warning",
    onClick: vi.fn(),
  };
}

// ============================================================================
// Initial State - App starts in a clean, closed state
// ============================================================================

describe("Core Slice - Initial State", () => {
  it("starts with nothing selected and all UI panels closed", () => {
    const { getState } = createTestSlice();
    const state = getState();

    // No element interaction happening
    expect(state.selectedElementId).toBeNull();
    expect(state.hoveredElementId).toBeNull();
    expect(state.altKeyHeld).toBe(false);

    // Command palette is closed with no search
    expect(state.commandPalette.open).toBe(false);
    expect(state.commandPalette.query).toBe("");
    expect(state.commandPalette.selectedIndex).toBe(0);
    expect(state.commandPalette.expansionPath).toEqual([]);

    // Inspector is closed with default layout
    expect(state.inspector.open).toBe(false);
    expect(state.inspector.panelId).toBeNull();
    expect(state.inspector.data).toBeNull();
    expect(state.inspector.docked).toBe(true);
    expect(state.inspector.width).toBe(400);

    // Heatmap shows all elements by default
    expect(state.heatmapFilter.mode).toBe("all");
    expect(state.heatmapFilter.highlightedLocs).toEqual([]);

    // Assumes desktop by default
    expect(state.mobile.isMobile).toBe(false);
    expect(state.mobile.isTablet).toBe(false);
    expect(state.mobile.isTouchDevice).toBe(false);
  });

  it("reflects websocket service connection state", () => {
    const connectedServices = createMockServices({
      websocket: createMockWebSocketService({ isConnected: true, url: "ws://custom:8080" }),
    });
    const { getState } = createTestSlice(connectedServices);

    expect(getState().wsConnected).toBe(true);
    expect(getState().wsUrl).toBe("ws://custom:8080");
  });
});

// ============================================================================
// Command Palette Workflows
// ============================================================================

describe("Command Palette - Search and Navigation", () => {
  it("opening command palette resets any existing query and selection", () => {
    const { getState } = createTestSlice();

    // Simulate previous session with leftover state
    getState().setCommandPaletteQuery("old search");
    getState().setCommandPaletteSelectedIndex(5);

    // Open should give a fresh start
    getState().openCommandPalette();

    expect(getState().commandPalette.open).toBe(true);
    expect(getState().commandPalette.query).toBe("");
    expect(getState().commandPalette.selectedIndex).toBe(0);
  });

  it("typing a search query resets keyboard selection to first result", () => {
    const { getState } = createTestSlice();

    getState().openCommandPalette();
    getState().setCommandPaletteSelectedIndex(3); // User navigated down

    // Typing should reset to first result
    getState().setCommandPaletteQuery("button");

    expect(getState().commandPalette.query).toBe("button");
    expect(getState().commandPalette.selectedIndex).toBe(0);
  });

  it("closing command palette clears all search state", () => {
    const { getState } = createTestSlice();

    getState().openCommandPalette();
    getState().setCommandPaletteQuery("search term");
    getState().setCommandPaletteSelectedIndex(2);

    getState().closeCommandPalette();

    expect(getState().commandPalette.open).toBe(false);
    expect(getState().commandPalette.query).toBe("");
    expect(getState().commandPalette.selectedIndex).toBe(0);
  });

  it("navigating with keyboard preserves the current search query", () => {
    const { getState } = createTestSlice();

    getState().openCommandPalette();
    getState().setCommandPaletteQuery("test query");

    getState().setCommandPaletteSelectedIndex(2);

    expect(getState().commandPalette.query).toBe("test query");
    expect(getState().commandPalette.selectedIndex).toBe(2);
  });
});

// ============================================================================
// Tile Expansion - Hierarchical Navigation
// ============================================================================

describe("Command Palette - Tile Expansion", () => {
  it("expanding a tile shows its children and tracks the path", () => {
    const { getState } = createTestSlice();
    getState().openCommandPalette();

    const ruleTile = createMockTile("rule-1", "No Alt Text");
    const children = [createMockTile("file-1", "App.tsx"), createMockTile("file-2", "Button.tsx")];
    const siblings = [createMockTile("rule-2", "Color Contrast")];

    getState().expandTile(ruleTile, children, siblings, "issues");

    expect(getState().commandPalette.expansionPath).toHaveLength(1);
    expect(getState().commandPalette.expansionPath[0].item.id).toBe("rule-1");
    expect(getState().commandPalette.expansionPath[0].children).toHaveLength(2);
    expect(getState().commandPalette.selectedIndex).toBe(0); // Reset on expand
    expect(getState().commandPalette.query).toBe(""); // Clear search on expand
  });

  it("collapsing returns to the previous level", () => {
    const { getState } = createTestSlice();
    getState().openCommandPalette();

    // Expand to level 1
    getState().expandTile(createMockTile("rule-1", "Rule"), [], [], "issues");
    expect(getState().getCurrentExpansionLevel()).toBe(1);

    // Collapse back to root
    getState().collapseTile();

    expect(getState().getCurrentExpansionLevel()).toBe(0);
    expect(getState().commandPalette.expansionPath).toEqual([]);
  });

  it("can navigate two levels deep (rules -> files -> issues)", () => {
    const { getState } = createTestSlice();
    getState().openCommandPalette();

    // Level 0 -> Level 1 (expand rule)
    getState().expandTile(createMockTile("rule-1", "Rule"), [], [], "issues");
    expect(getState().getCurrentExpansionLevel()).toBe(1);

    // Level 1 -> Level 2 (expand file)
    getState().expandTile(createMockTile("file-1", "File"), [], [], "issues");
    expect(getState().getCurrentExpansionLevel()).toBe(2);

    // Cannot expand beyond level 2
    getState().expandTile(createMockTile("issue-1", "Issue"), [], [], "issues");
    expect(getState().getCurrentExpansionLevel()).toBe(2); // Still at 2
  });

  it("collapse all returns to root from any depth", () => {
    const { getState } = createTestSlice();
    getState().openCommandPalette();

    // Go two levels deep
    getState().expandTile(createMockTile("rule-1", "Rule"), [], [], "issues");
    getState().expandTile(createMockTile("file-1", "File"), [], [], "issues");
    expect(getState().getCurrentExpansionLevel()).toBe(2);

    getState().collapseAll();

    expect(getState().getCurrentExpansionLevel()).toBe(0);
    expect(getState().commandPalette.expansionPath).toEqual([]);
  });

  it("collapse to specific level preserves tiles up to that level", () => {
    const { getState } = createTestSlice();
    getState().openCommandPalette();

    // Go two levels deep
    getState().expandTile(createMockTile("rule-1", "Rule"), [], [], "issues");
    getState().expandTile(createMockTile("file-1", "File"), [], [], "issues");

    // Collapse to level 1 (keep rule expanded, collapse file)
    getState().collapseToLevel(1);

    expect(getState().getCurrentExpansionLevel()).toBe(1);
    expect(getState().commandPalette.expansionPath[0].item.id).toBe("rule-1");
  });
});

// ============================================================================
// Inspector - Panel Management
// ============================================================================

describe("Inspector - Opening and Closing", () => {
  it("opening inspector with data shows the panel with that data", () => {
    const { getState } = createTestSlice();

    const issueData = { elementId: "el-123", ruleId: "uilint/alt-text" };
    getState().openInspector("issue-details", issueData);

    expect(getState().inspector.open).toBe(true);
    expect(getState().inspector.panelId).toBe("issue-details");
    expect(getState().inspector.data).toEqual(issueData);
  });

  it("switching panels while inspector is open updates the content", () => {
    const { getState } = createTestSlice();

    getState().openInspector("panel-1", { foo: "bar" });
    getState().openInspector("panel-2", { baz: "qux" });

    expect(getState().inspector.open).toBe(true);
    expect(getState().inspector.panelId).toBe("panel-2");
    expect(getState().inspector.data).toEqual({ baz: "qux" });
  });

  it("closing inspector clears panel data but preserves layout preferences", () => {
    const { getState } = createTestSlice();

    // Setup: customize layout
    getState().setInspectorWidth(600);
    getState().toggleInspectorDocked(); // Now floating
    getState().setInspectorFloatingPosition({ x: 100, y: 200 });

    // Open and close
    getState().openInspector("test-panel", { key: "value" });
    getState().closeInspector();

    // Panel data is cleared
    expect(getState().inspector.open).toBe(false);
    expect(getState().inspector.panelId).toBeNull();
    expect(getState().inspector.data).toBeNull();

    // Layout preferences are preserved
    expect(getState().inspector.width).toBe(600);
    expect(getState().inspector.docked).toBe(false);
    expect(getState().inspector.floatingPosition).toEqual({ x: 100, y: 200 });
  });

  it("opening inspector panel (unified view) preserves existing state", () => {
    const { getState } = createTestSlice();

    getState().setInspectorWidth(500);
    getState().openInspectorPanel();

    expect(getState().inspector.open).toBe(true);
    expect(getState().inspector.width).toBe(500);
  });
});

// ============================================================================
// Inspector - Layout Modes
// ============================================================================

describe("Inspector - Docked and Floating Modes", () => {
  it("toggles between docked and floating mode", () => {
    const { getState } = createTestSlice();

    expect(getState().inspector.docked).toBe(true);

    getState().toggleInspectorDocked();
    expect(getState().inspector.docked).toBe(false);

    getState().toggleInspectorDocked();
    expect(getState().inspector.docked).toBe(true);
  });

  it("resizing and repositioning preserves panel content", () => {
    const { getState } = createTestSlice();

    getState().openInspector("test-panel", { key: "value" });
    getState().toggleInspectorDocked();

    getState().setInspectorWidth(500);
    getState().setInspectorFloatingPosition({ x: 150, y: 250 });
    getState().setInspectorFloatingSize({ width: 400, height: 600 });

    expect(getState().inspector.open).toBe(true);
    expect(getState().inspector.panelId).toBe("test-panel");
    expect(getState().inspector.data).toEqual({ key: "value" });
    expect(getState().inspector.width).toBe(500);
    expect(getState().inspector.floatingPosition).toEqual({ x: 150, y: 250 });
    expect(getState().inspector.floatingSize).toEqual({ width: 400, height: 600 });
  });
});

// ============================================================================
// Inspector - Hierarchical Issue Navigation
// ============================================================================

describe("Inspector - Issue Navigation Hierarchy", () => {
  it("expanding a rule shows its files, collapsing clears expansion", () => {
    const { getState } = createTestSlice();

    getState().expandRule("no-alt-text");
    expect(getState().inspector.expandedRuleId).toBe("no-alt-text");

    getState().collapseRule();
    expect(getState().inspector.expandedRuleId).toBeNull();
    expect(getState().inspector.expandedFilePath).toBeNull();
  });

  it("clicking same rule toggles it closed", () => {
    const { getState } = createTestSlice();

    getState().expandRule("no-alt-text");
    getState().expandRule("no-alt-text"); // Click again

    expect(getState().inspector.expandedRuleId).toBeNull();
  });

  it("expanding a file within a rule drills down to issues", () => {
    const { getState } = createTestSlice();

    getState().expandRule("no-alt-text");
    getState().expandFileInRule("/src/App.tsx");

    expect(getState().inspector.expandedRuleId).toBe("no-alt-text");
    expect(getState().inspector.expandedFilePath).toBe("/src/App.tsx");
  });

  it("collapsing file keeps rule expanded", () => {
    const { getState } = createTestSlice();

    getState().expandRule("no-alt-text");
    getState().expandFileInRule("/src/App.tsx");
    getState().collapseFileInRule();

    expect(getState().inspector.expandedRuleId).toBe("no-alt-text");
    expect(getState().inspector.expandedFilePath).toBeNull();
  });

  it("collapse all clears both rule and file expansion", () => {
    const { getState } = createTestSlice();

    getState().expandRule("no-alt-text");
    getState().expandFileInRule("/src/App.tsx");
    getState().selectIssue("issue-123");
    getState().showFullSourceView();

    getState().collapseAllInspector();

    expect(getState().inspector.expandedRuleId).toBeNull();
    expect(getState().inspector.expandedFilePath).toBeNull();
    expect(getState().inspector.selectedIssueId).toBeNull();
    expect(getState().inspector.showFullSource).toBe(false);
  });

  it("toggling files in issues list works independently", () => {
    const { getState } = createTestSlice();

    getState().expandFile("/src/App.tsx");
    getState().expandFile("/src/Button.tsx");

    expect(getState().inspector.expandedFiles).toContain("/src/App.tsx");
    expect(getState().inspector.expandedFiles).toContain("/src/Button.tsx");

    getState().toggleFileExpanded("/src/App.tsx"); // Collapse

    expect(getState().inspector.expandedFiles).not.toContain("/src/App.tsx");
    expect(getState().inspector.expandedFiles).toContain("/src/Button.tsx");
  });

  it("selecting an issue syncs with heatmap highlighting", () => {
    const { getState } = createTestSlice();

    getState().selectIssue("issue-456");

    expect(getState().inspector.selectedIssueId).toBe("issue-456");

    getState().selectIssue(null);

    expect(getState().inspector.selectedIssueId).toBeNull();
  });

  it("toggling between issue summary and full source views", () => {
    const { getState } = createTestSlice();

    expect(getState().inspector.showFullSource).toBe(false);

    getState().showFullSourceView();
    expect(getState().inspector.showFullSource).toBe(true);

    getState().showIssueSummaryView();
    expect(getState().inspector.showFullSource).toBe(false);
  });

  it("toggling rule config section", () => {
    const { getState } = createTestSlice();

    expect(getState().inspector.ruleConfigExpanded).toBe(false);

    getState().toggleRuleConfig();
    expect(getState().inspector.ruleConfigExpanded).toBe(true);

    getState().toggleRuleConfig();
    expect(getState().inspector.ruleConfigExpanded).toBe(false);
  });
});

// ============================================================================
// Element Selection and Hover
// ============================================================================

describe("Element Selection and Hover", () => {
  it("selecting and hovering elements are independent operations", () => {
    const { getState } = createTestSlice();

    getState().setSelectedElementId("element-1");
    getState().setHoveredElementId("element-2");

    expect(getState().selectedElementId).toBe("element-1");
    expect(getState().hoveredElementId).toBe("element-2");

    // Changing hover doesn't affect selection
    getState().setHoveredElementId("element-3");
    expect(getState().selectedElementId).toBe("element-1");

    // Clearing selection doesn't affect hover
    getState().setSelectedElementId(null);
    expect(getState().hoveredElementId).toBe("element-3");
  });

  it("same element can be both selected and hovered", () => {
    const { getState } = createTestSlice();

    getState().setSelectedElementId("element-1");
    getState().setHoveredElementId("element-1");

    expect(getState().selectedElementId).toBe("element-1");
    expect(getState().hoveredElementId).toBe("element-1");
  });

  it("alt key mode can be toggled for inspection mode", () => {
    const { getState } = createTestSlice();

    getState().setAltKeyHeld(true);
    expect(getState().altKeyHeld).toBe(true);

    getState().setAltKeyHeld(false);
    expect(getState().altKeyHeld).toBe(false);
  });
});

// ============================================================================
// Heatmap Filtering
// ============================================================================

describe("Heatmap - Filtering Related Elements", () => {
  it("setting filter highlights specific elements and shows label", () => {
    const { getState } = createTestSlice();

    const locs = ["file.tsx:10:5", "file.tsx:25:10"];
    getState().setHeatmapFilter(locs, "Duplicate Pair");

    expect(getState().heatmapFilter.mode).toBe("related-only");
    expect(getState().heatmapFilter.highlightedLocs).toEqual(locs);
    expect(getState().heatmapFilter.filterLabel).toBe("Duplicate Pair");
  });

  it("clearing filter shows all elements again", () => {
    const { getState } = createTestSlice();

    getState().setHeatmapFilter(["loc1", "loc2"], "Test Filter");
    getState().clearHeatmapFilter();

    expect(getState().heatmapFilter.mode).toBe("all");
    expect(getState().heatmapFilter.highlightedLocs).toEqual([]);
    expect(getState().heatmapFilter.filterLabel).toBeNull();
  });

  it("setting empty locs array switches to 'all' mode", () => {
    const { getState } = createTestSlice();

    getState().setHeatmapFilter(["loc1"]);
    expect(getState().heatmapFilter.mode).toBe("related-only");

    getState().setHeatmapFilter([]);
    expect(getState().heatmapFilter.mode).toBe("all");
  });
});

// ============================================================================
// Mobile/Responsive State
// ============================================================================

describe("Mobile/Responsive Detection", () => {
  it("updates device detection state when viewport changes", () => {
    const { getState } = createTestSlice();

    // Simulate mobile device
    const mobileState: MobileState = {
      isMobile: true,
      isTablet: false,
      isTouchDevice: true,
      isSmallScreen: true,
    };

    getState().setMobileState(mobileState);
    expect(getState().mobile).toEqual(mobileState);

    // Simulate resize to tablet
    const tabletState: MobileState = {
      isMobile: false,
      isTablet: true,
      isTouchDevice: true,
      isSmallScreen: false,
    };

    getState().setMobileState(tabletState);
    expect(getState().mobile).toEqual(tabletState);
  });
});

// ============================================================================
// Integration - Cross-feature Interactions
// ============================================================================

describe("Integration - Feature Independence", () => {
  it("command palette and inspector can be open simultaneously", () => {
    const { getState } = createTestSlice();

    getState().openCommandPalette();
    getState().openInspector("test-panel", { data: "value" });

    expect(getState().commandPalette.open).toBe(true);
    expect(getState().inspector.open).toBe(true);

    // Closing one doesn't affect the other
    getState().closeCommandPalette();

    expect(getState().commandPalette.open).toBe(false);
    expect(getState().inspector.open).toBe(true);
  });

  it("element selection persists through opening and closing UI panels", () => {
    const { getState } = createTestSlice();

    getState().setSelectedElementId("element-123");
    getState().setHoveredElementId("element-456");

    // Open and close various UI elements
    getState().openCommandPalette();
    getState().openInspector("panel");
    getState().closeCommandPalette();
    getState().closeInspector();

    // Selection state unchanged
    expect(getState().selectedElementId).toBe("element-123");
    expect(getState().hoveredElementId).toBe("element-456");
  });

  it("alt key state persists through other state changes", () => {
    const { getState } = createTestSlice();

    getState().setAltKeyHeld(true);

    getState().openCommandPalette();
    getState().openInspector("panel");
    getState().setSelectedElementId("element-1");

    expect(getState().altKeyHeld).toBe(true);

    getState().closeCommandPalette();
    getState().closeInspector();

    expect(getState().altKeyHeld).toBe(true);
  });

  it("heatmap filter persists through UI changes", () => {
    const { getState } = createTestSlice();

    getState().setHeatmapFilter(["loc1", "loc2"], "Duplicate Pair");

    getState().openCommandPalette();
    getState().setSelectedElementId("element-1");
    getState().openInspector("test-panel");

    expect(getState().heatmapFilter.mode).toBe("related-only");
    expect(getState().heatmapFilter.highlightedLocs).toEqual(["loc1", "loc2"]);
    expect(getState().heatmapFilter.filterLabel).toBe("Duplicate Pair");
  });

  it("mobile state changes do not affect UI panel states", () => {
    const { getState } = createTestSlice();

    getState().openCommandPalette();
    getState().setSelectedElementId("element-123");

    getState().setMobileState({
      isMobile: true,
      isTablet: false,
      isTouchDevice: true,
      isSmallScreen: true,
    });

    expect(getState().commandPalette.open).toBe(true);
    expect(getState().selectedElementId).toBe("element-123");
  });
});
