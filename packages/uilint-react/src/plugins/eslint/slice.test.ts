/**
 * Unit tests for ESLint plugin slice
 * Tests state creation, filtering functions, and actions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createESLintSlice,
  createESLintActions,
  filterIssuesByDisabledRules,
  type ESLintSlice,
} from "./slice";
import type { ESLintIssue, ScannedElement, ElementIssue } from "./types";
import type { PluginServices } from "../../core/plugin-system/types";

/**
 * Create mock plugin services for testing
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
    getState: vi.fn(() => ({})),
    setState: vi.fn(),
    openInspector: vi.fn(),
    closeCommandPalette: vi.fn(),
  };
}

/**
 * Create a mock ESLint issue for testing
 */
function createMockIssue(overrides: Partial<ESLintIssue> = {}): ESLintIssue {
  return {
    line: 10,
    column: 5,
    message: "Test issue message",
    ruleId: "uilint/test-rule",
    dataLoc: "app/page.tsx:10:5",
    ...overrides,
  };
}

/**
 * Create a mock scanned element for testing
 */
function createMockScannedElement(
  id: string,
  fileName: string,
  lineNumber: number,
  columnNumber = 0
): ScannedElement {
  return {
    id,
    element: {} as Element,
    tagName: "div",
    className: "test-class",
    source: {
      fileName,
      lineNumber,
      columnNumber,
    },
    rect: { x: 0, y: 0, width: 100, height: 50 } as DOMRect,
  };
}

// ============================================================================
// createESLintSlice tests
// ============================================================================

describe("createESLintSlice", () => {
  let services: PluginServices;

  beforeEach(() => {
    services = createMockServices();
  });

  it("returns correct initial state structure", () => {
    const slice = createESLintSlice(services);

    expect(slice).toBeDefined();
    expect(typeof slice).toBe("object");
  });

  it("liveScanEnabled defaults to false", () => {
    const slice = createESLintSlice(services);

    expect(slice.liveScanEnabled).toBe(false);
  });

  it("scanStatus defaults to idle", () => {
    const slice = createESLintSlice(services);

    expect(slice.scanStatus).toBe("idle");
  });

  it("scanLock defaults to false", () => {
    const slice = createESLintSlice(services);

    expect(slice.scanLock).toBe(false);
  });

  it("scannedElements is empty initially", () => {
    const slice = createESLintSlice(services);

    expect(slice.scannedElements).toEqual([]);
    expect(slice.scannedElements).toHaveLength(0);
  });

  it("elementIssuesCache is empty Map initially", () => {
    const slice = createESLintSlice(services);

    expect(slice.elementIssuesCache).toBeInstanceOf(Map);
    expect(slice.elementIssuesCache.size).toBe(0);
  });

  it("fileIssuesCache is empty Map initially", () => {
    const slice = createESLintSlice(services);

    expect(slice.fileIssuesCache).toBeInstanceOf(Map);
    expect(slice.fileIssuesCache.size).toBe(0);
  });

  it("eslintIssuesCache is empty Map initially", () => {
    const slice = createESLintSlice(services);

    expect(slice.eslintIssuesCache).toBeInstanceOf(Map);
    expect(slice.eslintIssuesCache.size).toBe(0);
  });

  it("availableRules is empty array initially", () => {
    const slice = createESLintSlice(services);

    expect(slice.availableRules).toEqual([]);
  });

  it("ruleConfigs is empty Map initially", () => {
    const slice = createESLintSlice(services);

    expect(slice.ruleConfigs).toBeInstanceOf(Map);
    expect(slice.ruleConfigs.size).toBe(0);
  });

  it("disabledRules is empty Set initially", () => {
    const slice = createESLintSlice(services);

    expect(slice.disabledRules).toBeInstanceOf(Set);
    expect(slice.disabledRules.size).toBe(0);
  });

  it("workspace paths are null initially", () => {
    const slice = createESLintSlice(services);

    expect(slice.workspaceRoot).toBeNull();
    expect(slice.appRoot).toBeNull();
    expect(slice.serverCwd).toBeNull();
  });

  it("heatmap Maps are empty initially", () => {
    const slice = createESLintSlice(services);

    expect(slice.topLevelElementsByFile).toBeInstanceOf(Map);
    expect(slice.topLevelElementsByFile.size).toBe(0);
    expect(slice.mergedIssueCounts).toBeInstanceOf(Map);
    expect(slice.mergedIssueCounts.size).toBe(0);
  });

  it("scan progress counters are zero initially", () => {
    const slice = createESLintSlice(services);

    expect(slice.currentScanIndex).toBe(0);
    expect(slice.totalElements).toBe(0);
  });

  it("autoScanSettings has correct defaults", () => {
    const slice = createESLintSlice(services);

    expect(slice.autoScanSettings).toEqual({
      eslint: {
        onPageLoad: false,
        onFileChange: true,
      },
      vision: {
        onRouteChange: false,
        onInitialLoad: false,
      },
    });
  });
});

// ============================================================================
// filterIssuesByDisabledRules tests
// ============================================================================

describe("filterIssuesByDisabledRules", () => {
  it("returns all issues when disabledRules is empty", () => {
    const issues: ESLintIssue[] = [
      createMockIssue({ ruleId: "uilint/rule-a" }),
      createMockIssue({ ruleId: "uilint/rule-b" }),
      createMockIssue({ ruleId: "uilint/rule-c" }),
    ];
    const disabledRules = new Set<string>();

    const result = filterIssuesByDisabledRules(issues, disabledRules);

    expect(result).toHaveLength(3);
    expect(result).toEqual(issues);
  });

  it("filters out issues from disabled rules", () => {
    const issues: ESLintIssue[] = [
      createMockIssue({ ruleId: "uilint/rule-a", message: "Issue A" }),
      createMockIssue({ ruleId: "uilint/rule-b", message: "Issue B" }),
      createMockIssue({ ruleId: "uilint/rule-c", message: "Issue C" }),
    ];
    const disabledRules = new Set(["uilint/rule-b"]);

    const result = filterIssuesByDisabledRules(issues, disabledRules);

    expect(result).toHaveLength(2);
    expect(result.map((i) => i.ruleId)).toEqual([
      "uilint/rule-a",
      "uilint/rule-c",
    ]);
  });

  it("filters out multiple disabled rules", () => {
    const issues: ESLintIssue[] = [
      createMockIssue({ ruleId: "uilint/rule-a" }),
      createMockIssue({ ruleId: "uilint/rule-b" }),
      createMockIssue({ ruleId: "uilint/rule-c" }),
      createMockIssue({ ruleId: "uilint/rule-d" }),
    ];
    const disabledRules = new Set(["uilint/rule-a", "uilint/rule-c"]);

    const result = filterIssuesByDisabledRules(issues, disabledRules);

    expect(result).toHaveLength(2);
    expect(result.map((i) => i.ruleId)).toEqual([
      "uilint/rule-b",
      "uilint/rule-d",
    ]);
  });

  it("keeps issues without ruleId (does not filter them)", () => {
    const issues: ESLintIssue[] = [
      createMockIssue({ ruleId: undefined, message: "No rule ID" }),
      createMockIssue({ ruleId: "uilint/rule-a", message: "Has rule ID" }),
    ];
    const disabledRules = new Set(["uilint/rule-a"]);

    const result = filterIssuesByDisabledRules(issues, disabledRules);

    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("No rule ID");
  });

  it("handles empty issues array", () => {
    const issues: ESLintIssue[] = [];
    const disabledRules = new Set(["uilint/rule-a"]);

    const result = filterIssuesByDisabledRules(issues, disabledRules);

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it("returns same array reference when no disabled rules", () => {
    const issues: ESLintIssue[] = [createMockIssue()];
    const disabledRules = new Set<string>();

    const result = filterIssuesByDisabledRules(issues, disabledRules);

    // Performance optimization: same reference when no filtering needed
    expect(result).toBe(issues);
  });

  it("returns empty array when all rules are disabled", () => {
    const issues: ESLintIssue[] = [
      createMockIssue({ ruleId: "uilint/rule-a" }),
      createMockIssue({ ruleId: "uilint/rule-b" }),
    ];
    const disabledRules = new Set(["uilint/rule-a", "uilint/rule-b"]);

    const result = filterIssuesByDisabledRules(issues, disabledRules);

    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// createESLintActions tests
// ============================================================================

describe("createESLintActions", () => {
  let services: PluginServices;
  let slice: ESLintSlice;
  let setSliceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    services = createMockServices();
    slice = createESLintSlice(services);
    setSliceMock = vi.fn((partial: Partial<ESLintSlice>) => {
      slice = { ...slice, ...partial };
    });
  });

  describe("enableLiveScan", () => {
    it("sets liveScanEnabled to true", async () => {
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      await actions.enableLiveScan(false);

      expect(setSliceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          liveScanEnabled: true,
        })
      );
    });

    it("sets scanLock to true to prevent concurrent scans", async () => {
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      await actions.enableLiveScan(false);

      expect(setSliceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scanLock: true,
        })
      );
    });

    it("sets scanStatus to scanning", async () => {
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      await actions.enableLiveScan(false);

      expect(setSliceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scanStatus: "scanning",
        })
      );
    });

    it("does nothing when scanLock is already true", async () => {
      slice.scanLock = true;
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      await actions.enableLiveScan(false);

      expect(setSliceMock).not.toHaveBeenCalled();
    });
  });

  describe("disableLiveScan", () => {
    it("sets liveScanEnabled to false", () => {
      slice.liveScanEnabled = true;
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.disableLiveScan();

      expect(setSliceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          liveScanEnabled: false,
        })
      );
    });

    it("resets scanLock to false", () => {
      slice.scanLock = true;
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.disableLiveScan();

      expect(setSliceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scanLock: false,
        })
      );
    });

    it("sets scanStatus to idle", () => {
      slice.scanStatus = "scanning";
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.disableLiveScan();

      expect(setSliceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scanStatus: "idle",
        })
      );
    });

    it("clears scannedElements array", () => {
      slice.scannedElements = [
        createMockScannedElement("el-1", "app/page.tsx", 10),
      ];
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.disableLiveScan();

      expect(setSliceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scannedElements: [],
        })
      );
    });

    it("clears elementIssuesCache", () => {
      slice.elementIssuesCache.set("app/page.tsx:10:5", {
        dataLoc: "app/page.tsx:10:5",
        issues: [createMockIssue()],
        status: "complete",
      });
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.disableLiveScan();

      const call = setSliceMock.mock.calls[0][0];
      expect(call.elementIssuesCache).toBeInstanceOf(Map);
      expect(call.elementIssuesCache.size).toBe(0);
    });

    it("clears fileIssuesCache", () => {
      slice.fileIssuesCache.set("app/page.tsx", [createMockIssue()]);
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.disableLiveScan();

      const call = setSliceMock.mock.calls[0][0];
      expect(call.fileIssuesCache).toBeInstanceOf(Map);
      expect(call.fileIssuesCache.size).toBe(0);
    });

    it("resets scan progress counters", () => {
      slice.currentScanIndex = 5;
      slice.totalElements = 10;
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.disableLiveScan();

      expect(setSliceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          currentScanIndex: 0,
          totalElements: 0,
        })
      );
    });
  });

  describe("scanNewElements", () => {
    it("does nothing when liveScanEnabled is false", async () => {
      slice.liveScanEnabled = false;
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      await actions.scanNewElements([
        createMockScannedElement("el-1", "app/page.tsx", 10),
      ]);

      expect(setSliceMock).not.toHaveBeenCalled();
    });

    it("does nothing when elements array is empty", async () => {
      slice.liveScanEnabled = true;
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      await actions.scanNewElements([]);

      expect(setSliceMock).not.toHaveBeenCalled();
    });

    it("adds new elements to scannedElements", async () => {
      slice.liveScanEnabled = true;
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );
      const newElements = [
        createMockScannedElement("el-1", "app/page.tsx", 10),
        createMockScannedElement("el-2", "app/page.tsx", 15),
      ];

      await actions.scanNewElements(newElements);

      expect(setSliceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scannedElements: newElements,
          totalElements: 2,
        })
      );
    });

    it("appends to existing scannedElements", async () => {
      slice.liveScanEnabled = true;
      const existingElement = createMockScannedElement(
        "el-0",
        "app/page.tsx",
        5
      );
      slice.scannedElements = [existingElement];
      slice.totalElements = 1;
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );
      const newElements = [
        createMockScannedElement("el-1", "app/page.tsx", 10),
      ];

      await actions.scanNewElements(newElements);

      expect(setSliceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scannedElements: [existingElement, ...newElements],
          totalElements: 2,
        })
      );
    });
  });

  describe("updateElementIssue", () => {
    it("adds issue to elementIssuesCache", () => {
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );
      const dataLoc = "app/page.tsx:10:5";
      const issue: ElementIssue = {
        dataLoc,
        issues: [createMockIssue()],
        status: "complete",
      };

      actions.updateElementIssue(dataLoc, issue);

      const call = setSliceMock.mock.calls[0][0];
      expect(call.elementIssuesCache.get(dataLoc)).toEqual(issue);
    });

    it("updates existing issue in cache", () => {
      const dataLoc = "app/page.tsx:10:5";
      slice.elementIssuesCache.set(dataLoc, {
        dataLoc,
        issues: [createMockIssue({ message: "Old issue" })],
        status: "pending",
      });
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );
      const updatedIssue: ElementIssue = {
        dataLoc,
        issues: [createMockIssue({ message: "New issue" })],
        status: "complete",
      };

      actions.updateElementIssue(dataLoc, updatedIssue);

      const call = setSliceMock.mock.calls[0][0];
      expect(call.elementIssuesCache.get(dataLoc)).toEqual(updatedIssue);
    });
  });

  describe("updateFileIssues", () => {
    it("adds issues to fileIssuesCache", () => {
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );
      const filePath = "app/page.tsx";
      const issues = [createMockIssue(), createMockIssue({ line: 20 })];

      actions.updateFileIssues(filePath, issues);

      const call = setSliceMock.mock.calls[0][0];
      expect(call.fileIssuesCache.get(filePath)).toEqual(issues);
    });

    it("removes entry when issues array is empty", () => {
      const filePath = "app/page.tsx";
      slice.fileIssuesCache.set(filePath, [createMockIssue()]);
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.updateFileIssues(filePath, []);

      const call = setSliceMock.mock.calls[0][0];
      expect(call.fileIssuesCache.has(filePath)).toBe(false);
    });
  });

  describe("removeStaleResults", () => {
    it("removes elements by ID", () => {
      const el1 = createMockScannedElement("el-1", "app/page.tsx", 10);
      const el2 = createMockScannedElement("el-2", "app/page.tsx", 15);
      const el3 = createMockScannedElement("el-3", "app/other.tsx", 5);
      slice.scannedElements = [el1, el2, el3];
      slice.elementIssuesCache.set("app/page.tsx:10:0", {
        dataLoc: "app/page.tsx:10:0",
        issues: [createMockIssue()],
        status: "complete",
      });
      slice.elementIssuesCache.set("app/page.tsx:15:0", {
        dataLoc: "app/page.tsx:15:0",
        issues: [createMockIssue()],
        status: "complete",
      });

      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.removeStaleResults(["el-1"]);

      const call = setSliceMock.mock.calls[0][0];
      expect(call.scannedElements).toHaveLength(2);
      expect(call.scannedElements.map((e: ScannedElement) => e.id)).toEqual([
        "el-2",
        "el-3",
      ]);
    });

    it("updates totalElements after removal", () => {
      slice.scannedElements = [
        createMockScannedElement("el-1", "app/page.tsx", 10),
        createMockScannedElement("el-2", "app/page.tsx", 15),
      ];
      slice.totalElements = 2;
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.removeStaleResults(["el-1"]);

      const call = setSliceMock.mock.calls[0][0];
      expect(call.totalElements).toBe(1);
    });

    it("removes cache entries for dataLocs with no remaining elements", () => {
      const el1 = createMockScannedElement("el-1", "app/page.tsx", 10, 0);
      slice.scannedElements = [el1];
      slice.elementIssuesCache.set("app/page.tsx:10:0", {
        dataLoc: "app/page.tsx:10:0",
        issues: [createMockIssue()],
        status: "complete",
      });
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.removeStaleResults(["el-1"]);

      const call = setSliceMock.mock.calls[0][0];
      expect(call.elementIssuesCache.has("app/page.tsx:10:0")).toBe(false);
    });

    it("keeps cache entries when other elements share the same dataLoc", () => {
      // Two elements sharing the same source location
      const el1 = createMockScannedElement("el-1", "app/list.tsx", 10, 0);
      const el2 = createMockScannedElement("el-2", "app/list.tsx", 10, 0);
      slice.scannedElements = [el1, el2];
      slice.elementIssuesCache.set("app/list.tsx:10:0", {
        dataLoc: "app/list.tsx:10:0",
        issues: [createMockIssue()],
        status: "complete",
      });
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      // Remove only one of the two elements
      actions.removeStaleResults(["el-1"]);

      const call = setSliceMock.mock.calls[0][0];
      // Cache should still have the entry because el-2 still references it
      expect(call.elementIssuesCache.has("app/list.tsx:10:0")).toBe(true);
    });
  });

  describe("toggleRule", () => {
    it("adds rule to disabledRules when not present", () => {
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.toggleRule("uilint/rule-a");

      const call = setSliceMock.mock.calls[0][0];
      expect(call.disabledRules.has("uilint/rule-a")).toBe(true);
    });

    it("removes rule from disabledRules when already present", () => {
      slice.disabledRules.add("uilint/rule-a");
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.toggleRule("uilint/rule-a");

      const call = setSliceMock.mock.calls[0][0];
      expect(call.disabledRules.has("uilint/rule-a")).toBe(false);
    });

    it("preserves other disabled rules when toggling", () => {
      slice.disabledRules.add("uilint/rule-a");
      slice.disabledRules.add("uilint/rule-b");
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.toggleRule("uilint/rule-a");

      const call = setSliceMock.mock.calls[0][0];
      expect(call.disabledRules.has("uilint/rule-a")).toBe(false);
      expect(call.disabledRules.has("uilint/rule-b")).toBe(true);
    });
  });

  describe("setRuleConfig", () => {
    it("sets rule as updating", async () => {
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      await actions.setRuleConfig("uilint/rule-a", "error");

      const call = setSliceMock.mock.calls[0][0];
      expect(call.ruleConfigUpdating.get("uilint/rule-a")).toBe(true);
    });

    it("sends WebSocket message with rule config", async () => {
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      await actions.setRuleConfig("uilint/rule-a", "warn", { option1: true });

      expect(services.websocket.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "rule:config:set",
          ruleId: "uilint/rule-a",
          severity: "warn",
          options: { option1: true },
        })
      );
    });

    it("generates unique requestId", async () => {
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      await actions.setRuleConfig("uilint/rule-a", "error");

      expect(services.websocket.send).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.stringMatching(/^rule_\d+_[a-z0-9]+$/),
        })
      );
    });
  });

  describe("computeHeatmapData", () => {
    it("computes topLevelElementsByFile correctly", () => {
      slice.scannedElements = [
        createMockScannedElement("el-1", "app/page.tsx", 10),
        createMockScannedElement("el-2", "app/page.tsx", 20),
        createMockScannedElement("el-3", "app/other.tsx", 5),
      ];
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.computeHeatmapData();

      const call = setSliceMock.mock.calls[0][0];
      expect(call.topLevelElementsByFile.get("app/page.tsx")).toBe("el-1");
      expect(call.topLevelElementsByFile.get("app/other.tsx")).toBe("el-3");
    });

    it("computes mergedIssueCounts for elements", () => {
      slice.scannedElements = [
        createMockScannedElement("el-1", "app/page.tsx", 10, 0),
      ];
      slice.elementIssuesCache.set("app/page.tsx:10:0", {
        dataLoc: "app/page.tsx:10:0",
        issues: [
          createMockIssue({ ruleId: "uilint/rule-a" }),
          createMockIssue({ ruleId: "uilint/rule-b" }),
        ],
        status: "complete",
      });
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.computeHeatmapData();

      const call = setSliceMock.mock.calls[0][0];
      expect(call.mergedIssueCounts.get("el-1")).toBe(2);
    });

    it("excludes disabled rules from mergedIssueCounts", () => {
      slice.scannedElements = [
        createMockScannedElement("el-1", "app/page.tsx", 10, 0),
      ];
      slice.elementIssuesCache.set("app/page.tsx:10:0", {
        dataLoc: "app/page.tsx:10:0",
        issues: [
          createMockIssue({ ruleId: "uilint/rule-a" }),
          createMockIssue({ ruleId: "uilint/rule-b" }),
        ],
        status: "complete",
      });
      slice.disabledRules.add("uilint/rule-a");
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.computeHeatmapData();

      const call = setSliceMock.mock.calls[0][0];
      expect(call.mergedIssueCounts.get("el-1")).toBe(1);
    });

    it("adds file-level issues to top-level element counts", () => {
      slice.scannedElements = [
        createMockScannedElement("el-1", "app/page.tsx", 10, 0),
        createMockScannedElement("el-2", "app/page.tsx", 20, 0),
      ];
      slice.elementIssuesCache.set("app/page.tsx:10:0", {
        dataLoc: "app/page.tsx:10:0",
        issues: [createMockIssue()],
        status: "complete",
      });
      // File-level issues (not mapped to specific elements)
      slice.fileIssuesCache.set("app/page.tsx", [
        createMockIssue({ ruleId: "file-level-rule" }),
        createMockIssue({ ruleId: "another-file-rule" }),
      ]);
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.computeHeatmapData();

      const call = setSliceMock.mock.calls[0][0];
      // el-1 is top-level, should have 1 element issue + 2 file issues = 3
      expect(call.mergedIssueCounts.get("el-1")).toBe(3);
      // el-2 is not top-level, should only have its own issues (none)
      expect(call.mergedIssueCounts.get("el-2")).toBe(0);
    });
  });

  describe("updateAutoScanSettings", () => {
    it("updates ESLint settings", () => {
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.updateAutoScanSettings({
        eslint: { onPageLoad: true },
      });

      const call = setSliceMock.mock.calls[0][0];
      expect(call.autoScanSettings.eslint.onPageLoad).toBe(true);
      expect(call.autoScanSettings.eslint.onFileChange).toBe(true); // preserved
    });

    it("updates vision settings", () => {
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.updateAutoScanSettings({
        vision: { onRouteChange: true },
      });

      const call = setSliceMock.mock.calls[0][0];
      expect(call.autoScanSettings.vision.onRouteChange).toBe(true);
      expect(call.autoScanSettings.vision.onInitialLoad).toBe(false); // preserved
    });
  });

  describe("invalidateCache", () => {
    it("clears specific file from cache", () => {
      slice.eslintIssuesCache.set("app/page.tsx", [createMockIssue()]);
      slice.eslintIssuesCache.set("app/other.tsx", [createMockIssue()]);
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.invalidateCache("app/page.tsx");

      const call = setSliceMock.mock.calls[0][0];
      expect(call.eslintIssuesCache.has("app/page.tsx")).toBe(false);
      expect(call.eslintIssuesCache.has("app/other.tsx")).toBe(true);
    });

    it("clears all cache when no filePath provided", () => {
      slice.eslintIssuesCache.set("app/page.tsx", [createMockIssue()]);
      slice.eslintIssuesCache.set("app/other.tsx", [createMockIssue()]);
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.invalidateCache();

      const call = setSliceMock.mock.calls[0][0];
      expect(call.eslintIssuesCache.size).toBe(0);
    });

    it("sends WebSocket message to server", () => {
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.invalidateCache("app/page.tsx");

      expect(services.websocket.send).toHaveBeenCalledWith({
        type: "cache:invalidate",
        filePath: "app/page.tsx",
      });
    });

    it("sends WebSocket message without filePath for full invalidation", () => {
      const actions = createESLintActions(
        services,
        () => slice,
        setSliceMock
      );

      actions.invalidateCache();

      expect(services.websocket.send).toHaveBeenCalledWith({
        type: "cache:invalidate",
        filePath: undefined,
      });
    });
  });
});
