/**
 * Tests for the Semantic Plugin
 *
 * Tests for slice state management, commands structure, and plugin exports.
 */

import { describe, expect, it } from "vitest";
import {
  createSemanticPluginSlice,
  initialSemanticPluginState,
  type SemanticPluginSlice,
} from "./slice";
import { semanticCommands } from "./commands";
import { semanticPlugin } from "./index";
import type {
  DuplicatesIndexingProgressMessage,
  DuplicatesIndexingCompleteMessage,
  DuplicatesIndexingErrorMessage,
} from "./types";

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock slice for testing actions
 */
function createMockSlice(): {
  slice: SemanticPluginSlice;
  getState: () => SemanticPluginSlice;
} {
  let state = { ...initialSemanticPluginState };

  const set = <T>(partial: Partial<T>) => {
    state = { ...state, ...partial };
  };

  const get = () => state;

  const slice = createSemanticPluginSlice(set, get);

  // Update the slice reference to use the current state
  const getState = () => ({
    ...state,
    ...slice,
  });

  return { slice, getState };
}

// ============================================================================
// Initial State Tests
// ============================================================================

describe("initialSemanticPluginState", () => {
  it("has correct default duplicatesIndexStatus", () => {
    expect(initialSemanticPluginState.duplicatesIndexStatus).toBe("idle");
  });

  it("has null duplicatesIndexMessage by default", () => {
    expect(initialSemanticPluginState.duplicatesIndexMessage).toBeNull();
  });

  it("has null duplicatesIndexProgress by default", () => {
    expect(initialSemanticPluginState.duplicatesIndexProgress).toBeNull();
  });

  it("has null duplicatesIndexError by default", () => {
    expect(initialSemanticPluginState.duplicatesIndexError).toBeNull();
  });

  it("has null duplicatesIndexStats by default", () => {
    expect(initialSemanticPluginState.duplicatesIndexStats).toBeNull();
  });

  it("has all expected state properties", () => {
    const expectedKeys = [
      "duplicatesIndexStatus",
      "duplicatesIndexMessage",
      "duplicatesIndexProgress",
      "duplicatesIndexError",
      "duplicatesIndexStats",
    ];

    expect(Object.keys(initialSemanticPluginState)).toEqual(
      expect.arrayContaining(expectedKeys)
    );
    expect(Object.keys(initialSemanticPluginState)).toHaveLength(
      expectedKeys.length
    );
  });
});

// ============================================================================
// State Actions Tests
// ============================================================================

describe("createSemanticPluginSlice", () => {
  describe("setDuplicatesIndexStatus", () => {
    it("updates status to indexing", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexStatus("indexing");

      expect(getState().duplicatesIndexStatus).toBe("indexing");
    });

    it("updates status to ready", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexStatus("ready");

      expect(getState().duplicatesIndexStatus).toBe("ready");
    });

    it("updates status to error", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexStatus("error");

      expect(getState().duplicatesIndexStatus).toBe("error");
    });
  });

  describe("setDuplicatesIndexMessage", () => {
    it("sets a message string", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexMessage("Processing files...");

      expect(getState().duplicatesIndexMessage).toBe("Processing files...");
    });

    it("clears message with null", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexMessage("Some message");
      slice.setDuplicatesIndexMessage(null);

      expect(getState().duplicatesIndexMessage).toBeNull();
    });
  });

  describe("setDuplicatesIndexProgress", () => {
    it("sets progress with current and total", () => {
      const { slice, getState } = createMockSlice();
      const progress = { current: 50, total: 100 };

      slice.setDuplicatesIndexProgress(progress);

      expect(getState().duplicatesIndexProgress).toEqual(progress);
    });

    it("clears progress with null", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexProgress({ current: 10, total: 20 });
      slice.setDuplicatesIndexProgress(null);

      expect(getState().duplicatesIndexProgress).toBeNull();
    });
  });

  describe("setDuplicatesIndexError", () => {
    it("sets an error message", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexError("Connection failed");

      expect(getState().duplicatesIndexError).toBe("Connection failed");
    });

    it("clears error with null", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexError("Some error");
      slice.setDuplicatesIndexError(null);

      expect(getState().duplicatesIndexError).toBeNull();
    });
  });

  describe("setDuplicatesIndexStats", () => {
    it("sets stats object", () => {
      const { slice, getState } = createMockSlice();
      const stats = {
        totalChunks: 500,
        added: 100,
        modified: 50,
        deleted: 25,
        duration: 1500,
      };

      slice.setDuplicatesIndexStats(stats);

      expect(getState().duplicatesIndexStats).toEqual(stats);
    });

    it("clears stats with null", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexStats({
        totalChunks: 100,
        added: 10,
        modified: 5,
        deleted: 2,
        duration: 500,
      });
      slice.setDuplicatesIndexStats(null);

      expect(getState().duplicatesIndexStats).toBeNull();
    });
  });

  describe("handleDuplicatesIndexingStart", () => {
    it("sets status to indexing", () => {
      const { slice, getState } = createMockSlice();

      slice.handleDuplicatesIndexingStart();

      expect(getState().duplicatesIndexStatus).toBe("indexing");
    });

    it("sets initial message", () => {
      const { slice, getState } = createMockSlice();

      slice.handleDuplicatesIndexingStart();

      expect(getState().duplicatesIndexMessage).toBe("Starting index...");
    });

    it("clears progress", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexProgress({ current: 50, total: 100 });
      slice.handleDuplicatesIndexingStart();

      expect(getState().duplicatesIndexProgress).toBeNull();
    });

    it("clears any previous error", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexError("Previous error");
      slice.handleDuplicatesIndexingStart();

      expect(getState().duplicatesIndexError).toBeNull();
    });
  });

  describe("handleDuplicatesIndexingProgress", () => {
    it("updates message and progress with full data", () => {
      const { slice, getState } = createMockSlice();
      const progressData: DuplicatesIndexingProgressMessage = {
        type: "duplicates:indexing:progress",
        message: "Processing file 50 of 100",
        current: 50,
        total: 100,
      };

      slice.handleDuplicatesIndexingProgress(progressData);

      expect(getState().duplicatesIndexStatus).toBe("indexing");
      expect(getState().duplicatesIndexMessage).toBe(
        "Processing file 50 of 100"
      );
      expect(getState().duplicatesIndexProgress).toEqual({
        current: 50,
        total: 100,
      });
    });

    it("sets progress to null when current/total not provided", () => {
      const { slice, getState } = createMockSlice();
      const progressData: DuplicatesIndexingProgressMessage = {
        type: "duplicates:indexing:progress",
        message: "Initializing...",
      };

      slice.handleDuplicatesIndexingProgress(progressData);

      expect(getState().duplicatesIndexMessage).toBe("Initializing...");
      expect(getState().duplicatesIndexProgress).toBeNull();
    });

    it("maintains indexing status", () => {
      const { slice, getState } = createMockSlice();

      slice.handleDuplicatesIndexingProgress({
        type: "duplicates:indexing:progress",
        message: "Working...",
        current: 25,
        total: 50,
      });

      expect(getState().duplicatesIndexStatus).toBe("indexing");
    });
  });

  describe("handleDuplicatesIndexingComplete", () => {
    it("sets status to ready", () => {
      const { slice, getState } = createMockSlice();
      const completeData: DuplicatesIndexingCompleteMessage = {
        type: "duplicates:indexing:complete",
        added: 100,
        modified: 50,
        deleted: 25,
        totalChunks: 500,
        duration: 1500,
      };

      slice.handleDuplicatesIndexingComplete(completeData);

      expect(getState().duplicatesIndexStatus).toBe("ready");
    });

    it("clears message", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexMessage("Processing...");
      slice.handleDuplicatesIndexingComplete({
        type: "duplicates:indexing:complete",
        added: 10,
        modified: 5,
        deleted: 2,
        totalChunks: 100,
        duration: 500,
      });

      expect(getState().duplicatesIndexMessage).toBeNull();
    });

    it("clears progress", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexProgress({ current: 99, total: 100 });
      slice.handleDuplicatesIndexingComplete({
        type: "duplicates:indexing:complete",
        added: 10,
        modified: 5,
        deleted: 2,
        totalChunks: 100,
        duration: 500,
      });

      expect(getState().duplicatesIndexProgress).toBeNull();
    });

    it("sets stats from completion data", () => {
      const { slice, getState } = createMockSlice();
      const completeData: DuplicatesIndexingCompleteMessage = {
        type: "duplicates:indexing:complete",
        added: 100,
        modified: 50,
        deleted: 25,
        totalChunks: 500,
        duration: 1500,
      };

      slice.handleDuplicatesIndexingComplete(completeData);

      expect(getState().duplicatesIndexStats).toEqual({
        totalChunks: 500,
        added: 100,
        modified: 50,
        deleted: 25,
        duration: 1500,
      });
    });
  });

  describe("handleDuplicatesIndexingError", () => {
    it("sets status to error", () => {
      const { slice, getState } = createMockSlice();
      const errorData: DuplicatesIndexingErrorMessage = {
        type: "duplicates:indexing:error",
        error: "Failed to connect to server",
      };

      slice.handleDuplicatesIndexingError(errorData);

      expect(getState().duplicatesIndexStatus).toBe("error");
    });

    it("sets error message", () => {
      const { slice, getState } = createMockSlice();

      slice.handleDuplicatesIndexingError({
        type: "duplicates:indexing:error",
        error: "Network timeout",
      });

      expect(getState().duplicatesIndexError).toBe("Network timeout");
    });

    it("clears message and progress", () => {
      const { slice, getState } = createMockSlice();

      slice.setDuplicatesIndexMessage("Processing...");
      slice.setDuplicatesIndexProgress({ current: 50, total: 100 });
      slice.handleDuplicatesIndexingError({
        type: "duplicates:indexing:error",
        error: "Error occurred",
      });

      expect(getState().duplicatesIndexMessage).toBeNull();
      expect(getState().duplicatesIndexProgress).toBeNull();
    });
  });

  describe("resetDuplicatesIndexState", () => {
    it("resets all state to initial values", () => {
      const { slice, getState } = createMockSlice();

      // Set various state values
      slice.setDuplicatesIndexStatus("ready");
      slice.setDuplicatesIndexMessage("Some message");
      slice.setDuplicatesIndexProgress({ current: 50, total: 100 });
      slice.setDuplicatesIndexError("Some error");
      slice.setDuplicatesIndexStats({
        totalChunks: 500,
        added: 100,
        modified: 50,
        deleted: 25,
        duration: 1500,
      });

      // Reset
      slice.resetDuplicatesIndexState();

      // Verify all reset
      expect(getState().duplicatesIndexStatus).toBe("idle");
      expect(getState().duplicatesIndexMessage).toBeNull();
      expect(getState().duplicatesIndexProgress).toBeNull();
      expect(getState().duplicatesIndexError).toBeNull();
      expect(getState().duplicatesIndexStats).toBeNull();
    });

    it("can be called multiple times safely", () => {
      const { slice, getState } = createMockSlice();

      slice.resetDuplicatesIndexState();
      slice.resetDuplicatesIndexState();
      slice.resetDuplicatesIndexState();

      expect(getState().duplicatesIndexStatus).toBe("idle");
    });
  });
});

// ============================================================================
// Command Structure Tests
// ============================================================================

describe("semanticCommands", () => {
  it("exports an array of commands", () => {
    expect(Array.isArray(semanticCommands)).toBe(true);
    expect(semanticCommands.length).toBeGreaterThan(0);
  });

  it("contains exactly 5 commands", () => {
    expect(semanticCommands).toHaveLength(5);
  });

  describe("command structure validation", () => {
    it("all commands have required id field", () => {
      for (const command of semanticCommands) {
        expect(command.id).toBeDefined();
        expect(typeof command.id).toBe("string");
        expect(command.id.length).toBeGreaterThan(0);
      }
    });

    it("all commands have required title field", () => {
      for (const command of semanticCommands) {
        expect(command.title).toBeDefined();
        expect(typeof command.title).toBe("string");
        expect(command.title.length).toBeGreaterThan(0);
      }
    });

    it("all commands have required keywords array", () => {
      for (const command of semanticCommands) {
        expect(command.keywords).toBeDefined();
        expect(Array.isArray(command.keywords)).toBe(true);
        expect(command.keywords.length).toBeGreaterThan(0);
      }
    });

    it("all commands have required category field", () => {
      for (const command of semanticCommands) {
        expect(command.category).toBeDefined();
        expect(typeof command.category).toBe("string");
      }
    });

    it("all commands have required execute function", () => {
      for (const command of semanticCommands) {
        expect(command.execute).toBeDefined();
        expect(typeof command.execute).toBe("function");
      }
    });
  });

  describe("command ID convention", () => {
    it("all command IDs follow semantic:* convention", () => {
      for (const command of semanticCommands) {
        expect(command.id).toMatch(/^semantic:/);
      }
    });

    it("all command IDs are unique", () => {
      const ids = semanticCommands.map((c) => c.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("specific commands exist", () => {
    it("has semantic:run-analysis command", () => {
      const command = semanticCommands.find(
        (c) => c.id === "semantic:run-analysis"
      );

      expect(command).toBeDefined();
      expect(command?.title).toBe("Run Semantic Analysis");
    });

    it("has semantic:rebuild-duplicates-index command", () => {
      const command = semanticCommands.find(
        (c) => c.id === "semantic:rebuild-duplicates-index"
      );

      expect(command).toBeDefined();
      expect(command?.title).toBe("Rebuild Duplicates Index");
    });

    it("has semantic:show-duplicates-status command", () => {
      const command = semanticCommands.find(
        (c) => c.id === "semantic:show-duplicates-status"
      );

      expect(command).toBeDefined();
      expect(command?.title).toBe("Show Duplicates Index Status");
    });

    it("has semantic:find-similar command", () => {
      const command = semanticCommands.find(
        (c) => c.id === "semantic:find-similar"
      );

      expect(command).toBeDefined();
      expect(command?.title).toBe("Find Similar Code");
    });

    it("has semantic:clear-cache command", () => {
      const command = semanticCommands.find(
        (c) => c.id === "semantic:clear-cache"
      );

      expect(command).toBeDefined();
      expect(command?.title).toBe("Clear Semantic Cache");
    });
  });

  describe("find-similar command availability", () => {
    it("has isAvailable predicate", () => {
      const command = semanticCommands.find(
        (c) => c.id === "semantic:find-similar"
      );

      expect(command?.isAvailable).toBeDefined();
      expect(typeof command?.isAvailable).toBe("function");
    });

    it("isAvailable returns true when duplicatesIndexStatus is ready", () => {
      const command = semanticCommands.find(
        (c) => c.id === "semantic:find-similar"
      );

      const result = command?.isAvailable?.({ duplicatesIndexStatus: "ready" });

      expect(result).toBe(true);
    });

    it("isAvailable returns false when duplicatesIndexStatus is idle", () => {
      const command = semanticCommands.find(
        (c) => c.id === "semantic:find-similar"
      );

      const result = command?.isAvailable?.({ duplicatesIndexStatus: "idle" });

      expect(result).toBe(false);
    });

    it("isAvailable returns false when duplicatesIndexStatus is indexing", () => {
      const command = semanticCommands.find(
        (c) => c.id === "semantic:find-similar"
      );

      const result = command?.isAvailable?.({
        duplicatesIndexStatus: "indexing",
      });

      expect(result).toBe(false);
    });

    it("isAvailable returns false when duplicatesIndexStatus is error", () => {
      const command = semanticCommands.find(
        (c) => c.id === "semantic:find-similar"
      );

      const result = command?.isAvailable?.({ duplicatesIndexStatus: "error" });

      expect(result).toBe(false);
    });
  });

  describe("all commands are in semantic category", () => {
    it("all commands have category set to semantic", () => {
      for (const command of semanticCommands) {
        expect(command.category).toBe("semantic");
      }
    });
  });
});

// ============================================================================
// Plugin Exports Tests
// ============================================================================

describe("semanticPlugin", () => {
  describe("plugin metadata", () => {
    it("has correct id", () => {
      expect(semanticPlugin.id).toBe("semantic");
    });

    it("has correct name", () => {
      expect(semanticPlugin.name).toBe("Semantic Analysis");
    });

    it("has correct version", () => {
      expect(semanticPlugin.version).toBe("1.0.0");
    });

    it("has description", () => {
      expect(semanticPlugin.description).toBeDefined();
      expect(typeof semanticPlugin.description).toBe("string");
      expect(semanticPlugin.description!.length).toBeGreaterThan(0);
    });
  });

  describe("rule categories", () => {
    it("declares semantic rule category", () => {
      expect(semanticPlugin.ruleCategories).toBeDefined();
      expect(semanticPlugin.ruleCategories).toContain("semantic");
    });
  });

  describe("commands", () => {
    it("exports semanticCommands array", () => {
      expect(semanticPlugin.commands).toBeDefined();
      expect(semanticPlugin.commands).toBe(semanticCommands);
    });
  });

  describe("inspector panels", () => {
    it("has empty inspectorPanels array", () => {
      expect(semanticPlugin.inspectorPanels).toBeDefined();
      expect(Array.isArray(semanticPlugin.inspectorPanels)).toBe(true);
      expect(semanticPlugin.inspectorPanels).toHaveLength(0);
    });
  });

  describe("rule contributions", () => {
    it("has rule contributions defined", () => {
      expect(semanticPlugin.ruleContributions).toBeDefined();
      expect(Array.isArray(semanticPlugin.ruleContributions)).toBe(true);
    });

    it("has contribution for semantic rule", () => {
      const semanticContrib = semanticPlugin.ruleContributions?.find(
        (c) => c.ruleId === "semantic"
      );

      expect(semanticContrib).toBeDefined();
      expect(semanticContrib?.heatmapColor).toBe("#8b5cf6");
    });

    it("has contribution for no-semantic-duplicates rule", () => {
      const duplicatesContrib = semanticPlugin.ruleContributions?.find(
        (c) => c.ruleId === "no-semantic-duplicates"
      );

      expect(duplicatesContrib).toBeDefined();
      expect(duplicatesContrib?.heatmapColor).toBe("#f59e0b");
    });
  });

  describe("handlesRules predicate", () => {
    it("is defined as a function", () => {
      expect(semanticPlugin.handlesRules).toBeDefined();
      expect(typeof semanticPlugin.handlesRules).toBe("function");
    });

    it("returns true for semantic category rules", () => {
      const result = semanticPlugin.handlesRules?.({
        id: "some-rule",
        category: "semantic",
      });

      expect(result).toBe(true);
    });

    it("returns true for uilint/semantic rule id", () => {
      const result = semanticPlugin.handlesRules?.({
        id: "uilint/semantic",
      });

      expect(result).toBe(true);
    });

    it("returns true for uilint/no-semantic-duplicates rule id", () => {
      const result = semanticPlugin.handlesRules?.({
        id: "uilint/no-semantic-duplicates",
      });

      expect(result).toBe(true);
    });

    it("returns true for semantic rule id (without prefix)", () => {
      const result = semanticPlugin.handlesRules?.({
        id: "semantic",
      });

      expect(result).toBe(true);
    });

    it("returns true for no-semantic-duplicates rule id (without prefix)", () => {
      const result = semanticPlugin.handlesRules?.({
        id: "no-semantic-duplicates",
      });

      expect(result).toBe(true);
    });

    it("returns false for non-semantic rules", () => {
      const result = semanticPlugin.handlesRules?.({
        id: "eslint/no-unused-vars",
        category: "static",
      });

      expect(result).toBe(false);
    });

    it("returns false for unrelated rule ids", () => {
      const result = semanticPlugin.handlesRules?.({
        id: "some-other-rule",
      });

      expect(result).toBe(false);
    });
  });

  describe("createSlice", () => {
    it("is defined as a function", () => {
      expect(semanticPlugin.createSlice).toBeDefined();
      expect(typeof semanticPlugin.createSlice).toBe("function");
    });
  });

  describe("initialize", () => {
    it("is defined as a function", () => {
      expect(semanticPlugin.initialize).toBeDefined();
      expect(typeof semanticPlugin.initialize).toBe("function");
    });
  });
});
