/**
 * Vision Plugin Tests
 *
 * Tests for vision plugin state slice, commands, and exports.
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createVisionSlice,
  defaultVisionState,
  loadVisionAutoScanSettings,
  saveVisionAutoScanSettings,
} from "./slice";
import type { VisionSlice } from "./slice";
import { visionCommands } from "./commands";
import { visionPlugin } from "./index";
import { DEFAULT_VISION_AUTO_SCAN_SETTINGS } from "./types";
import type { VisionIssue, CaptureRegion, ScreenshotCapture } from "./types";
import type { PluginServices, RuleMeta } from "../../core/plugin-system/types";

// ============================================================================
// Mock Helpers
// ============================================================================

/**
 * Create a minimal mock state for testing slice actions
 */
function createMockSlice(): {
  state: VisionSlice;
  set: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
} {
  let currentState: VisionSlice;

  const set = vi.fn((partial: Partial<VisionSlice>) => {
    currentState = { ...currentState, ...partial };
  });

  const get = vi.fn(() => currentState);

  currentState = createVisionSlice(set, get);

  return { state: currentState, set, get };
}

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

// ============================================================================
// Initial State Tests
// ============================================================================

describe("Vision Plugin - Initial State", () => {
  describe("defaultVisionState", () => {
    it("visionAnalyzing is false", () => {
      expect(defaultVisionState.visionAnalyzing).toBe(false);
    });

    it("visionIssuesCache is empty", () => {
      expect(defaultVisionState.visionIssuesCache).toBeInstanceOf(Map);
      expect(defaultVisionState.visionIssuesCache.size).toBe(0);
    });

    it("screenshotHistory is empty", () => {
      expect(defaultVisionState.screenshotHistory).toBeInstanceOf(Map);
      expect(defaultVisionState.screenshotHistory.size).toBe(0);
    });

    it("captureMode defaults to 'full'", () => {
      expect(defaultVisionState.captureMode).toBe("full");
    });

    it("autoScanSettings defaults correctly", () => {
      expect(defaultVisionState.autoScanSettings).toEqual(
        DEFAULT_VISION_AUTO_SCAN_SETTINGS
      );
      expect(defaultVisionState.autoScanSettings.onRouteChange).toBe(false);
      expect(defaultVisionState.autoScanSettings.onInitialLoad).toBe(false);
    });

    it("visionProgressPhase is null", () => {
      expect(defaultVisionState.visionProgressPhase).toBeNull();
    });

    it("visionLastError is null", () => {
      expect(defaultVisionState.visionLastError).toBeNull();
    });

    it("visionResult is null", () => {
      expect(defaultVisionState.visionResult).toBeNull();
    });

    it("selectedScreenshotId is null", () => {
      expect(defaultVisionState.selectedScreenshotId).toBeNull();
    });

    it("visionCurrentRoute is null", () => {
      expect(defaultVisionState.visionCurrentRoute).toBeNull();
    });

    it("highlightedVisionElementId is null", () => {
      expect(defaultVisionState.highlightedVisionElementId).toBeNull();
    });

    it("regionSelectionActive is false", () => {
      expect(defaultVisionState.regionSelectionActive).toBe(false);
    });

    it("selectedRegion is null", () => {
      expect(defaultVisionState.selectedRegion).toBeNull();
    });

    it("loadingPersistedScreenshots is false", () => {
      expect(defaultVisionState.loadingPersistedScreenshots).toBe(false);
    });

    it("persistedScreenshotsFetched is false", () => {
      expect(defaultVisionState.persistedScreenshotsFetched).toBe(false);
    });
  });

  describe("createVisionSlice", () => {
    it("creates slice with all default state properties", () => {
      const { state } = createMockSlice();

      expect(state.visionAnalyzing).toBe(false);
      expect(state.visionIssuesCache).toBeInstanceOf(Map);
      expect(state.screenshotHistory).toBeInstanceOf(Map);
      expect(state.captureMode).toBe("full");
    });

    it("creates slice with all action methods", () => {
      const { state } = createMockSlice();

      expect(typeof state.triggerVisionAnalysis).toBe("function");
      expect(typeof state.clearVisionResults).toBe("function");
      expect(typeof state.clearVisionLastError).toBe("function");
      expect(typeof state.setHighlightedVisionElementId).toBe("function");
      expect(typeof state.setCaptureMode).toBe("function");
      expect(typeof state.setRegionSelectionActive).toBe("function");
      expect(typeof state.setSelectedRegion).toBe("function");
      expect(typeof state.setSelectedScreenshotId).toBe("function");
      expect(typeof state.fetchPersistedScreenshots).toBe("function");
      expect(typeof state.updateVisionAutoScanSettings).toBe("function");
      expect(typeof state.setVisionAnalyzing).toBe("function");
      expect(typeof state.setVisionProgressPhase).toBe("function");
      expect(typeof state.setVisionLastError).toBe("function");
      expect(typeof state.setVisionResult).toBe("function");
      expect(typeof state.updateVisionIssuesCache).toBe("function");
      expect(typeof state.addScreenshotToHistory).toBe("function");
      expect(typeof state.updateScreenshotInHistory).toBe("function");
      expect(typeof state.setVisionCurrentRoute).toBe("function");
    });
  });
});

// ============================================================================
// State Actions Tests
// ============================================================================

describe("Vision Plugin - State Actions", () => {
  describe("setCaptureMode", () => {
    it("updates mode to 'region'", () => {
      const { state, set } = createMockSlice();

      state.setCaptureMode("region");

      expect(set).toHaveBeenCalledWith({ captureMode: "region" });
    });

    it("updates mode to 'full'", () => {
      const { state, set } = createMockSlice();

      state.setCaptureMode("full");

      expect(set).toHaveBeenCalledWith({ captureMode: "full" });
    });
  });

  describe("setRegionSelectionActive", () => {
    it("toggles region selection to true", () => {
      const { state, set } = createMockSlice();

      state.setRegionSelectionActive(true);

      expect(set).toHaveBeenCalledWith({ regionSelectionActive: true });
    });

    it("toggles region selection to false", () => {
      const { state, set } = createMockSlice();

      state.setRegionSelectionActive(false);

      expect(set).toHaveBeenCalledWith({ regionSelectionActive: false });
    });
  });

  describe("setSelectedRegion", () => {
    it("updates region with valid coordinates", () => {
      const { state, set } = createMockSlice();

      const region: CaptureRegion = { x: 10, y: 20, width: 100, height: 200 };
      state.setSelectedRegion(region);

      expect(set).toHaveBeenCalledWith({ selectedRegion: region });
    });

    it("clears region when set to null", () => {
      const { state, set } = createMockSlice();

      state.setSelectedRegion(null);

      expect(set).toHaveBeenCalledWith({ selectedRegion: null });
    });
  });

  describe("clearVisionResults", () => {
    it("clears cache, history, and resets state", () => {
      const { state, set } = createMockSlice();

      state.clearVisionResults();

      expect(set).toHaveBeenCalledWith({
        visionResult: null,
        visionIssuesCache: expect.any(Map),
        screenshotHistory: expect.any(Map),
        selectedScreenshotId: null,
        visionAnalyzing: false,
        visionProgressPhase: null,
        highlightedVisionElementId: null,
        visionLastError: null,
      });
    });

    it("clears cache to empty map", () => {
      const { state, set } = createMockSlice();

      state.clearVisionResults();

      const callArg = set.mock.calls[0][0] as Partial<VisionSlice>;
      expect(callArg.visionIssuesCache?.size).toBe(0);
    });

    it("clears history to empty map", () => {
      const { state, set } = createMockSlice();

      state.clearVisionResults();

      const callArg = set.mock.calls[0][0] as Partial<VisionSlice>;
      expect(callArg.screenshotHistory?.size).toBe(0);
    });
  });

  describe("setSelectedScreenshotId", () => {
    it("updates selection with valid id", () => {
      const { state, set, get } = createMockSlice();

      state.setSelectedScreenshotId("capture_123");

      expect(get).toHaveBeenCalled();
      expect(set).toHaveBeenCalledWith({ selectedScreenshotId: "capture_123" });
    });

    it("clears selection when set to null", () => {
      const { state, set } = createMockSlice();

      state.setSelectedScreenshotId(null);

      expect(set).toHaveBeenCalledWith({ selectedScreenshotId: null });
    });

    it("updates issues cache when screenshot has issues", () => {
      const set = vi.fn();
      const mockIssues: VisionIssue[] = [
        {
          elementText: "Button",
          message: "Color contrast issue",
          category: "contrast",
          severity: "warning",
          dataLoc: "src/app.tsx:10:5",
        },
      ];
      const mockCapture: ScreenshotCapture = {
        id: "capture_with_issues",
        route: "/home",
        timestamp: Date.now(),
        type: "full",
        issues: mockIssues,
      };
      const mockState: VisionSlice = {
        ...defaultVisionState,
        screenshotHistory: new Map([["capture_with_issues", mockCapture]]),
        visionIssuesCache: new Map(),
      } as VisionSlice;

      const get = vi.fn(() => mockState);
      const slice = createVisionSlice(set, get);

      slice.setSelectedScreenshotId("capture_with_issues");

      expect(set).toHaveBeenCalled();
      const callArg = set.mock.calls[0][0] as Partial<VisionSlice>;
      expect(callArg.selectedScreenshotId).toBe("capture_with_issues");
      expect(callArg.visionIssuesCache?.get("/home")).toEqual(mockIssues);
    });
  });

  describe("setVisionAnalyzing", () => {
    it("sets analyzing to true", () => {
      const { state, set } = createMockSlice();

      state.setVisionAnalyzing(true);

      expect(set).toHaveBeenCalledWith({ visionAnalyzing: true });
    });

    it("sets analyzing to false", () => {
      const { state, set } = createMockSlice();

      state.setVisionAnalyzing(false);

      expect(set).toHaveBeenCalledWith({ visionAnalyzing: false });
    });
  });

  describe("setVisionProgressPhase", () => {
    it("sets progress phase string", () => {
      const { state, set } = createMockSlice();

      state.setVisionProgressPhase("capturing");

      expect(set).toHaveBeenCalledWith({ visionProgressPhase: "capturing" });
    });

    it("clears progress phase when set to null", () => {
      const { state, set } = createMockSlice();

      state.setVisionProgressPhase(null);

      expect(set).toHaveBeenCalledWith({ visionProgressPhase: null });
    });
  });

  describe("setVisionLastError", () => {
    it("sets error info", () => {
      const { state, set } = createMockSlice();

      const error = {
        stage: "vision" as const,
        message: "Analysis failed",
        route: "/home",
        timestamp: Date.now(),
      };
      state.setVisionLastError(error);

      expect(set).toHaveBeenCalledWith({ visionLastError: error });
    });

    it("clears error when set to null", () => {
      const { state, set } = createMockSlice();

      state.setVisionLastError(null);

      expect(set).toHaveBeenCalledWith({ visionLastError: null });
    });
  });

  describe("clearVisionLastError", () => {
    it("clears last error", () => {
      const { state, set } = createMockSlice();

      state.clearVisionLastError();

      expect(set).toHaveBeenCalledWith({ visionLastError: null });
    });
  });

  describe("setHighlightedVisionElementId", () => {
    it("sets highlighted element id", () => {
      const { state, set } = createMockSlice();

      state.setHighlightedVisionElementId("element_123");

      expect(set).toHaveBeenCalledWith({
        highlightedVisionElementId: "element_123",
      });
    });

    it("clears highlighted element when set to null", () => {
      const { state, set } = createMockSlice();

      state.setHighlightedVisionElementId(null);

      expect(set).toHaveBeenCalledWith({ highlightedVisionElementId: null });
    });
  });

  describe("setVisionResult", () => {
    it("sets vision result", () => {
      const { state, set } = createMockSlice();

      const result = {
        route: "/home",
        timestamp: Date.now(),
        manifest: [],
        issues: [],
        analysisTime: 1500,
      };
      state.setVisionResult(result);

      expect(set).toHaveBeenCalledWith({ visionResult: result });
    });

    it("clears result when set to null", () => {
      const { state, set } = createMockSlice();

      state.setVisionResult(null);

      expect(set).toHaveBeenCalledWith({ visionResult: null });
    });
  });

  describe("setVisionCurrentRoute", () => {
    it("sets current route", () => {
      const { state, set } = createMockSlice();

      state.setVisionCurrentRoute("/dashboard");

      expect(set).toHaveBeenCalledWith({ visionCurrentRoute: "/dashboard" });
    });

    it("clears route when set to null", () => {
      const { state, set } = createMockSlice();

      state.setVisionCurrentRoute(null);

      expect(set).toHaveBeenCalledWith({ visionCurrentRoute: null });
    });
  });

  describe("updateVisionIssuesCache", () => {
    it("adds issues to cache for route", () => {
      const { state, set, get: _get } = createMockSlice();

      const issues: VisionIssue[] = [
        {
          elementText: "Submit",
          message: "Button text too small",
          category: "typography",
          severity: "warning",
        },
      ];
      state.updateVisionIssuesCache("/contact", issues);

      expect(set).toHaveBeenCalled();
      const callArg = set.mock.calls[0][0] as Partial<VisionSlice>;
      expect(callArg.visionIssuesCache?.get("/contact")).toEqual(issues);
    });
  });

  describe("addScreenshotToHistory", () => {
    it("adds screenshot and sets as selected", () => {
      const { state, set, get: _get } = createMockSlice();

      const capture: ScreenshotCapture = {
        id: "capture_456",
        route: "/about",
        timestamp: Date.now(),
        type: "full",
        dataUrl: "data:image/png;base64,abc",
      };
      state.addScreenshotToHistory(capture);

      expect(set).toHaveBeenCalled();
      const callArg = set.mock.calls[0][0] as Partial<VisionSlice>;
      expect(callArg.screenshotHistory?.get("capture_456")).toEqual(capture);
      expect(callArg.selectedScreenshotId).toBe("capture_456");
    });
  });

  describe("updateScreenshotInHistory", () => {
    it("updates existing screenshot", () => {
      const set = vi.fn();
      const existingCapture: ScreenshotCapture = {
        id: "capture_existing",
        route: "/page",
        timestamp: Date.now(),
        type: "full",
      };
      const mockState: VisionSlice = {
        ...defaultVisionState,
        screenshotHistory: new Map([["capture_existing", existingCapture]]),
      } as VisionSlice;

      const get = vi.fn(() => mockState);
      const slice = createVisionSlice(set, get);

      const newIssues: VisionIssue[] = [
        {
          elementText: "Header",
          message: "Alignment issue",
          category: "alignment",
          severity: "info",
        },
      ];
      slice.updateScreenshotInHistory("capture_existing", {
        issues: newIssues,
      });

      expect(set).toHaveBeenCalled();
      const callArg = set.mock.calls[0][0] as Partial<VisionSlice>;
      const updatedCapture = callArg.screenshotHistory?.get("capture_existing");
      expect(updatedCapture?.issues).toEqual(newIssues);
    });

    it("does nothing if screenshot does not exist", () => {
      const { state, set, get: _get } = createMockSlice();

      state.updateScreenshotInHistory("nonexistent_id", { issues: [] });

      // set should not be called for nonexistent screenshot
      expect(set).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Command Structure Tests
// ============================================================================

describe("Vision Plugin - Command Structure", () => {
  describe("visionCommands array", () => {
    it("contains expected number of commands", () => {
      expect(visionCommands.length).toBeGreaterThan(0);
      expect(visionCommands.length).toBe(7);
    });

    it("all commands have required fields", () => {
      for (const command of visionCommands) {
        expect(command.id).toBeDefined();
        expect(typeof command.id).toBe("string");
        expect(command.id.length).toBeGreaterThan(0);

        expect(command.title).toBeDefined();
        expect(typeof command.title).toBe("string");
        expect(command.title.length).toBeGreaterThan(0);

        expect(command.keywords).toBeDefined();
        expect(Array.isArray(command.keywords)).toBe(true);
        expect(command.keywords.length).toBeGreaterThan(0);

        expect(command.category).toBeDefined();
        expect(typeof command.category).toBe("string");

        expect(command.execute).toBeDefined();
        expect(typeof command.execute).toBe("function");
      }
    });

    it("all command IDs follow vision:* convention", () => {
      for (const command of visionCommands) {
        expect(command.id).toMatch(/^vision:/);
      }
    });

    it("all commands are in 'Vision' category", () => {
      for (const command of visionCommands) {
        expect(command.category).toBe("Vision");
      }
    });

    it("each command has unique id", () => {
      const ids = visionCommands.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("individual commands", () => {
    it("has capture-full-page command", () => {
      const cmd = visionCommands.find((c) => c.id === "vision:capture-full-page");
      expect(cmd).toBeDefined();
      expect(cmd?.title).toBe("Capture Full Page");
      expect(cmd?.keywords).toContain("vision");
      expect(cmd?.keywords).toContain("screenshot");
    });

    it("has capture-region command", () => {
      const cmd = visionCommands.find((c) => c.id === "vision:capture-region");
      expect(cmd).toBeDefined();
      expect(cmd?.title).toBe("Capture Region");
      expect(cmd?.keywords).toContain("region");
    });

    it("has clear-results command", () => {
      const cmd = visionCommands.find((c) => c.id === "vision:clear-results");
      expect(cmd).toBeDefined();
      expect(cmd?.title).toBe("Clear Vision Results");
    });

    it("has toggle-results-panel command", () => {
      const cmd = visionCommands.find(
        (c) => c.id === "vision:toggle-results-panel"
      );
      expect(cmd).toBeDefined();
      expect(cmd?.title).toBe("Toggle Vision Results Panel");
    });

    it("has show-screenshot-gallery command with isAvailable predicate", () => {
      const cmd = visionCommands.find(
        (c) => c.id === "vision:show-screenshot-gallery"
      );
      expect(cmd).toBeDefined();
      expect(cmd?.isAvailable).toBeDefined();
      expect(typeof cmd?.isAvailable).toBe("function");

      // Test isAvailable with empty history
      const emptyState = { screenshotHistory: new Map() };
      expect(cmd?.isAvailable!(emptyState)).toBe(false);

      // Test isAvailable with screenshots
      const stateWithScreenshots = {
        screenshotHistory: new Map([["id1", {}]]),
      };
      expect(cmd?.isAvailable!(stateWithScreenshots)).toBe(true);
    });

    it("has enable-auto-analyze command with isAvailable predicate", () => {
      const cmd = visionCommands.find(
        (c) => c.id === "vision:enable-auto-analyze"
      );
      expect(cmd).toBeDefined();
      expect(cmd?.isAvailable).toBeDefined();

      // Available when auto-analyze is disabled
      const disabledState = {
        autoScanSettings: { vision: { onRouteChange: false } },
      };
      expect(cmd?.isAvailable!(disabledState)).toBe(true);

      // Not available when auto-analyze is enabled
      const enabledState = {
        autoScanSettings: { vision: { onRouteChange: true } },
      };
      expect(cmd?.isAvailable!(enabledState)).toBe(false);
    });

    it("has disable-auto-analyze command with isAvailable predicate", () => {
      const cmd = visionCommands.find(
        (c) => c.id === "vision:disable-auto-analyze"
      );
      expect(cmd).toBeDefined();
      expect(cmd?.isAvailable).toBeDefined();

      // Available when auto-analyze is enabled
      const enabledState = {
        autoScanSettings: { vision: { onRouteChange: true } },
      };
      expect(cmd?.isAvailable!(enabledState)).toBe(true);

      // Not available when auto-analyze is disabled
      const disabledState = {
        autoScanSettings: { vision: { onRouteChange: false } },
      };
      expect(cmd?.isAvailable!(disabledState)).toBe(false);
    });
  });

  describe("command execution", () => {
    it("capture-full-page command sets full mode and triggers analysis", async () => {
      const mockState = {
        captureMode: "region" as const,
        setCaptureMode: vi.fn(),
        setRegionSelectionActive: vi.fn(),
        setSelectedRegion: vi.fn(),
        triggerVisionAnalysis: vi.fn().mockResolvedValue(undefined),
      };

      const services = createMockServices();
      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);

      const cmd = visionCommands.find((c) => c.id === "vision:capture-full-page");
      await cmd?.execute(services);

      expect(mockState.setCaptureMode).toHaveBeenCalledWith("full");
      expect(mockState.setRegionSelectionActive).toHaveBeenCalledWith(false);
      expect(mockState.setSelectedRegion).toHaveBeenCalledWith(null);
      expect(services.closeCommandPalette).toHaveBeenCalled();
      expect(mockState.triggerVisionAnalysis).toHaveBeenCalled();
    });

    it("capture-region command enters region selection mode", () => {
      const mockState = {
        setCaptureMode: vi.fn(),
        setRegionSelectionActive: vi.fn(),
        setSelectedRegion: vi.fn(),
      };

      const services = createMockServices();
      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);

      const cmd = visionCommands.find((c) => c.id === "vision:capture-region");
      cmd?.execute(services);

      expect(mockState.setCaptureMode).toHaveBeenCalledWith("region");
      expect(mockState.setRegionSelectionActive).toHaveBeenCalledWith(true);
      expect(mockState.setSelectedRegion).toHaveBeenCalledWith(null);
      expect(services.closeCommandPalette).toHaveBeenCalled();
    });

    it("clear-results command clears vision results", () => {
      const mockState = {
        clearVisionResults: vi.fn(),
      };

      const services = createMockServices();
      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);

      const cmd = visionCommands.find((c) => c.id === "vision:clear-results");
      cmd?.execute(services);

      expect(mockState.clearVisionResults).toHaveBeenCalled();
      expect(services.closeCommandPalette).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Plugin Exports Tests
// ============================================================================

describe("Vision Plugin - Plugin Exports", () => {
  describe("visionPlugin metadata", () => {
    it("has correct id", () => {
      expect(visionPlugin.id).toBe("vision");
    });

    it("has correct name", () => {
      expect(visionPlugin.name).toBe("Vision Analysis");
    });

    it("has correct version", () => {
      expect(visionPlugin.version).toBe("1.0.0");
    });

    it("has description", () => {
      expect(visionPlugin.description).toBeDefined();
      expect(typeof visionPlugin.description).toBe("string");
    });

    it("has meta object with matching values", () => {
      expect(visionPlugin.meta).toBeDefined();
      expect(visionPlugin.meta?.id).toBe("vision");
      expect(visionPlugin.meta?.name).toBe("Vision Analysis");
      expect(visionPlugin.meta?.version).toBe("1.0.0");
      expect(visionPlugin.meta?.icon).toBe("eye");
    });

    it("has commands array", () => {
      expect(visionPlugin.commands).toBeDefined();
      expect(Array.isArray(visionPlugin.commands)).toBe(true);
      expect(visionPlugin.commands).toBe(visionCommands);
    });

    it("has empty inspectorPanels array", () => {
      expect(visionPlugin.inspectorPanels).toBeDefined();
      expect(Array.isArray(visionPlugin.inspectorPanels)).toBe(true);
      expect(visionPlugin.inspectorPanels?.length).toBe(0);
    });

    it("has ruleContributions with semantic-vision", () => {
      expect(visionPlugin.ruleContributions).toBeDefined();
      expect(Array.isArray(visionPlugin.ruleContributions)).toBe(true);
      expect(visionPlugin.ruleContributions?.length).toBe(1);
      expect(visionPlugin.ruleContributions?.[0].ruleId).toBe("semantic-vision");
    });
  });

  describe("handlesRules predicate", () => {
    it("returns true for semantic-vision rule", () => {
      const ruleMeta: RuleMeta = { id: "semantic-vision" };
      expect(visionPlugin.handlesRules?.(ruleMeta)).toBe(true);
    });

    it("returns true for rules containing 'vision' in id", () => {
      const ruleMeta: RuleMeta = { id: "custom-vision-check" };
      expect(visionPlugin.handlesRules?.(ruleMeta)).toBe(true);
    });

    it("returns true for rules with vision category", () => {
      const ruleMeta: RuleMeta = { id: "some-rule", category: "vision" };
      expect(visionPlugin.handlesRules?.(ruleMeta)).toBe(true);
    });

    it("returns false for unrelated rules", () => {
      const ruleMeta: RuleMeta = { id: "eslint-rule", category: "style" };
      expect(visionPlugin.handlesRules?.(ruleMeta)).toBe(false);
    });

    it("returns false for rules without matching criteria", () => {
      const ruleMeta: RuleMeta = { id: "accessibility-check", category: "a11y" };
      expect(visionPlugin.handlesRules?.(ruleMeta)).toBe(false);
    });
  });

  describe("getIssues transformation", () => {
    it("returns correct structure with empty cache", () => {
      const state: VisionSlice = {
        ...defaultVisionState,
        visionIssuesCache: new Map(),
      } as VisionSlice;

      const result = visionPlugin.getIssues?.(state);

      expect(result).toBeDefined();
      expect(result?.pluginId).toBe("vision");
      expect(result?.issues).toBeInstanceOf(Map);
      expect(result?.issues.size).toBe(0);
    });

    it("transforms vision issues to plugin issues format", () => {
      const visionIssues: VisionIssue[] = [
        {
          elementText: "Save Button",
          message: "Button text may be hard to read",
          category: "contrast",
          severity: "warning",
          dataLoc: "src/components/Form.tsx:25:8",
        },
        {
          elementText: "Header",
          message: "Heading not aligned with content",
          category: "alignment",
          severity: "info",
          dataLoc: "src/components/Header.tsx:10:4",
        },
      ];

      const state: VisionSlice = {
        ...defaultVisionState,
        visionIssuesCache: new Map([["/dashboard", visionIssues]]),
      } as VisionSlice;

      const result = visionPlugin.getIssues?.(state);

      expect(result?.pluginId).toBe("vision");
      expect(result?.issues.size).toBe(2);

      // Check first issue
      const formIssues = result?.issues.get("src/components/Form.tsx:25:8");
      expect(formIssues).toBeDefined();
      expect(formIssues?.length).toBe(1);
      expect(formIssues?.[0].message).toBe("Button text may be hard to read");
      expect(formIssues?.[0].severity).toBe("warning");
      expect(formIssues?.[0].ruleId).toBe("semantic-vision");
      expect(formIssues?.[0].metadata?.elementText).toBe("Save Button");
      expect(formIssues?.[0].metadata?.category).toBe("contrast");
      expect(formIssues?.[0].metadata?.route).toBe("/dashboard");

      // Check second issue
      const headerIssues = result?.issues.get("src/components/Header.tsx:10:4");
      expect(headerIssues).toBeDefined();
      expect(headerIssues?.length).toBe(1);
    });

    it("groups multiple issues at same dataLoc", () => {
      const visionIssues: VisionIssue[] = [
        {
          elementText: "Button",
          message: "Issue 1",
          category: "spacing",
          severity: "warning",
          dataLoc: "src/file.tsx:10:5",
        },
        {
          elementText: "Button",
          message: "Issue 2",
          category: "color",
          severity: "error",
          dataLoc: "src/file.tsx:10:5",
        },
      ];

      const state: VisionSlice = {
        ...defaultVisionState,
        visionIssuesCache: new Map([["/page", visionIssues]]),
      } as VisionSlice;

      const result = visionPlugin.getIssues?.(state);

      const issues = result?.issues.get("src/file.tsx:10:5");
      expect(issues?.length).toBe(2);
      expect(issues?.[0].message).toBe("Issue 1");
      expect(issues?.[1].message).toBe("Issue 2");
    });

    it("skips issues without dataLoc", () => {
      const visionIssues: VisionIssue[] = [
        {
          elementText: "Element",
          message: "Issue without dataLoc",
          category: "layout",
          severity: "info",
          // No dataLoc
        },
        {
          elementText: "Element2",
          message: "Issue with dataLoc",
          category: "layout",
          severity: "info",
          dataLoc: "src/file.tsx:5:1",
        },
      ];

      const state: VisionSlice = {
        ...defaultVisionState,
        visionIssuesCache: new Map([["/page", visionIssues]]),
      } as VisionSlice;

      const result = visionPlugin.getIssues?.(state);

      expect(result?.issues.size).toBe(1);
      expect(result?.issues.has("src/file.tsx:5:1")).toBe(true);
    });

    it("handles multiple routes in cache", () => {
      const homeIssues: VisionIssue[] = [
        {
          elementText: "Home Button",
          message: "Home issue",
          category: "spacing",
          severity: "warning",
          dataLoc: "src/Home.tsx:5:1",
        },
      ];

      const aboutIssues: VisionIssue[] = [
        {
          elementText: "About Section",
          message: "About issue",
          category: "alignment",
          severity: "info",
          dataLoc: "src/About.tsx:10:1",
        },
      ];

      const state: VisionSlice = {
        ...defaultVisionState,
        visionIssuesCache: new Map([
          ["/home", homeIssues],
          ["/about", aboutIssues],
        ]),
      } as VisionSlice;

      const result = visionPlugin.getIssues?.(state);

      expect(result?.issues.size).toBe(2);
      expect(result?.issues.has("src/Home.tsx:5:1")).toBe(true);
      expect(result?.issues.has("src/About.tsx:10:1")).toBe(true);
    });
  });

  describe("createSlice factory", () => {
    it("creates slice with services", () => {
      const services = createMockServices();
      const slice = visionPlugin.createSlice?.(services);

      expect(slice).toBeDefined();
      expect(slice?.visionAnalyzing).toBe(false);
      expect(slice?.captureMode).toBe("full");
    });
  });

  describe("initialize function", () => {
    it("subscribes to websocket events", () => {
      const services = createMockServices();
      const cleanup = visionPlugin.initialize?.(services);

      expect(services.websocket.on).toHaveBeenCalledWith(
        "vision:result",
        expect.any(Function)
      );
      expect(services.websocket.on).toHaveBeenCalledWith(
        "vision:progress",
        expect.any(Function)
      );

      // Cleanup function should be returned
      expect(typeof cleanup).toBe("function");
    });

    it("returns cleanup function that unsubscribes", () => {
      const unsubResult = vi.fn();
      const unsubProgress = vi.fn();

      const services = createMockServices();
      (services.websocket.on as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(unsubResult)
        .mockReturnValueOnce(unsubProgress);

      const cleanup = visionPlugin.initialize?.(services);
      expect(cleanup).toBeDefined();

      // Call cleanup
      (cleanup as () => void)();

      expect(unsubResult).toHaveBeenCalled();
      expect(unsubProgress).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// localStorage Settings Tests
// ============================================================================

describe("Vision Plugin - localStorage Settings", () => {
  beforeEach(() => {
    // Stub window so that typeof window !== "undefined" check passes
    vi.stubGlobal("window", {});
    // Clear localStorage mock
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("loadVisionAutoScanSettings", () => {
    it("returns defaults when localStorage is empty", () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const settings = loadVisionAutoScanSettings();

      expect(settings).toEqual(DEFAULT_VISION_AUTO_SCAN_SETTINGS);
    });

    it("returns parsed settings from localStorage", () => {
      const storedSettings = { onRouteChange: true, onInitialLoad: true };
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(storedSettings)
      );

      const settings = loadVisionAutoScanSettings();

      expect(settings.onRouteChange).toBe(true);
      expect(settings.onInitialLoad).toBe(true);
    });

    it("merges partial stored settings with defaults", () => {
      const storedSettings = { onRouteChange: true };
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(storedSettings)
      );

      const settings = loadVisionAutoScanSettings();

      expect(settings.onRouteChange).toBe(true);
      expect(settings.onInitialLoad).toBe(false); // From defaults
    });

    it("returns defaults on parse error", () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        "invalid json"
      );
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const settings = loadVisionAutoScanSettings();

      expect(settings).toEqual(DEFAULT_VISION_AUTO_SCAN_SETTINGS);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("saveVisionAutoScanSettings", () => {
    it("saves settings to localStorage", () => {
      const settings = { onRouteChange: true, onInitialLoad: false };

      saveVisionAutoScanSettings(settings);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        "uilint:visionAutoScanSettings",
        JSON.stringify(settings)
      );
    });

    it("handles save errors gracefully", () => {
      (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error("QuotaExceeded");
        }
      );
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Should not throw
      expect(() => {
        saveVisionAutoScanSettings({ onRouteChange: true, onInitialLoad: true });
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("updateVisionAutoScanSettings action", () => {
    it("updates settings and saves to localStorage", () => {
      const set = vi.fn();
      const currentSettings = { onRouteChange: false, onInitialLoad: false };
      const mockState: VisionSlice = {
        ...defaultVisionState,
        autoScanSettings: currentSettings,
      } as VisionSlice;

      const get = vi.fn(() => mockState);
      const slice = createVisionSlice(set, get);

      slice.updateVisionAutoScanSettings({ onRouteChange: true });

      expect(set).toHaveBeenCalled();
      const callArg = set.mock.calls[0][0] as Partial<VisionSlice>;
      expect(callArg.autoScanSettings?.onRouteChange).toBe(true);
      expect(callArg.autoScanSettings?.onInitialLoad).toBe(false);
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// fetchPersistedScreenshots Tests
// ============================================================================

describe("Vision Plugin - fetchPersistedScreenshots", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it("does nothing if already loading", async () => {
    const set = vi.fn();
    const mockState: VisionSlice = {
      ...defaultVisionState,
      loadingPersistedScreenshots: true,
      persistedScreenshotsFetched: false,
    } as VisionSlice;

    const get = vi.fn(() => mockState);
    const slice = createVisionSlice(set, get);

    await slice.fetchPersistedScreenshots();

    // Should not call set since already loading
    expect(set).not.toHaveBeenCalled();
  });

  it("does nothing if already fetched", async () => {
    const set = vi.fn();
    const mockState: VisionSlice = {
      ...defaultVisionState,
      loadingPersistedScreenshots: false,
      persistedScreenshotsFetched: true,
    } as VisionSlice;

    const get = vi.fn(() => mockState);
    const slice = createVisionSlice(set, get);

    await slice.fetchPersistedScreenshots();

    // Should not call set since already fetched
    expect(set).not.toHaveBeenCalled();
  });

  it("sets loading state and fetches screenshots", async () => {
    const mockScreenshots = [
      {
        filename: "uilint-test-2024-01-15.png",
        metadata: {
          route: "/home",
          timestamp: 1705334400000,
          issues: [{ elementText: "Button", message: "Issue", category: "spacing", severity: "warning" }],
        },
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ screenshots: mockScreenshots }),
    });

    const setCalls: Array<Partial<VisionSlice>> = [];
    const set = vi.fn((partial: Partial<VisionSlice>) => {
      setCalls.push(partial);
    });

    let callCount = 0;
    const get = vi.fn(() => {
      // Simulate state changes
      if (callCount === 0) {
        callCount++;
        return {
          ...defaultVisionState,
          loadingPersistedScreenshots: false,
          persistedScreenshotsFetched: false,
        } as VisionSlice;
      }
      // After loading starts
      return {
        ...defaultVisionState,
        loadingPersistedScreenshots: true,
        persistedScreenshotsFetched: false,
        screenshotHistory: new Map(),
        visionIssuesCache: new Map(),
      } as VisionSlice;
    });

    const slice = createVisionSlice(set, get);

    await slice.fetchPersistedScreenshots();

    // Should have set loading to true first
    expect(setCalls[0]).toEqual({ loadingPersistedScreenshots: true });

    // Should have updated history and cache
    const historyUpdate = setCalls.find((c) => c.screenshotHistory !== undefined);
    expect(historyUpdate).toBeDefined();
    expect(historyUpdate?.screenshotHistory?.size).toBe(1);

    // Should have set loading to false and fetched to true at end
    const finalUpdate = setCalls.find((c) => c.persistedScreenshotsFetched === true);
    expect(finalUpdate).toBeDefined();
    expect(finalUpdate?.loadingPersistedScreenshots).toBe(false);
  });

  it("handles fetch error gracefully", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const setCalls: Array<Partial<VisionSlice>> = [];
    const set = vi.fn((partial: Partial<VisionSlice>) => {
      setCalls.push(partial);
    });

    const get = vi.fn(() => ({
      ...defaultVisionState,
      loadingPersistedScreenshots: false,
      persistedScreenshotsFetched: false,
    } as VisionSlice));

    const slice = createVisionSlice(set, get);

    await slice.fetchPersistedScreenshots();

    // Should still mark as fetched to prevent retries
    const finalUpdate = setCalls.find((c) => c.persistedScreenshotsFetched !== undefined);
    expect(finalUpdate?.loadingPersistedScreenshots).toBe(false);
    expect(finalUpdate?.persistedScreenshotsFetched).toBe(true);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("handles non-ok response gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Not Found",
    });

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const setCalls: Array<Partial<VisionSlice>> = [];
    const set = vi.fn((partial: Partial<VisionSlice>) => {
      setCalls.push(partial);
    });

    const get = vi.fn(() => ({
      ...defaultVisionState,
      loadingPersistedScreenshots: false,
      persistedScreenshotsFetched: false,
    } as VisionSlice));

    const slice = createVisionSlice(set, get);

    await slice.fetchPersistedScreenshots();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Vision Plugin] Failed to fetch screenshots:",
      "Not Found"
    );

    consoleSpy.mockRestore();
  });

  it("handles empty screenshots array", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ screenshots: [] }),
    });

    const setCalls: Array<Partial<VisionSlice>> = [];
    const set = vi.fn((partial: Partial<VisionSlice>) => {
      setCalls.push(partial);
    });

    const get = vi.fn(() => ({
      ...defaultVisionState,
      loadingPersistedScreenshots: false,
      persistedScreenshotsFetched: false,
    } as VisionSlice));

    const slice = createVisionSlice(set, get);

    await slice.fetchPersistedScreenshots();

    // Should not update history when no screenshots
    const historyUpdate = setCalls.find((c) => c.screenshotHistory !== undefined);
    expect(historyUpdate).toBeUndefined();
  });

  it("does not overwrite existing screenshots with data URLs", async () => {
    const mockScreenshots = [
      {
        filename: "existing-capture.png",
        metadata: { route: "/test", timestamp: Date.now() },
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ screenshots: mockScreenshots }),
    });

    const existingCapture: ScreenshotCapture = {
      id: "capture_existing-capture",
      route: "/test",
      timestamp: Date.now(),
      type: "full",
      dataUrl: "data:image/png;base64,existingData", // Has dataUrl
    };

    const setCalls: Array<Partial<VisionSlice>> = [];
    const set = vi.fn((partial: Partial<VisionSlice>) => {
      setCalls.push(partial);
    });

    let callCount = 0;
    const get = vi.fn(() => {
      if (callCount === 0) {
        callCount++;
        return {
          ...defaultVisionState,
          loadingPersistedScreenshots: false,
          persistedScreenshotsFetched: false,
        } as VisionSlice;
      }
      return {
        ...defaultVisionState,
        loadingPersistedScreenshots: true,
        persistedScreenshotsFetched: false,
        screenshotHistory: new Map([["capture_existing-capture", existingCapture]]),
        visionIssuesCache: new Map(),
      } as VisionSlice;
    });

    const slice = createVisionSlice(set, get);

    await slice.fetchPersistedScreenshots();

    // Should not overwrite the existing capture
    const historyUpdate = setCalls.find((c) => c.screenshotHistory !== undefined);
    if (historyUpdate?.screenshotHistory) {
      const capture = historyUpdate.screenshotHistory.get("capture_existing-capture");
      expect(capture?.dataUrl).toBe("data:image/png;base64,existingData");
    }
  });
});

// ============================================================================
// triggerVisionAnalysis Tests
// ============================================================================

// Mock the vision-capture module
vi.mock("../../scanner/vision-capture", () => ({
  captureScreenshot: vi.fn(),
  captureScreenshotRegion: vi.fn(),
  collectElementManifest: vi.fn(),
  getCurrentRoute: vi.fn(),
}));

import {
  captureScreenshot,
  captureScreenshotRegion,
  collectElementManifest,
  getCurrentRoute,
} from "../../scanner/vision-capture";
import { createTriggerVisionAnalysis } from "./slice";

/**
 * Create a fully mocked VisionSlice state with all action methods
 */
function createFullyMockedVisionState(overrides: Partial<VisionSlice> = {}): VisionSlice {
  return {
    ...defaultVisionState,
    // All action methods as mocks
    setVisionAvailable: vi.fn(),
    triggerVisionAnalysis: vi.fn().mockResolvedValue(undefined),
    clearVisionResults: vi.fn(),
    clearVisionLastError: vi.fn(),
    setHighlightedVisionElementId: vi.fn(),
    setCaptureMode: vi.fn(),
    setRegionSelectionActive: vi.fn(),
    setSelectedRegion: vi.fn(),
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
    ...overrides,
  } as VisionSlice;
}

describe("Vision Plugin - triggerVisionAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mock implementations
    (getCurrentRoute as ReturnType<typeof vi.fn>).mockReturnValue("/test-route");
    (collectElementManifest as ReturnType<typeof vi.fn>).mockReturnValue([
      { id: "el1", text: "Button", dataLoc: "src/app.tsx:10:5", rect: { x: 0, y: 0, width: 100, height: 50 }, tagName: "button" },
    ]);
    (captureScreenshot as ReturnType<typeof vi.fn>).mockResolvedValue("data:image/png;base64,fullpage");
    (captureScreenshotRegion as ReturnType<typeof vi.fn>).mockResolvedValue("data:image/png;base64,region");
  });

  it("logs warning when called without integration", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { state } = createMockSlice();

    await state.triggerVisionAnalysis();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Vision Plugin] triggerVisionAnalysis called without integration"
    );

    consoleSpy.mockRestore();
  });

  describe("with services integration", () => {
    /**
     * Helper to set up mock services with websocket that responds to screenshot:save
     */
    function setupWebsocketMock(services: PluginServices, filename: string) {
      let screenshotSavedHandler: ((msg: unknown) => void) | null = null;

      // Mock websocket.on to capture the handler for screenshot:saved
      (services.websocket.on as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string, handler: (msg: unknown) => void) => {
          if (type === "screenshot:saved") {
            screenshotSavedHandler = handler;
          }
          return vi.fn(); // Return unsubscribe function
        }
      );

      // Mock websocket.send to trigger the handler when screenshot:save is sent
      (services.websocket.send as ReturnType<typeof vi.fn>).mockImplementation(
        (message: unknown) => {
          const msg = message as { type?: string };
          if (msg.type === "screenshot:save" && screenshotSavedHandler) {
            // Use queueMicrotask to simulate async response
            queueMicrotask(() => {
              screenshotSavedHandler!({ filename });
            });
          }
        }
      );
    }

    it("captures full page screenshot when captureMode is 'full'", async () => {
      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "full",
        selectedRegion: null,
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);
      setupWebsocketMock(services, "test-screenshot.png");

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
      await triggerVisionAnalysis();

      expect(captureScreenshot).toHaveBeenCalled();
      expect(captureScreenshotRegion).not.toHaveBeenCalled();
    });

    it("captures region screenshot when captureMode is 'region' and selectedRegion exists", async () => {
      const region: CaptureRegion = { x: 10, y: 20, width: 200, height: 300 };
      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "region",
        selectedRegion: region,
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);
      setupWebsocketMock(services, "test-region.png");

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
      await triggerVisionAnalysis();

      expect(captureScreenshotRegion).toHaveBeenCalledWith(region);
      expect(captureScreenshot).not.toHaveBeenCalled();
    });

    it("falls back to full page capture when captureMode is 'region' but no selectedRegion", async () => {
      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "region",
        selectedRegion: null,
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);
      setupWebsocketMock(services, "test-fallback.png");

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
      await triggerVisionAnalysis();

      expect(captureScreenshot).toHaveBeenCalled();
      expect(captureScreenshotRegion).not.toHaveBeenCalled();
    });

    it("sends screenshot:save message via websocket", async () => {
      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "full",
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);
      setupWebsocketMock(services, "saved.png");

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
      await triggerVisionAnalysis();

      expect(services.websocket.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "screenshot:save",
          dataUrl: "data:image/png;base64,fullpage",
          route: "/test-route",
          timestamp: expect.any(Number),
        })
      );
    });

    it("sends vision:analyze message after screenshot saved", async () => {
      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "full",
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);
      setupWebsocketMock(services, "analysis-test.png");

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
      await triggerVisionAnalysis();

      // First call is screenshot:save, second is vision:analyze
      const sendCalls = (services.websocket.send as ReturnType<typeof vi.fn>).mock.calls;
      expect(sendCalls.length).toBeGreaterThanOrEqual(2);

      const analyzeCall = sendCalls.find((call) => call[0]?.type === "vision:analyze");
      expect(analyzeCall).toBeDefined();
      expect(analyzeCall[0]).toEqual(
        expect.objectContaining({
          type: "vision:analyze",
          route: "/test-route",
          screenshot: "data:image/png;base64,fullpage",
          screenshotFile: "analysis-test.png",
          manifest: expect.any(Array),
        })
      );
    });

    it("sets visionAnalyzing to true during capture", async () => {
      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "full",
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);
      setupWebsocketMock(services, "test.png");

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
      await triggerVisionAnalysis();

      expect(mockState.setVisionAnalyzing).toHaveBeenCalledWith(true);
    });

    it("adds screenshot to history", async () => {
      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "full",
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);
      setupWebsocketMock(services, "history-test.png");

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
      await triggerVisionAnalysis();

      expect(mockState.addScreenshotToHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          route: "/test-route",
          dataUrl: "data:image/png;base64,fullpage",
          type: "full",
          timestamp: expect.any(Number),
        })
      );
    });

    it("adds screenshot to history with region type and bounds when capturing region", async () => {
      const region: CaptureRegion = { x: 50, y: 100, width: 300, height: 400 };
      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "region",
        selectedRegion: region,
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);
      setupWebsocketMock(services, "region-history.png");

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
      await triggerVisionAnalysis();

      expect(mockState.addScreenshotToHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "region",
          region: region,
          dataUrl: "data:image/png;base64,region",
        })
      );
    });

    it("handles capture errors gracefully", async () => {
      const captureError = new Error("Screenshot capture failed");
      (captureScreenshot as ReturnType<typeof vi.fn>).mockRejectedValue(captureError);

      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "full",
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
      await triggerVisionAnalysis();

      expect(mockState.setVisionLastError).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: "capture",
          message: expect.stringContaining("Screenshot capture failed"),
          route: "/test-route",
          timestamp: expect.any(Number),
        })
      );
      // Should set analyzing to false after error
      expect(mockState.setVisionAnalyzing).toHaveBeenLastCalledWith(false);
    });

    it("handles websocket save timeout gracefully", async () => {
      // Use fake timers from the start
      vi.useFakeTimers();

      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "full",
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);

      // Don't set up the websocket mock to respond - simulating timeout
      (services.websocket.on as ReturnType<typeof vi.fn>).mockImplementation(() => vi.fn());
      (services.websocket.send as ReturnType<typeof vi.fn>).mockImplementation(() => {});

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);

      // Start the function but don't await yet
      const promise = triggerVisionAnalysis();

      // Advance timers past the 10-second timeout
      await vi.advanceTimersByTimeAsync(15000);

      // Now await the promise
      await promise;

      // Restore real timers
      vi.useRealTimers();

      // Should have set an error for the timeout
      expect(mockState.setVisionLastError).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: "ws",
          message: expect.stringContaining("Timeout"),
        })
      );
      expect(mockState.setVisionAnalyzing).toHaveBeenLastCalledWith(false);
    });

    it("clears region selection after region capture", async () => {
      const region: CaptureRegion = { x: 10, y: 20, width: 200, height: 300 };
      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "region",
        selectedRegion: region,
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);
      setupWebsocketMock(services, "region-clear.png");

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
      await triggerVisionAnalysis();

      expect(mockState.setRegionSelectionActive).toHaveBeenCalledWith(false);
      expect(mockState.setSelectedRegion).toHaveBeenCalledWith(null);
    });

    it("sets progress phase during each step", async () => {
      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "full",
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);
      setupWebsocketMock(services, "progress-test.png");

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
      await triggerVisionAnalysis();

      const phaseCalls = (mockState.setVisionProgressPhase as ReturnType<typeof vi.fn>).mock.calls;
      expect(phaseCalls.some((call) => call[0] === "capturing")).toBe(true);
      expect(phaseCalls.some((call) => call[0] === "saving")).toBe(true);
      expect(phaseCalls.some((call) => call[0] === "analyzing")).toBe(true);
    });

    it("passes region to collectElementManifest for region capture", async () => {
      const region: CaptureRegion = { x: 10, y: 20, width: 200, height: 300 };
      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "region",
        selectedRegion: region,
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);
      setupWebsocketMock(services, "manifest-region.png");

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
      await triggerVisionAnalysis();

      expect(collectElementManifest).toHaveBeenCalledWith(document.body, region);
    });

    it("does not pass region to collectElementManifest for full page capture", async () => {
      const services = createMockServices();
      const mockState = createFullyMockedVisionState({
        captureMode: "full",
      });

      (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(mockState);
      setupWebsocketMock(services, "manifest-full.png");

      const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
      await triggerVisionAnalysis();

      expect(collectElementManifest).toHaveBeenCalledWith(document.body, undefined);
    });
  });
});
