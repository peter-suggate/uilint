/**
 * WebSocket Message Handler Tests
 *
 * These tests verify that the ESLint plugin correctly processes WebSocket messages
 * and updates state. They specifically test scenarios that would NOT be caught by
 * slice-level unit tests, such as batching issues from multiple dataLocs.
 */

import { describe, expect, it, vi } from "vitest";
import { _handleWebSocketMessageForTesting as handleWebSocketMessage } from "./index";
import type { PluginServices } from "../../core/plugin-system/types";
import type { ESLintPluginSlice } from "./slice";
import type { Issue } from "../../ui/types";

/**
 * Creates a mock PluginServices with tracking for state mutations.
 *
 * This mock captures all setState calls so we can verify:
 * 1. How many times setState was called (batching behavior)
 * 2. What the final state looks like after processing
 */
function createMockServices(initialState: Partial<ESLintPluginSlice> = {}) {
  const state: ESLintPluginSlice = {
    issues: new Map(),
    scannedDataLocs: new Set(),
    scanStatus: "scanning",
    availableRules: [],
    disabledRules: new Set(),
    workspaceRoot: null,
    requestedFiles: new Set(),
    ruleConfigs: new Map(),
    ruleConfigUpdating: new Map(),
    workspaceCapabilities: null,
    ...initialState,
  } as ESLintPluginSlice;

  const setStateCalls: Array<Partial<ESLintPluginSlice>> = [];

  const services: PluginServices = {
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
    getState: vi.fn(() => state),
    setState: vi.fn((partial: Partial<ESLintPluginSlice>) => {
      setStateCalls.push(partial);
      // Apply the state update
      Object.assign(state, partial);
    }),
    openInspector: vi.fn(),
    closeCommandPalette: vi.fn(),
  };

  return { services, state, setStateCalls };
}

/**
 * Creates a raw ESLint issue as it would come from the WebSocket server
 */
function createRawIssue(overrides: {
  ruleId?: string;
  message?: string;
  severity?: number;
  line?: number;
  column?: number;
  dataLoc?: string;
} = {}) {
  return {
    ruleId: overrides.ruleId ?? "test-rule",
    message: overrides.message ?? "Test issue message",
    severity: overrides.severity ?? 1,
    line: overrides.line ?? 10,
    column: overrides.column ?? 5,
    dataLoc: overrides.dataLoc,
  };
}

describe("handleWebSocketMessage - lint:result", () => {
  /**
   * CRITICAL TEST: This test catches the bug where setState was called in a loop.
   *
   * When a single lint:result message contains issues at multiple dataLocs,
   * all dataLocs must be preserved in the final state. The previous buggy
   * implementation called setState() for each dataLoc separately, which caused
   * each call to overwrite the previous one (since getState() returned the
   * same stale reference each time).
   *
   * This test would FAIL with the buggy code because only the last dataLoc
   * would be preserved.
   */
  it("preserves all dataLocs when a single message contains issues at multiple locations", () => {
    const { services, state, setStateCalls } = createMockServices();

    // Simulate a lint:result with issues at THREE different dataLocs
    const message = {
      type: "lint:result" as const,
      filePath: "src/components/Button.tsx",
      issues: [
        createRawIssue({
          ruleId: "no-unused-vars",
          line: 10,
          column: 5,
          dataLoc: "src/components/Button.tsx:10:5",
        }),
        createRawIssue({
          ruleId: "no-console",
          line: 25,
          column: 3,
          dataLoc: "src/components/Button.tsx:25:3",
        }),
        createRawIssue({
          ruleId: "prefer-const",
          line: 42,
          column: 7,
          dataLoc: "src/components/Button.tsx:42:7",
        }),
      ],
    };

    handleWebSocketMessage(services, message);

    // CRITICAL: setState should be called exactly ONCE with all issues batched
    expect(setStateCalls).toHaveLength(1);

    // All three dataLocs must be present in the final state
    expect(state.issues.size).toBe(3);
    expect(state.issues.has("src/components/Button.tsx:10:5")).toBe(true);
    expect(state.issues.has("src/components/Button.tsx:25:3")).toBe(true);
    expect(state.issues.has("src/components/Button.tsx:42:7")).toBe(true);
  });

  /**
   * This test verifies that issues from multiple lint:result messages are
   * properly merged (issues from different files should coexist).
   */
  it("merges issues from multiple files without losing previous data", () => {
    const { services, state } = createMockServices();

    // First message: issues in file A
    handleWebSocketMessage(services, {
      type: "lint:result",
      filePath: "src/components/Button.tsx",
      issues: [
        createRawIssue({
          ruleId: "no-unused-vars",
          dataLoc: "src/components/Button.tsx:10:5",
        }),
      ],
    });

    // Second message: issues in file B
    handleWebSocketMessage(services, {
      type: "lint:result",
      filePath: "src/components/Input.tsx",
      issues: [
        createRawIssue({
          ruleId: "no-console",
          dataLoc: "src/components/Input.tsx:20:3",
        }),
      ],
    });

    // Both files' issues should be present
    expect(state.issues.size).toBe(2);
    expect(state.issues.has("src/components/Button.tsx:10:5")).toBe(true);
    expect(state.issues.has("src/components/Input.tsx:20:3")).toBe(true);
  });

  /**
   * This test verifies that multiple issues at the same dataLoc are grouped together.
   */
  it("groups multiple issues at the same dataLoc", () => {
    const { services, state } = createMockServices();

    // Two issues at the same location (same element has multiple problems)
    const message = {
      type: "lint:result" as const,
      filePath: "src/components/Button.tsx",
      issues: [
        createRawIssue({
          ruleId: "no-unused-vars",
          message: "Unused variable 'x'",
          line: 10,
          column: 5,
          dataLoc: "src/components/Button.tsx:10:5",
        }),
        createRawIssue({
          ruleId: "prefer-const",
          message: "Use const instead of let",
          line: 10,
          column: 5,
          dataLoc: "src/components/Button.tsx:10:5",
        }),
      ],
    };

    handleWebSocketMessage(services, message);

    // Should have one dataLoc entry with two issues
    expect(state.issues.size).toBe(1);
    const issues = state.issues.get("src/components/Button.tsx:10:5");
    expect(issues).toHaveLength(2);
    expect(issues?.map((i) => i.ruleId)).toContain("no-unused-vars");
    expect(issues?.map((i) => i.ruleId)).toContain("prefer-const");
  });

  /**
   * Edge case: empty issues array should not cause problems
   */
  it("handles empty issues array gracefully", () => {
    const { services, state, setStateCalls } = createMockServices();

    handleWebSocketMessage(services, {
      type: "lint:result",
      filePath: "src/components/Button.tsx",
      issues: [],
    });

    // Should still call setState once (with empty map)
    expect(setStateCalls).toHaveLength(1);
    expect(state.issues.size).toBe(0);
  });

  /**
   * Verifies that issues without explicit dataLoc get a generated one
   */
  it("generates dataLoc from filePath:line:column when not provided", () => {
    const { services, state } = createMockServices();

    handleWebSocketMessage(services, {
      type: "lint:result",
      filePath: "src/components/Button.tsx",
      issues: [
        createRawIssue({
          ruleId: "no-console",
          line: 15,
          column: 8,
          dataLoc: undefined, // No explicit dataLoc
        }),
      ],
    });

    // Should generate dataLoc as filePath:line:column
    expect(state.issues.has("src/components/Button.tsx:15:8")).toBe(true);
  });
});

describe("handleWebSocketMessage - workspace:capabilities", () => {
  /**
   * Tests that workspace capabilities (including hook availability) are
   * stored correctly when received from the server. This enables the
   * fix-prompt plugin to determine whether to show condensed or detailed prompts.
   */
  it("stores workspace capabilities with Claude hook enabled", () => {
    const { services, state, setStateCalls } = createMockServices();

    handleWebSocketMessage(services, {
      type: "workspace:capabilities",
      postToolUseHook: {
        enabled: true,
        provider: "claude",
      },
    });

    expect(setStateCalls).toHaveLength(1);
    expect(state.workspaceCapabilities).toEqual({
      postToolUseHook: {
        enabled: true,
        provider: "claude",
      },
    });
  });

  it("stores workspace capabilities with hook disabled", () => {
    const { services, state } = createMockServices();

    handleWebSocketMessage(services, {
      type: "workspace:capabilities",
      postToolUseHook: {
        enabled: false,
        provider: null,
      },
    });

    expect(state.workspaceCapabilities).toEqual({
      postToolUseHook: {
        enabled: false,
        provider: null,
      },
    });
  });

  it("stores workspace capabilities with Cursor provider", () => {
    const { services, state } = createMockServices();

    handleWebSocketMessage(services, {
      type: "workspace:capabilities",
      postToolUseHook: {
        enabled: true,
        provider: "cursor",
      },
    });

    expect(state.workspaceCapabilities?.postToolUseHook.provider).toBe("cursor");
    expect(state.workspaceCapabilities?.postToolUseHook.enabled).toBe(true);
  });
});

describe("handleWebSocketMessage - file:changed", () => {
  /**
   * When a file changes, all issues from that file should be cleared
   * so they can be re-linted.
   */
  it("clears all issues for the changed file only", () => {
    // Start with issues from two files
    const initialIssues = new Map<string, Issue[]>();
    initialIssues.set("src/Button.tsx:10:5", [
      {
        id: "eslint:no-console:src/Button.tsx:10:5:10",
        message: "Unexpected console statement",
        severity: "warning",
        dataLoc: "src/Button.tsx:10:5",
        ruleId: "no-console",
        pluginId: "eslint",
        filePath: "src/Button.tsx",
        line: 10,
        column: 5,
      },
    ]);
    initialIssues.set("src/Input.tsx:20:3", [
      {
        id: "eslint:no-unused-vars:src/Input.tsx:20:3:20",
        message: "Unused variable",
        severity: "warning",
        dataLoc: "src/Input.tsx:20:3",
        ruleId: "no-unused-vars",
        pluginId: "eslint",
        filePath: "src/Input.tsx",
        line: 20,
        column: 3,
      },
    ]);

    const { services, state } = createMockServices({
      issues: initialIssues,
      requestedFiles: new Set(["src/Button.tsx", "src/Input.tsx"]),
    });

    // File changed event for Button.tsx
    handleWebSocketMessage(services, {
      type: "file:changed",
      filePath: "src/Button.tsx",
    });

    // Button.tsx issues should be cleared, Input.tsx issues should remain
    expect(state.issues.has("src/Button.tsx:10:5")).toBe(false);
    expect(state.issues.has("src/Input.tsx:20:3")).toBe(true);

    // Button.tsx should be removed from requestedFiles so it can be re-requested
    expect(state.requestedFiles.has("src/Button.tsx")).toBe(false);
    expect(state.requestedFiles.has("src/Input.tsx")).toBe(true);
  });
});
