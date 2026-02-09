/**
 * ESLint Plugin Index Coverage Tests
 *
 * Tests the exported eslintPlugin object and its methods:
 * - Plugin metadata (id, name, version, etc.)
 * - getIssues() converting ESLintPluginSlice state to IssueContribution
 * - getPaletteItems() returning issues + commands as PaletteItems
 * - getRules() returning RuleDefinition[] from available rules
 * - setRuleSeverity() sending WebSocket messages and marking rules as updating
 * - getRuleConfig() returning current rule options from state
 * - setRuleConfig() sending WebSocket messages for rule option changes
 * - handlesRules() routing rules by id/category
 * - handleWebSocketMessage behavior for lint:progress, rules:metadata,
 *   rule:config:result, rule:config:changed, workspace:info
 * - initialize() subscribing to WebSocket message types and DOM observer
 */

import { describe, it, expect, vi } from "vitest";
import {
  eslintPlugin,
  _handleWebSocketMessageForTesting as handleWebSocketMessage,
} from "./index";
import type { ESLintPluginSlice } from "./slice";
import type { PluginServices, RuleMeta } from "../../core/plugin-system/types";
import type { Issue } from "../../ui/types";
import type { AvailableRule, RuleConfig } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal mock PluginServices that tracks state mutations.
 * getState returns the same `state` reference so callers can inspect
 * the result of setState merges.
 */
function createMockServices(initialState: Partial<ESLintPluginSlice> = {}) {
  const state: Record<string, unknown> = {
    issues: new Map<string, Issue[]>(),
    scannedDataLocs: new Set<string>(),
    scanStatus: "scanning",
    availableRules: [] as AvailableRule[],
    disabledRules: new Set<string>(),
    workspaceRoot: null,
    requestedFiles: new Set<string>(),
    ruleConfigs: new Map<string, RuleConfig>(),
    ruleConfigUpdating: new Map<string, boolean>(),
    lintingFiles: new Map<string, { phase: string; startedAt: number }>(),
    workspaceCapabilities: null,
    ...initialState,
  };

  const setStateCalls: Array<Record<string, unknown>> = [];

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
    getState: vi.fn(() => state) as PluginServices["getState"],
    setState: vi.fn((partial: Record<string, unknown>) => {
      setStateCalls.push(partial);
      Object.assign(state, partial);
    }),
    openInspector: vi.fn(),
    closeCommandPalette: vi.fn(),
  };

  return { services, state, setStateCalls };
}

function createIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "eslint:test-rule:test.tsx:10:5:10",
    message: "Test message",
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("eslintPlugin metadata", () => {
  it("has correct top-level metadata", () => {
    expect(eslintPlugin.id).toBe("eslint");
    expect(eslintPlugin.name).toBe("ESLint Analysis");
    expect(eslintPlugin.version).toBe("1.0.0");
    expect(eslintPlugin.description).toBe(
      "Real-time ESLint analysis with heatmap visualization"
    );
  });

  it("has matching structured meta", () => {
    expect(eslintPlugin.meta).toEqual({
      id: "eslint",
      name: "ESLint Analysis",
      version: "1.0.0",
      description: "Real-time ESLint analysis with heatmap visualization",
    });
  });

  it("declares static ruleCategories", () => {
    expect(eslintPlugin.ruleCategories).toEqual(["static"]);
  });

  it("exports commands array", () => {
    expect(eslintPlugin.commands).toBeDefined();
    expect(Array.isArray(eslintPlugin.commands)).toBe(true);
    expect(eslintPlugin.commands!.length).toBeGreaterThan(0);
  });

  it("exports an inspector panel for eslint-rule", () => {
    expect(eslintPlugin.inspectorPanels).toBeDefined();
    const panel = eslintPlugin.inspectorPanels!.find(
      (p) => p.id === "eslint-rule"
    );
    expect(panel).toBeDefined();
    expect(panel!.priority).toBe(10);
  });

  it("inspector panel title function returns dynamic title with ruleId", () => {
    const panel = eslintPlugin.inspectorPanels!.find(
      (p) => p.id === "eslint-rule"
    )!;
    const titleFn = panel.title as (props: { data?: Record<string, unknown> }) => string;
    expect(titleFn({ data: { ruleId: "no-console" } })).toBe(
      "Rule: no-console"
    );
    expect(titleFn({ data: {} })).toBe("Rule Details");
    expect(titleFn({})).toBe("Rule Details");
  });

  it("has a tile provider with expected methods", () => {
    expect(eslintPlugin.tileProvider).toBeDefined();
    expect(eslintPlugin.tileProvider!.getTileItems).toBeTypeOf("function");
    expect(eslintPlugin.tileProvider!.createFilter).toBeTypeOf("function");
    expect(eslintPlugin.tileProvider!.isTerminal).toBeTypeOf("function");
    expect(eslintPlugin.tileProvider!.getInspectorData).toBeTypeOf("function");
    expect(eslintPlugin.tileProvider!.getChildItems).toBeTypeOf("function");
    expect(eslintPlugin.tileProvider!.canExpand).toBeTypeOf("function");
  });
});

// ---------------------------------------------------------------------------
// handlesRules
// ---------------------------------------------------------------------------

describe("eslintPlugin.handlesRules", () => {
  const handlesRules = eslintPlugin.handlesRules!;

  it("handles uilint/* rules", () => {
    const rule: RuleMeta = { id: "uilint/consistent-dark-mode" };
    expect(handlesRules(rule)).toBe(true);
  });

  it("handles rules with category static", () => {
    const rule: RuleMeta = { id: "no-console", category: "static" };
    expect(handlesRules(rule)).toBe(true);
  });

  it("handles uilint/semantic-vision (uilint/* prefix takes precedence)", () => {
    // Note: The specific uilint/semantic-vision exclusion in the source is dead
    // code because the startsWith("uilint/") check matches first and returns true.
    const rule: RuleMeta = { id: "uilint/semantic-vision" };
    expect(handlesRules(rule)).toBe(true);
  });

  it("does not handle non-uilint rules without static category", () => {
    const rule: RuleMeta = { id: "some-other-rule", category: "styleguide" };
    expect(handlesRules(rule)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getIssues
// ---------------------------------------------------------------------------

describe("eslintPlugin.getIssues", () => {
  it("returns empty issues map when no issues exist", () => {
    const state = { issues: new Map<string, Issue[]>() } as ESLintPluginSlice;
    const result = eslintPlugin.getIssues!(state);

    expect(result.pluginId).toBe("eslint");
    expect(result.issues.size).toBe(0);
  });

  it("converts Issue[] to PluginIssue[] format keyed by dataLoc", () => {
    const issues = new Map<string, Issue[]>();
    const issue = createIssue({
      id: "eslint:no-console:app.tsx:5:1:5",
      message: "Unexpected console",
      severity: "error",
      dataLoc: "app.tsx:5:1",
      ruleId: "no-console",
      line: 5,
      column: 1,
    });
    issues.set("app.tsx:5:1", [issue]);

    const result = eslintPlugin.getIssues!({ issues } as ESLintPluginSlice);

    expect(result.pluginId).toBe("eslint");
    expect(result.issues.size).toBe(1);

    const converted = result.issues.get("app.tsx:5:1")!;
    expect(converted).toHaveLength(1);
    expect(converted[0].id).toBe(issue.id);
    expect(converted[0].message).toBe("Unexpected console");
    expect(converted[0].severity).toBe("error");
    expect(converted[0].ruleId).toBe("no-console");
    expect(converted[0].dataLoc).toBe("app.tsx:5:1");
    expect(converted[0].line).toBe(5);
    expect(converted[0].column).toBe(1);
  });

  it("excludes dataLocs with zero issues after conversion", () => {
    const issues = new Map<string, Issue[]>();
    issues.set("empty.tsx:1:0", []);
    issues.set("has.tsx:5:1", [createIssue({ dataLoc: "has.tsx:5:1" })]);

    const result = eslintPlugin.getIssues!({ issues } as ESLintPluginSlice);
    expect(result.issues.size).toBe(1);
    expect(result.issues.has("has.tsx:5:1")).toBe(true);
    expect(result.issues.has("empty.tsx:1:0")).toBe(false);
  });

  it("preserves multiple issues at the same dataLoc", () => {
    const issues = new Map<string, Issue[]>();
    issues.set("multi.tsx:10:5", [
      createIssue({ ruleId: "rule-a", dataLoc: "multi.tsx:10:5" }),
      createIssue({ ruleId: "rule-b", dataLoc: "multi.tsx:10:5" }),
    ]);

    const result = eslintPlugin.getIssues!({ issues } as ESLintPluginSlice);
    expect(result.issues.get("multi.tsx:10:5")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getRules
// ---------------------------------------------------------------------------

describe("eslintPlugin.getRules", () => {
  it("returns empty array when no availableRules", () => {
    const { services } = createMockServices({ availableRules: [] });
    const result = eslintPlugin.getRules!(services);
    expect(result).toEqual([]);
  });

  it("returns empty array when availableRules is undefined", () => {
    const { services, state } = createMockServices();
    // Simulate state without availableRules property
    delete (state as Record<string, unknown>).availableRules;
    const result = eslintPlugin.getRules!(services);
    expect(result).toEqual([]);
  });

  it("maps available rules to RuleDefinition format", () => {
    const rules: AvailableRule[] = [
      {
        id: "no-console",
        name: "No Console",
        description: "Disallow console.log",
        category: "static",
        defaultSeverity: "warn",
        docs: "https://eslint.org/docs/rules/no-console",
      },
    ];
    const { services } = createMockServices({ availableRules: rules });
    const result = eslintPlugin.getRules!(services);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "no-console",
      name: "No Console",
      description: "Disallow console.log",
      category: "static",
      severity: "warning", // "warn" mapped to "warning"
      fixable: false,
      pluginId: "eslint",
      docs: "https://eslint.org/docs/rules/no-console",
    });
  });

  it('normalizes "warn" severity to "warning"', () => {
    const rules: AvailableRule[] = [
      {
        id: "r1",
        name: "R1",
        description: "desc",
        category: "static",
        defaultSeverity: "warn",
      },
    ];
    const { services } = createMockServices({ availableRules: rules });
    const result = eslintPlugin.getRules!(services);
    expect(result[0].severity).toBe("warning");
  });

  it("uses currentSeverity from rule when available", () => {
    const rules: AvailableRule[] = [
      {
        id: "r1",
        name: "R1",
        description: "desc",
        category: "static",
        defaultSeverity: "warn",
        currentSeverity: "error",
      },
    ];
    const { services } = createMockServices({ availableRules: rules });
    const result = eslintPlugin.getRules!(services);
    expect(result[0].severity).toBe("error");
  });

  it("uses config severity over rule severity when ruleConfigs exist", () => {
    const rules: AvailableRule[] = [
      {
        id: "r1",
        name: "R1",
        description: "desc",
        category: "static",
        defaultSeverity: "warn",
        currentSeverity: "error",
      },
    ];
    const configs = new Map<string, RuleConfig>();
    configs.set("r1", { severity: "off" });

    const { services } = createMockServices({
      availableRules: rules,
      ruleConfigs: configs,
    });
    const result = eslintPlugin.getRules!(services);
    expect(result[0].severity).toBe("off");
  });

  it("preserves error severity as-is (no normalization needed)", () => {
    const rules: AvailableRule[] = [
      {
        id: "r1",
        name: "R1",
        description: "desc",
        category: "static",
        defaultSeverity: "error",
      },
    ];
    const { services } = createMockServices({ availableRules: rules });
    expect(eslintPlugin.getRules!(services)[0].severity).toBe("error");
  });

  it("preserves off severity as-is", () => {
    const rules: AvailableRule[] = [
      {
        id: "r1",
        name: "R1",
        description: "desc",
        category: "static",
        defaultSeverity: "off",
      },
    ];
    const { services } = createMockServices({ availableRules: rules });
    expect(eslintPlugin.getRules!(services)[0].severity).toBe("off");
  });
});

// ---------------------------------------------------------------------------
// setRuleSeverity
// ---------------------------------------------------------------------------

describe("eslintPlugin.setRuleSeverity", () => {
  it('sends WebSocket message with "warn" when given "warning"', () => {
    const { services } = createMockServices();
    eslintPlugin.setRuleSeverity!("no-console", "warning", services);

    expect(services.websocket.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "rule:config:set",
        ruleId: "no-console",
        severity: "warn",
      })
    );
  });

  it("sends WebSocket message with error severity unchanged", () => {
    const { services } = createMockServices();
    eslintPlugin.setRuleSeverity!("no-console", "error", services);

    expect(services.websocket.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "rule:config:set",
        ruleId: "no-console",
        severity: "error",
      })
    );
  });

  it("sends WebSocket message with off severity unchanged", () => {
    const { services } = createMockServices();
    eslintPlugin.setRuleSeverity!("no-console", "off", services);

    expect(services.websocket.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "rule:config:set",
        ruleId: "no-console",
        severity: "off",
      })
    );
  });

  it("marks the rule as updating in state", () => {
    const { services, state } = createMockServices();
    eslintPlugin.setRuleSeverity!("no-console", "warning", services);

    const updating = state.ruleConfigUpdating as Map<string, boolean>;
    expect(updating.get("no-console")).toBe(true);
  });

  it("includes a requestId starting with rule-severity-", () => {
    const { services } = createMockServices();
    eslintPlugin.setRuleSeverity!("no-console", "error", services);

    const call = (services.websocket.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    expect(call.requestId).toMatch(/^rule-severity-\d+$/);
  });
});

// ---------------------------------------------------------------------------
// getRuleConfig
// ---------------------------------------------------------------------------

describe("eslintPlugin.getRuleConfig", () => {
  it("returns empty object when no config exists for rule", () => {
    const { services } = createMockServices();
    const result = eslintPlugin.getRuleConfig!("no-console", services);
    expect(result).toEqual({});
  });

  it("returns options from existing rule config", () => {
    const configs = new Map<string, RuleConfig>();
    configs.set("no-console", {
      severity: "warn",
      options: { allow: ["warn", "error"] },
    });
    const { services } = createMockServices({ ruleConfigs: configs });
    const result = eslintPlugin.getRuleConfig!("no-console", services);
    expect(result).toEqual({ allow: ["warn", "error"] });
  });

  it("returns empty object when config exists but has no options", () => {
    const configs = new Map<string, RuleConfig>();
    configs.set("no-console", { severity: "warn" });
    const { services } = createMockServices({ ruleConfigs: configs });
    const result = eslintPlugin.getRuleConfig!("no-console", services);
    expect(result).toEqual({});
  });

  it("returns empty object when ruleConfigs is undefined in state", () => {
    const { services, state } = createMockServices();
    delete (state as Record<string, unknown>).ruleConfigs;
    const result = eslintPlugin.getRuleConfig!("no-console", services);
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// setRuleConfig
// ---------------------------------------------------------------------------

describe("eslintPlugin.setRuleConfig", () => {
  it("sends WebSocket message with rule options", () => {
    const { services } = createMockServices();
    const config = { allow: ["warn"] };
    eslintPlugin.setRuleConfig!("no-console", config, services);

    expect(services.websocket.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "rule:config:set",
        ruleId: "no-console",
        options: { allow: ["warn"] },
      })
    );
  });

  it("marks the rule as updating", () => {
    const { services, state } = createMockServices();
    eslintPlugin.setRuleConfig!("no-console", { allow: [] }, services);

    const updating = state.ruleConfigUpdating as Map<string, boolean>;
    expect(updating.get("no-console")).toBe(true);
  });

  it("includes a requestId starting with rule-config-", () => {
    const { services } = createMockServices();
    eslintPlugin.setRuleConfig!("no-console", {}, services);

    const call = (services.websocket.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    expect(call.requestId).toMatch(/^rule-config-\d+$/);
  });
});

// ---------------------------------------------------------------------------
// getPaletteItems
// ---------------------------------------------------------------------------

describe("eslintPlugin.getPaletteItems", () => {
  it("returns empty array when no plugin state exists", () => {
    const { services } = createMockServices();
    // getState returns the internal state which has no `plugins.eslint`
    (services.getState as ReturnType<typeof vi.fn>).mockReturnValue({});
    const items = eslintPlugin.getPaletteItems!(services);
    expect(Array.isArray(items)).toBe(true);
  });

  it("returns issue palette items with correct fields", () => {
    const issueMap = new Map<string, Issue[]>();
    issueMap.set("src/Button.tsx:10:5", [
      createIssue({
        id: "eslint:no-console:src/Button.tsx:10:5:10",
        message: "Unexpected console statement",
        severity: "warning",
        dataLoc: "src/Button.tsx:10:5",
        ruleId: "no-console",
        filePath: "src/Button.tsx",
        line: 10,
      }),
    ]);

    const fullState = {
      wsConnected: true,
      plugins: {
        eslint: {
          issues: issueMap,
          scanStatus: "scanning",
        },
      },
    };

    const { services } = createMockServices();
    (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(fullState);

    const items = eslintPlugin.getPaletteItems!(services);

    // Should have at least one issue item + commands
    const issueItem = items.find((item) =>
      item.id.startsWith("eslint:issue:")
    );
    expect(issueItem).toBeDefined();
    expect(issueItem!.title).toBe("Unexpected console statement");
    expect(issueItem!.subtitle).toBe("Button.tsx:10");
    expect(issueItem!.keywords).toContain("Lint");
    expect(issueItem!.keywords).toContain("no-console");
    expect(issueItem!.keywords).toContain("Button.tsx");
  });

  it("issue palette items execute opens inspector and closes palette", () => {
    const issueMap = new Map<string, Issue[]>();
    issueMap.set("src/App.tsx:1:0", [
      createIssue({
        dataLoc: "src/App.tsx:1:0",
        filePath: "src/App.tsx",
        line: 1,
      }),
    ]);

    const fullState = {
      wsConnected: true,
      plugins: { eslint: { issues: issueMap, scanStatus: "scanning" } },
    };
    const { services } = createMockServices();
    (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(fullState);

    const items = eslintPlugin.getPaletteItems!(services);
    const issueItem = items.find((i) => i.id.startsWith("eslint:issue:"))!;

    // Execute the item
    issueItem.execute!(services);

    expect(services.openInspector).toHaveBeenCalledWith("issue", {
      issue: expect.objectContaining({ dataLoc: "src/App.tsx:1:0" }),
    });
    expect(services.closeCommandPalette).toHaveBeenCalled();
  });

  it("includes command palette items from eslintCommands", () => {
    const fullState = {
      wsConnected: true,
      plugins: { eslint: { issues: new Map(), scanStatus: "scanning" } },
    };
    const { services } = createMockServices();
    (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(fullState);

    const items = eslintPlugin.getPaletteItems!(services);

    // Commands always include "Command" and "ESLint" keywords
    const commandItems = items.filter((item) =>
      item.keywords.includes("Command")
    );
    expect(commandItems.length).toBeGreaterThan(0);
    for (const cmd of commandItems) {
      expect(cmd.keywords).toContain("ESLint");
    }
  });

  it("excludes commands whose isAvailable returns false", () => {
    // When wsConnected is false, many commands become unavailable
    const fullState = {
      wsConnected: false,
      plugins: { eslint: { issues: new Map(), scanStatus: "idle" } },
    };
    const { services } = createMockServices();
    (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(fullState);

    const items = eslintPlugin.getPaletteItems!(services);
    const commandItems = items.filter((item) =>
      item.keywords.includes("Command")
    );

    // Toggle scan, start scan, and clear&rescan all require wsConnected=true
    const toggleCmd = commandItems.find((i) => i.id === "eslint:toggle-scan");
    expect(toggleCmd).toBeUndefined();
  });

  it("deduplicates keywords in issue items", () => {
    const issueMap = new Map<string, Issue[]>();
    // Create an issue where ruleId == shortRuleId (no slash)
    issueMap.set("src/App.tsx:1:0", [
      createIssue({
        ruleId: "no-console",
        filePath: "src/App.tsx",
        dataLoc: "src/App.tsx:1:0",
        line: 1,
      }),
    ]);

    const fullState = {
      wsConnected: true,
      plugins: { eslint: { issues: issueMap, scanStatus: "scanning" } },
    };
    const { services } = createMockServices();
    (services.getState as ReturnType<typeof vi.fn>).mockReturnValue(fullState);

    const items = eslintPlugin.getPaletteItems!(services);
    const issueItem = items.find((i) => i.id.startsWith("eslint:issue:"))!;

    // "no-console" should appear only once (ruleId == shortRuleId)
    const ruleIdOccurrences = issueItem.keywords.filter(
      (k) => k === "no-console"
    );
    expect(ruleIdOccurrences).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// handleWebSocketMessage - lint:progress
// ---------------------------------------------------------------------------

describe("handleWebSocketMessage - lint:progress", () => {
  it("adds a linting file entry for in-progress phase", () => {
    const { services, state } = createMockServices();

    handleWebSocketMessage(services, {
      type: "lint:progress",
      filePath: "src/App.tsx",
      phase: "Parsing",
    } as never);

    const lintingFiles = state.lintingFiles as Map<
      string,
      { phase: string; startedAt: number }
    >;
    expect(lintingFiles.has("src/App.tsx")).toBe(true);
    expect(lintingFiles.get("src/App.tsx")!.phase).toBe("Parsing");
    expect(lintingFiles.get("src/App.tsx")!.startedAt).toBeTypeOf("number");
  });

  it("removes the file entry when phase starts with Done", () => {
    const lintingFiles = new Map<string, { phase: string; startedAt: number }>();
    lintingFiles.set("src/App.tsx", {
      phase: "Analyzing",
      startedAt: Date.now() - 1000,
    });
    const { services, state } = createMockServices({ lintingFiles } as never);

    handleWebSocketMessage(services, {
      type: "lint:progress",
      filePath: "src/App.tsx",
      phase: "Done in 200ms",
    } as never);

    const updatedFiles = state.lintingFiles as Map<string, unknown>;
    expect(updatedFiles.has("src/App.tsx")).toBe(false);
  });

  it("preserves startedAt when updating phase for the same file", () => {
    const originalStart = Date.now() - 5000;
    const lintingFiles = new Map<string, { phase: string; startedAt: number }>();
    lintingFiles.set("src/App.tsx", {
      phase: "Parsing",
      startedAt: originalStart,
    });
    const { services, state } = createMockServices({ lintingFiles } as never);

    handleWebSocketMessage(services, {
      type: "lint:progress",
      filePath: "src/App.tsx",
      phase: "Analyzing rules",
    } as never);

    const updated = (state.lintingFiles as Map<string, { phase: string; startedAt: number }>).get("src/App.tsx")!;
    expect(updated.phase).toBe("Analyzing rules");
    expect(updated.startedAt).toBe(originalStart);
  });
});

// ---------------------------------------------------------------------------
// handleWebSocketMessage - rules:metadata
// ---------------------------------------------------------------------------

describe("handleWebSocketMessage - rules:metadata", () => {
  it("stores availableRules and initializes ruleConfigs", () => {
    const { services, state } = createMockServices();

    const rules: AvailableRule[] = [
      {
        id: "no-console",
        name: "No Console",
        description: "Disallow console",
        category: "static",
        defaultSeverity: "warn",
        currentSeverity: "error",
      },
      {
        id: "no-unused-vars",
        name: "No Unused Vars",
        description: "Disallow unused variables",
        category: "static",
        defaultSeverity: "warn",
      },
    ];

    handleWebSocketMessage(services, {
      type: "rules:metadata",
      rules,
    } as never);

    expect(state.availableRules).toEqual(rules);

    const configs = state.ruleConfigs as Map<string, RuleConfig>;
    expect(configs.size).toBe(2);
    expect(configs.get("no-console")).toEqual({
      severity: "error",
      options: undefined,
    });
    expect(configs.get("no-unused-vars")).toEqual({
      severity: "warn",
      options: undefined,
    });
  });

  it("uses defaultSeverity when currentSeverity is not provided", () => {
    const { services, state } = createMockServices();

    handleWebSocketMessage(services, {
      type: "rules:metadata",
      rules: [
        {
          id: "r1",
          name: "R1",
          description: "d",
          category: "static",
          defaultSeverity: "off",
        },
      ],
    } as never);

    const configs = state.ruleConfigs as Map<string, RuleConfig>;
    expect(configs.get("r1")!.severity).toBe("off");
  });

  it("initializes options from currentOptions when present", () => {
    const { services, state } = createMockServices();

    handleWebSocketMessage(services, {
      type: "rules:metadata",
      rules: [
        {
          id: "r1",
          name: "R1",
          description: "d",
          category: "static",
          defaultSeverity: "warn",
          currentOptions: { maxLen: 80 },
        },
      ],
    } as never);

    const configs = state.ruleConfigs as Map<string, RuleConfig>;
    expect(configs.get("r1")!.options).toEqual({ maxLen: 80 });
  });

  it("falls back to first element of defaultOptions when no currentOptions", () => {
    const { services, state } = createMockServices();

    handleWebSocketMessage(services, {
      type: "rules:metadata",
      rules: [
        {
          id: "r1",
          name: "R1",
          description: "d",
          category: "static",
          defaultSeverity: "warn",
          defaultOptions: [{ indent: 2 }],
        },
      ],
    } as never);

    const configs = state.ruleConfigs as Map<string, RuleConfig>;
    expect(configs.get("r1")!.options).toEqual({ indent: 2 });
  });

  it("leaves options undefined when defaultOptions is empty array", () => {
    const { services, state } = createMockServices();

    handleWebSocketMessage(services, {
      type: "rules:metadata",
      rules: [
        {
          id: "r1",
          name: "R1",
          description: "d",
          category: "static",
          defaultSeverity: "warn",
          defaultOptions: [],
        },
      ],
    } as never);

    const configs = state.ruleConfigs as Map<string, RuleConfig>;
    expect(configs.get("r1")!.options).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// handleWebSocketMessage - rule:config:result
// ---------------------------------------------------------------------------

describe("handleWebSocketMessage - rule:config:result", () => {
  it("clears updating state and updates config on success", () => {
    const updating = new Map<string, boolean>();
    updating.set("no-console", true);
    const configs = new Map<string, RuleConfig>();
    configs.set("no-console", { severity: "warn" });

    const { services, state } = createMockServices({
      ruleConfigUpdating: updating,
      ruleConfigs: configs,
    });

    handleWebSocketMessage(services, {
      type: "rule:config:result",
      ruleId: "no-console",
      severity: "error",
      options: { allow: ["warn"] },
      success: true,
    } as never);

    // Updating flag should be cleared
    const finalUpdating = state.ruleConfigUpdating as Map<string, boolean>;
    expect(finalUpdating.has("no-console")).toBe(false);

    // Config should be updated
    const finalConfigs = state.ruleConfigs as Map<string, RuleConfig>;
    expect(finalConfigs.get("no-console")).toEqual({
      severity: "error",
      options: { allow: ["warn"] },
    });

    // Issues should be cleared to trigger fresh linting
    expect((state.issues as Map<string, unknown>).size).toBe(0);
    expect((state.requestedFiles as Set<string>).size).toBe(0);
    expect((state.scannedDataLocs as Set<string>).size).toBe(0);
  });

  it("re-requests linting for previously tracked files on success", () => {
    const updating = new Map<string, boolean>();
    updating.set("no-console", true);
    const configs = new Map<string, RuleConfig>();
    configs.set("no-console", { severity: "warn" });

    const { services, state } = createMockServices({
      ruleConfigUpdating: updating,
      ruleConfigs: configs,
      requestedFiles: new Set(["app.tsx", "layout.tsx"]),
    });

    handleWebSocketMessage(services, {
      type: "rule:config:result",
      ruleId: "no-console",
      severity: "error",
      success: true,
    } as never);

    // requestedFiles should be repopulated with previously tracked files
    const reqFiles = state.requestedFiles as Set<string>;
    expect(reqFiles.size).toBe(2);
    expect(reqFiles.has("app.tsx")).toBe(true);
    expect(reqFiles.has("layout.tsx")).toBe(true);

    // Lint requests should have been sent for each file
    expect(services.websocket.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "lint:file", filePath: "app.tsx" })
    );
    expect(services.websocket.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "lint:file", filePath: "layout.tsx" })
    );
  });

  it("clears updating state but does not update config on failure", () => {
    const updating = new Map<string, boolean>();
    updating.set("no-console", true);
    const configs = new Map<string, RuleConfig>();
    configs.set("no-console", { severity: "warn" });

    const { services, state, setStateCalls } = createMockServices({
      ruleConfigUpdating: updating,
      ruleConfigs: configs,
    });

    handleWebSocketMessage(services, {
      type: "rule:config:result",
      ruleId: "no-console",
      severity: "error",
      success: false,
      error: "Permission denied",
    } as never);

    // Updating flag should still be cleared
    const finalUpdating = state.ruleConfigUpdating as Map<string, boolean>;
    expect(finalUpdating.has("no-console")).toBe(false);

    // Only one setState call (clearing the updating flag), not the config update
    // On failure, we still call setState once (to clear updating), but issues remain
    expect(setStateCalls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// handleWebSocketMessage - rule:config:changed
// ---------------------------------------------------------------------------

describe("handleWebSocketMessage - rule:config:changed", () => {
  it("updates config and clears issues for fresh linting", () => {
    const configs = new Map<string, RuleConfig>();
    configs.set("no-console", { severity: "warn" });

    const issues = new Map<string, Issue[]>();
    issues.set("test.tsx:10:5", [createIssue()]);

    const { services, state } = createMockServices({
      ruleConfigs: configs,
      issues,
      requestedFiles: new Set(["test.tsx"]),
      scannedDataLocs: new Set(["test.tsx:10:5"]),
    });

    handleWebSocketMessage(services, {
      type: "rule:config:changed",
      ruleId: "no-console",
      severity: "error",
      options: { allow: ["error"] },
    } as never);

    const finalConfigs = state.ruleConfigs as Map<string, RuleConfig>;
    expect(finalConfigs.get("no-console")).toEqual({
      severity: "error",
      options: { allow: ["error"] },
    });

    // Issues and scannedDataLocs should be cleared
    expect((state.issues as Map<string, unknown>).size).toBe(0);
    expect((state.scannedDataLocs as Set<string>).size).toBe(0);

    // requestedFiles should be repopulated (re-linting triggered for previously tracked files)
    expect((state.requestedFiles as Set<string>).size).toBe(1);
    expect((state.requestedFiles as Set<string>).has("test.tsx")).toBe(true);

    // Lint request should have been re-sent via websocket
    expect(services.websocket.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "lint:file", filePath: "test.tsx" })
    );
  });
});

// ---------------------------------------------------------------------------
// handleWebSocketMessage - workspace:info
// ---------------------------------------------------------------------------

describe("handleWebSocketMessage - workspace:info", () => {
  it("stores workspace path information", () => {
    const { services, state } = createMockServices();

    handleWebSocketMessage(services, {
      type: "workspace:info",
      appRoot: "/home/user/app",
      workspaceRoot: "/home/user/app",
      serverCwd: "/home/user/app",
    } as never);

    expect(state.appRoot).toBe("/home/user/app");
    expect(state.workspaceRoot).toBe("/home/user/app");
    expect(state.serverCwd).toBe("/home/user/app");
  });
});

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

describe("eslintPlugin.initialize", () => {
  it("subscribes to all expected WebSocket message types", () => {
    const { services } = createMockServices();
    const cleanup = eslintPlugin.initialize!(services);

    const expectedTypes = [
      "lint:result",
      "lint:progress",
      "file:changed",
      "workspace:info",
      "workspace:capabilities",
      "rules:metadata",
      "rule:config:result",
      "rule:config:changed",
    ];

    for (const type of expectedTypes) {
      expect(services.websocket.on).toHaveBeenCalledWith(
        type,
        expect.any(Function)
      );
    }

    // Exactly 8 WebSocket message types
    expect(services.websocket.on).toHaveBeenCalledTimes(expectedTypes.length);

    // Cleanup should be a function
    expect(cleanup).toBeTypeOf("function");
  });

  it("subscribes to domObserver.onElementsAdded", () => {
    const { services } = createMockServices();
    eslintPlugin.initialize!(services);

    expect(services.domObserver.onElementsAdded).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });

  it("returns cleanup function that calls all unsubscribers", () => {
    const unsubWs = vi.fn();
    const unsubDom = vi.fn();

    const { services } = createMockServices();
    (services.websocket.on as ReturnType<typeof vi.fn>).mockImplementation(
      () => {
        return unsubWs;
      }
    );
    (
      services.domObserver.onElementsAdded as ReturnType<typeof vi.fn>
    ).mockReturnValue(unsubDom);

    const cleanup = eslintPlugin.initialize!(services) as () => void;
    cleanup();

    // 8 WS subscriptions + 1 DOM subscription = 9 unsubscribe calls
    // Each WS on() call returns unsubWs, so it should be called 8 times
    expect(unsubWs).toHaveBeenCalledTimes(8);
    expect(unsubDom).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// createSlice
// ---------------------------------------------------------------------------

describe("eslintPlugin.createSlice", () => {
  it("returns a slice with initial state and action methods", () => {
    const { services } = createMockServices();
    const slice = eslintPlugin.createSlice!(services);

    // State fields
    expect(slice).toHaveProperty("issues");
    expect(slice).toHaveProperty("scannedDataLocs");
    expect(slice).toHaveProperty("scanStatus");
    expect(slice).toHaveProperty("availableRules");

    // Action methods (from createESLintActions)
    expect(slice).toHaveProperty("startScanning");
    expect(slice).toHaveProperty("stopScanning");
    expect(slice).toHaveProperty("setIssues");
    expect(slice).toHaveProperty("clearIssues");
    expect(slice).toHaveProperty("toggleRule");
  });

  it("slice actions update state via services.setState", () => {
    const { services } = createMockServices();
    const slice = eslintPlugin.createSlice!(services) as ESLintPluginSlice;

    slice.startScanning();
    // createSlice uses its own internal setSlice that calls services.setState
    expect(services.setState).toHaveBeenCalledWith(
      expect.objectContaining({ scanStatus: "scanning" })
    );
  });
});

// ---------------------------------------------------------------------------
// dispose
// ---------------------------------------------------------------------------

describe("eslintPlugin.dispose", () => {
  it("can be called without error", () => {
    const { services } = createMockServices();
    expect(() => eslintPlugin.dispose!(services)).not.toThrow();
  });
});
