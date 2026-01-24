/**
 * Vision Plugin Tests
 *
 * Tests for vision plugin state slice, commands, and exports.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createVisionSlice,
  defaultVisionState,
  loadVisionAutoScanSettings,
  saveVisionAutoScanSettings,
} from "./slice";
import type { VisionSlice, VisionSliceState } from "./slice";
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
      const { state, set, get } = createMockSlice();

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
      const { state, set, get } = createMockSlice();

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
      const { state, set, get } = createMockSlice();

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
