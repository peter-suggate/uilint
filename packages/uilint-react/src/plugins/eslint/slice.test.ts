/**
 * ESLint Plugin Slice Tests (Simplified)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createESLintSlice,
  createESLintActions,
  filterByDisabledRules,
  initialESLintState,
  isScanning,
  type ESLintSlice,
  type ESLintActions,
} from "./slice";
import type { Issue } from "../../ui/types";
import type { PluginServices } from "../../core/plugin-system/types";
import type { AvailableRule } from "./types";

// Mock services
function createMockServices(): PluginServices {
  return {
    websocket: {
      isConnected: true,
      url: "ws://localhost:9234",
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      on: vi.fn(() => () => {}),
      onConnectionChange: vi.fn(() => () => {}),
    },
    domObserver: {
      start: vi.fn(),
      stop: vi.fn(),
      onElementsAdded: vi.fn(() => () => {}),
      onElementsRemoved: vi.fn(() => () => {}),
    },
    getState: vi.fn(),
    setState: vi.fn(),
    openInspector: vi.fn(),
    closeCommandPalette: vi.fn(),
  };
}

// Create a mock Issue
function createMockIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "eslint:test-rule:test.tsx:10:5:10",
    message: "Test issue message",
    severity: "warning",
    dataLoc: "test.tsx:10:5",
    ruleId: "test-rule",
    pluginId: "eslint",
    filePath: "test.tsx",
    line: 10,
    column: 5,
    ...overrides,
  };
}

describe("initialESLintState", () => {
  it("has empty issues Map", () => {
    expect(initialESLintState.issues).toBeInstanceOf(Map);
    expect(initialESLintState.issues.size).toBe(0);
  });

  it("has empty scannedDataLocs Set", () => {
    expect(initialESLintState.scannedDataLocs).toBeInstanceOf(Set);
    expect(initialESLintState.scannedDataLocs.size).toBe(0);
  });

  it("has scanStatus scanning by default", () => {
    expect(initialESLintState.scanStatus).toBe("scanning");
  });

  it("has empty availableRules", () => {
    expect(initialESLintState.availableRules).toEqual([]);
  });

  it("has empty disabledRules Set", () => {
    expect(initialESLintState.disabledRules).toBeInstanceOf(Set);
    expect(initialESLintState.disabledRules.size).toBe(0);
  });

  it("has null workspaceRoot", () => {
    expect(initialESLintState.workspaceRoot).toBeNull();
  });

  it("has empty requestedFiles Set", () => {
    expect(initialESLintState.requestedFiles).toBeInstanceOf(Set);
    expect(initialESLintState.requestedFiles.size).toBe(0);
  });
});

describe("isScanning", () => {
  it("returns true for scanning status", () => {
    expect(isScanning("scanning")).toBe(true);
  });

  it("returns false for idle status", () => {
    expect(isScanning("idle")).toBe(false);
  });

  it("returns false for complete status", () => {
    expect(isScanning("complete")).toBe(false);
  });

  it("returns false for error status", () => {
    expect(isScanning("error")).toBe(false);
  });
});

describe("createESLintSlice", () => {
  it("returns initial state", () => {
    const services = createMockServices();
    const slice = createESLintSlice(services);

    expect(slice.issues.size).toBe(0);
    expect(slice.scanStatus).toBe("scanning");
  });
});

describe("createESLintActions", () => {
  let services: PluginServices;
  let slice: ESLintSlice;
  let setSlice: ReturnType<typeof vi.fn>;
  let actions: ESLintActions;

  beforeEach(() => {
    services = createMockServices();
    slice = createESLintSlice(services);
    setSlice = vi.fn((partial: Partial<ESLintSlice>) => {
      slice = { ...slice, ...partial };
    });
    actions = createESLintActions(services, () => slice, setSlice);
  });

  describe("startScanning", () => {
    it("sets scanStatus to scanning", () => {
      slice.scanStatus = "idle";
      actions.startScanning();

      expect(setSlice).toHaveBeenCalledWith({
        scanStatus: "scanning",
      });
    });
  });

  describe("stopScanning", () => {
    it("resets state to idle", () => {
      actions.stopScanning();

      expect(setSlice).toHaveBeenCalledWith({
        scanStatus: "idle",
        issues: expect.any(Map),
        scannedDataLocs: expect.any(Set),
        requestedFiles: expect.any(Set),
      });
    });
  });

  describe("setIssues", () => {
    it("adds issues for a dataLoc", () => {
      const issue = createMockIssue();
      actions.setIssues("test.tsx:10:5", [issue]);

      const call = setSlice.mock.calls[0][0] as Partial<ESLintSlice>;
      expect(call.issues?.get("test.tsx:10:5")).toEqual([issue]);
    });

    it("removes dataLoc when issues array is empty", () => {
      slice.issues.set("test.tsx:10:5", [createMockIssue()]);
      actions.setIssues("test.tsx:10:5", []);

      const call = setSlice.mock.calls[0][0] as Partial<ESLintSlice>;
      expect(call.issues?.has("test.tsx:10:5")).toBe(false);
    });

    it("preserves other issues when adding", () => {
      slice.issues.set("other.tsx:5:1", [createMockIssue({ id: "other" })]);
      actions.setIssues("test.tsx:10:5", [createMockIssue()]);

      const call = setSlice.mock.calls[0][0] as Partial<ESLintSlice>;
      expect(call.issues?.has("other.tsx:5:1")).toBe(true);
      expect(call.issues?.has("test.tsx:10:5")).toBe(true);
    });
  });

  describe("clearIssues", () => {
    it("clears all issues", () => {
      slice.issues.set("test.tsx:10:5", [createMockIssue()]);
      actions.clearIssues();

      const call = setSlice.mock.calls[0][0] as Partial<ESLintSlice>;
      expect(call.issues?.size).toBe(0);
    });

    it("clears scannedDataLocs", () => {
      slice.scannedDataLocs.add("test.tsx:10:5");
      actions.clearIssues();

      const call = setSlice.mock.calls[0][0] as Partial<ESLintSlice>;
      expect(call.scannedDataLocs?.size).toBe(0);
    });

    it("clears requestedFiles", () => {
      slice.requestedFiles.add("test.tsx");
      actions.clearIssues();

      const call = setSlice.mock.calls[0][0] as Partial<ESLintSlice>;
      expect(call.requestedFiles?.size).toBe(0);
    });
  });

  describe("toggleRule", () => {
    it("adds rule to disabledRules", () => {
      actions.toggleRule("test-rule");

      const call = setSlice.mock.calls[0][0] as Partial<ESLintSlice>;
      expect(call.disabledRules?.has("test-rule")).toBe(true);
    });

    it("removes rule from disabledRules if already present", () => {
      slice.disabledRules.add("test-rule");
      actions.toggleRule("test-rule");

      const call = setSlice.mock.calls[0][0] as Partial<ESLintSlice>;
      expect(call.disabledRules?.has("test-rule")).toBe(false);
    });
  });

  describe("setAvailableRules", () => {
    it("sets available rules", () => {
      const rules: AvailableRule[] = [{
        id: "test-rule",
        name: "Test Rule",
        description: "Test description",
        category: "static",
        defaultSeverity: "warn",
      }];
      actions.setAvailableRules(rules);

      expect(setSlice).toHaveBeenCalledWith({ availableRules: rules });
    });
  });

  describe("setWorkspaceRoot", () => {
    it("sets workspace root", () => {
      actions.setWorkspaceRoot("/home/user/project");

      expect(setSlice).toHaveBeenCalledWith({ workspaceRoot: "/home/user/project" });
    });

    it("clears workspace root with null", () => {
      actions.setWorkspaceRoot(null);

      expect(setSlice).toHaveBeenCalledWith({ workspaceRoot: null });
    });
  });

  describe("markScanned", () => {
    it("adds dataLoc to scannedDataLocs", () => {
      actions.markScanned("test.tsx:10:5");

      const call = setSlice.mock.calls[0][0] as Partial<ESLintSlice>;
      expect(call.scannedDataLocs?.has("test.tsx:10:5")).toBe(true);
    });
  });

  describe("markFileRequested", () => {
    it("adds filePath to requestedFiles", () => {
      actions.markFileRequested("test.tsx");

      const call = setSlice.mock.calls[0][0] as Partial<ESLintSlice>;
      expect(call.requestedFiles?.has("test.tsx")).toBe(true);
    });

    it("preserves existing requested files", () => {
      slice.requestedFiles.add("other.tsx");
      actions.markFileRequested("test.tsx");

      const call = setSlice.mock.calls[0][0] as Partial<ESLintSlice>;
      expect(call.requestedFiles?.has("other.tsx")).toBe(true);
      expect(call.requestedFiles?.has("test.tsx")).toBe(true);
    });
  });

  describe("setScanStatus", () => {
    it("sets scan status", () => {
      actions.setScanStatus("complete");

      expect(setSlice).toHaveBeenCalledWith({ scanStatus: "complete" });
    });
  });
});

describe("filterByDisabledRules", () => {
  it("returns all issues when disabledRules is empty", () => {
    const issues = [createMockIssue(), createMockIssue({ ruleId: "other-rule" })];
    const result = filterByDisabledRules(issues, new Set());

    expect(result).toEqual(issues);
  });

  it("filters out disabled rules", () => {
    const issues = [
      createMockIssue({ ruleId: "keep-rule" }),
      createMockIssue({ ruleId: "disabled-rule" }),
    ];
    const result = filterByDisabledRules(issues, new Set(["disabled-rule"]));

    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe("keep-rule");
  });

  it("filters multiple disabled rules", () => {
    const issues = [
      createMockIssue({ ruleId: "keep-rule" }),
      createMockIssue({ ruleId: "disabled-1" }),
      createMockIssue({ ruleId: "disabled-2" }),
    ];
    const result = filterByDisabledRules(issues, new Set(["disabled-1", "disabled-2"]));

    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe("keep-rule");
  });
});
