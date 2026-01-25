/**
 * Vision Plugin Index Tests
 *
 * Tests for toolbar actions and vision availability detection.
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { visionPlugin } from "./index";
import { defaultVisionState } from "./slice";
import type { VisionSlice } from "./slice";
import type { PluginServices, ToolbarAction } from "../../core/plugin-system/types";

// ============================================================================
// Mock Helpers
// ============================================================================

/**
 * Create mock plugin services
 */
function createMockServices(): PluginServices {
  return {
    websocket: {
      isConnected: true,
      url: "ws://localhost:3000",
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
    closeCommandPalette: vi.fn(),
  };
}

/**
 * Create a mock state with optional overrides
 */
function createMockState(overrides: Partial<VisionSlice> = {}): VisionSlice {
  return {
    ...defaultVisionState,
    visionAvailable: false,
    setCaptureMode: vi.fn(),
    setRegionSelectionActive: vi.fn(),
    setSelectedRegion: vi.fn(),
    triggerVisionAnalysis: vi.fn().mockResolvedValue(undefined),
    clearVisionResults: vi.fn(),
    clearVisionLastError: vi.fn(),
    setHighlightedVisionElementId: vi.fn(),
    setSelectedScreenshotId: vi.fn(),
    fetchPersistedScreenshots: vi.fn().mockResolvedValue(undefined),
    updateVisionAutoScanSettings: vi.fn(),
    setVisionAnalyzing: vi.fn(),
    setVisionProgressPhase: vi.fn(),
    setVisionLastError: vi.fn(),
    setVisionResult: vi.fn(),
    updateVisionIssuesCache: vi.fn(),
    addScreenshotToHistory: vi.fn(),
    updateScreenshotInHistory: vi.fn(),
    setVisionCurrentRoute: vi.fn(),
    setVisionAvailable: vi.fn(),
    ...overrides,
  } as VisionSlice;
}

// ============================================================================
// Toolbar Actions Structure Tests
// ============================================================================

describe("Vision Plugin - Toolbar Actions", () => {
  describe("toolbarActions array", () => {
    it("plugin has toolbarActions array", () => {
      expect(visionPlugin.toolbarActions).toBeDefined();
      expect(Array.isArray(visionPlugin.toolbarActions)).toBe(true);
    });

    it("toolbarActions contains capture-full-page and capture-region actions", () => {
      const actions = visionPlugin.toolbarActions;
      expect(actions).toBeDefined();

      const actionIds = actions!.map((a) => a.id);
      expect(actionIds).toContain("vision:capture-full-page");
      expect(actionIds).toContain("vision:capture-region");
    });

    it("toolbar actions have correct number of items", () => {
      expect(visionPlugin.toolbarActions?.length).toBe(2);
    });

    it("all toolbar actions have required fields", () => {
      for (const action of visionPlugin.toolbarActions ?? []) {
        expect(action.id).toBeDefined();
        expect(typeof action.id).toBe("string");
        expect(action.id.length).toBeGreaterThan(0);

        expect(action.icon).toBeDefined();

        expect(action.tooltip).toBeDefined();
        expect(typeof action.tooltip).toBe("string");
        expect(action.tooltip.length).toBeGreaterThan(0);

        expect(action.onClick).toBeDefined();
        expect(typeof action.onClick).toBe("function");

        expect(action.isVisible).toBeDefined();
        expect(typeof action.isVisible).toBe("function");
      }
    });

    it("each toolbar action has unique id", () => {
      const ids = visionPlugin.toolbarActions!.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("capture-full-page action", () => {
    let captureFullPageAction: ToolbarAction;

    beforeEach(() => {
      captureFullPageAction = visionPlugin.toolbarActions!.find(
        (a) => a.id === "vision:capture-full-page"
      )!;
    });

    it("exists", () => {
      expect(captureFullPageAction).toBeDefined();
    });

    it("has correct tooltip", () => {
      expect(captureFullPageAction.tooltip).toBe("Capture Full Page");
    });

    it("has camera icon (SVG element)", () => {
      // Icon should be a React element (SVG)
      expect(captureFullPageAction.icon).toBeDefined();
    });

    it("has isVisible predicate", () => {
      expect(captureFullPageAction.isVisible).toBeDefined();
      expect(typeof captureFullPageAction.isVisible).toBe("function");
    });

    it("isVisible returns false when visionAvailable is false", () => {
      const state = createMockState({ visionAvailable: false });
      expect(captureFullPageAction.isVisible!(state)).toBe(false);
    });

    it("isVisible returns true when visionAvailable is true", () => {
      const state = createMockState({ visionAvailable: true });
      expect(captureFullPageAction.isVisible!(state)).toBe(true);
    });

    it("onClick triggers full page analysis", async () => {
      const mockState = createMockState({ visionAvailable: true });
      const services = createMockServices();
      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);

      await captureFullPageAction.onClick(services);

      expect(mockState.setCaptureMode).toHaveBeenCalledWith("full");
      expect(mockState.setRegionSelectionActive).toHaveBeenCalledWith(false);
      expect(mockState.setSelectedRegion).toHaveBeenCalledWith(null);
      expect(mockState.triggerVisionAnalysis).toHaveBeenCalled();
    });
  });

  describe("capture-region action", () => {
    let captureRegionAction: ToolbarAction;

    beforeEach(() => {
      captureRegionAction = visionPlugin.toolbarActions!.find(
        (a) => a.id === "vision:capture-region"
      )!;
    });

    it("exists", () => {
      expect(captureRegionAction).toBeDefined();
    });

    it("has correct tooltip", () => {
      expect(captureRegionAction.tooltip).toBe("Capture Region");
    });

    it("has crop icon (SVG element)", () => {
      // Icon should be a React element (SVG)
      expect(captureRegionAction.icon).toBeDefined();
    });

    it("has isVisible predicate", () => {
      expect(captureRegionAction.isVisible).toBeDefined();
      expect(typeof captureRegionAction.isVisible).toBe("function");
    });

    it("isVisible returns false when visionAvailable is false", () => {
      const state = createMockState({ visionAvailable: false });
      expect(captureRegionAction.isVisible!(state)).toBe(false);
    });

    it("isVisible returns true when visionAvailable is true", () => {
      const state = createMockState({ visionAvailable: true });
      expect(captureRegionAction.isVisible!(state)).toBe(true);
    });

    it("onClick sets regionSelectionActive to true", () => {
      const mockState = createMockState({ visionAvailable: true });
      const services = createMockServices();
      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);

      captureRegionAction.onClick(services);

      expect(mockState.setCaptureMode).toHaveBeenCalledWith("region");
      expect(mockState.setRegionSelectionActive).toHaveBeenCalledWith(true);
      expect(mockState.setSelectedRegion).toHaveBeenCalledWith(null);
    });
  });
});

// ============================================================================
// Vision Availability State Tests
// ============================================================================

describe("Vision Plugin - Vision Availability", () => {
  describe("visionAvailable state", () => {
    it("defaultVisionState has visionAvailable field", () => {
      expect("visionAvailable" in defaultVisionState).toBe(true);
    });

    it("visionAvailable defaults to false", () => {
      expect(defaultVisionState.visionAvailable).toBe(false);
    });
  });

  describe("vision:check and vision:status messages", () => {
    it("initialize sends vision:check message on WebSocket connect", () => {
      const services = createMockServices();
      let connectionHandler: ((connected: boolean) => void) | undefined;

      (services.websocket.onConnectionChange as ReturnType<typeof vi.fn>).mockImplementation(
        (handler: (connected: boolean) => void) => {
          connectionHandler = handler;
          return vi.fn();
        }
      );

      // Initialize the plugin
      visionPlugin.initialize?.(services);

      // Simulate WebSocket connection
      connectionHandler?.(true);

      // Should send vision:check message
      expect(services.websocket.send).toHaveBeenCalledWith({
        type: "vision:check",
      });
    });

    it("initialize subscribes to vision:status messages", () => {
      const services = createMockServices();

      visionPlugin.initialize?.(services);

      // Should subscribe to vision:status
      expect(services.websocket.on).toHaveBeenCalledWith(
        "vision:status",
        expect.any(Function)
      );
    });

    it("handles vision:status response with available true", () => {
      const services = createMockServices();
      let statusHandler: ((message: unknown) => void) | undefined;

      (services.websocket.on as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string, handler: (message: unknown) => void) => {
          if (type === "vision:status") {
            statusHandler = handler;
          }
          return vi.fn();
        }
      );

      const mockState = createMockState();
      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);

      // Initialize the plugin
      visionPlugin.initialize?.(services);

      // Simulate receiving vision:status with available: true
      statusHandler?.({ type: "vision:status", available: true, model: "llava" });

      expect(mockState.setVisionAvailable).toHaveBeenCalledWith(true);
    });

    it("handles vision:status response with available false", () => {
      const services = createMockServices();
      let statusHandler: ((message: unknown) => void) | undefined;

      (services.websocket.on as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string, handler: (message: unknown) => void) => {
          if (type === "vision:status") {
            statusHandler = handler;
          }
          return vi.fn();
        }
      );

      const mockState = createMockState();
      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);

      // Initialize the plugin
      visionPlugin.initialize?.(services);

      // Simulate receiving vision:status with available: false
      statusHandler?.({ type: "vision:status", available: false });

      expect(mockState.setVisionAvailable).toHaveBeenCalledWith(false);
    });

    it("sets visionAvailable to false on WebSocket disconnect", () => {
      const services = createMockServices();
      let connectionHandler: ((connected: boolean) => void) | undefined;

      (services.websocket.onConnectionChange as ReturnType<typeof vi.fn>).mockImplementation(
        (handler: (connected: boolean) => void) => {
          connectionHandler = handler;
          return vi.fn();
        }
      );

      const mockState = createMockState({ visionAvailable: true });
      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);

      // Initialize the plugin
      visionPlugin.initialize?.(services);

      // Simulate WebSocket disconnection
      connectionHandler?.(false);

      expect(mockState.setVisionAvailable).toHaveBeenCalledWith(false);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Vision Plugin - Integration", () => {
  it("cleanup function unsubscribes from all events", () => {
    const services = createMockServices();
    const unsubResult = vi.fn();
    const unsubProgress = vi.fn();
    const unsubStatus = vi.fn();
    const unsubConnection = vi.fn();

    let callIndex = 0;
    (services.websocket.on as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return unsubResult;
      if (callIndex === 2) return unsubProgress;
      if (callIndex === 3) return unsubStatus;
      return vi.fn();
    });

    (services.websocket.onConnectionChange as ReturnType<typeof vi.fn>).mockReturnValue(
      unsubConnection
    );

    const cleanup = visionPlugin.initialize?.(services);
    expect(cleanup).toBeDefined();
    expect(typeof cleanup).toBe("function");

    // Call cleanup
    (cleanup as () => void)();

    expect(unsubResult).toHaveBeenCalled();
    expect(unsubProgress).toHaveBeenCalled();
    expect(unsubStatus).toHaveBeenCalled();
    expect(unsubConnection).toHaveBeenCalled();
  });
});
