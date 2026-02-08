/**
 * Tests for ESLint search provider
 *
 * Tests getSearchItems (rule + file grouping, sorting, searchFields)
 * and getPreviewPanel (routing to rule/file/null panels).
 */

import { describe, it, expect, vi } from "vitest";
import { getSearchItems, getPreviewPanel } from "./search-provider";
import type { PluginServices, SearchItem } from "../../core/plugin-system/types";
import type { Issue } from "../../ui/types";
import type { AvailableRule } from "./types";
import type { ESLintPluginSlice } from "./slice";

// ============================================================================
// Test Helpers
// ============================================================================

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    message: "Test issue",
    severity: "warning",
    dataLoc: "src/App.tsx:10:5",
    ruleId: "no-unused-vars",
    pluginId: "eslint",
    filePath: "src/App.tsx",
    line: 10,
    ...overrides,
  };
}

function makeRule(overrides: Partial<AvailableRule> = {}): AvailableRule {
  return {
    id: "no-unused-vars",
    name: "No Unused Variables",
    description: "Disallow unused variables",
    category: "static",
    defaultSeverity: "warn",
    ...overrides,
  };
}

function createMockServices(
  issues: Issue[],
  availableRules: AvailableRule[] = []
): PluginServices {
  // Build the issues map keyed by dataLoc
  const issueMap = new Map<string, Issue[]>();
  for (const issue of issues) {
    const existing = issueMap.get(issue.dataLoc) || [];
    issueMap.set(issue.dataLoc, [...existing, issue]);
  }

  const eslintState: Partial<ESLintPluginSlice> = {
    issues: issueMap,
    availableRules,
    disabledRules: new Set(),
  };

  return {
    websocket: {
      isConnected: false,
      url: "ws://test:9234",
      connect: () => {},
      disconnect: () => {},
      send: () => {},
      on: () => () => {},
      onConnectionChange: () => () => {},
    },
    domObserver: {
      start: () => {},
      stop: () => {},
      onElementsAdded: () => () => {},
      onElementsRemoved: () => () => {},
    },
    getState: () => ({ plugins: { eslint: eslintState } }),
    setState: () => {},
    openInspector: () => {},
    closeCommandPalette: () => {},
    closeInspector: () => {},
    invalidateCategory: () => {},
  };
}

// ============================================================================
// getSearchItems Tests
// ============================================================================

describe("getSearchItems", () => {
  it("returns empty array when there are no issues", () => {
    const services = createMockServices([]);
    const items = getSearchItems(services);

    expect(items).toEqual([]);
  });

  it("returns rule items grouped by ruleId", () => {
    const issues = [
      makeIssue({ id: "i1", ruleId: "no-unused-vars", filePath: "a.ts", dataLoc: "a.ts:1:1" }),
      makeIssue({ id: "i2", ruleId: "no-unused-vars", filePath: "b.ts", dataLoc: "b.ts:1:1" }),
      makeIssue({ id: "i3", ruleId: "prefer-const", filePath: "a.ts", dataLoc: "a.ts:5:1" }),
    ];
    const services = createMockServices(issues);
    const items = getSearchItems(services);

    const ruleItems = items.filter((i) => i.section === "rules");
    expect(ruleItems).toHaveLength(2);

    const noUnused = ruleItems.find((i) => i.id === "rule:no-unused-vars");
    expect(noUnused).toBeDefined();
    expect(noUnused!.count).toBe(2);
    expect(noUnused!.fileCount).toBe(2); // a.ts, b.ts
  });

  it("returns file items grouped by filePath", () => {
    const issues = [
      makeIssue({ id: "i1", ruleId: "r1", filePath: "src/App.tsx", dataLoc: "src/App.tsx:1:1" }),
      makeIssue({ id: "i2", ruleId: "r2", filePath: "src/App.tsx", dataLoc: "src/App.tsx:5:1" }),
      makeIssue({ id: "i3", ruleId: "r1", filePath: "src/Button.tsx", dataLoc: "src/Button.tsx:1:1" }),
    ];
    const services = createMockServices(issues);
    const items = getSearchItems(services);

    const fileItems = items.filter((i) => i.section === "files");
    expect(fileItems).toHaveLength(2);

    const appFile = fileItems.find((i) => i.id === "file:src/App.tsx");
    expect(appFile).toBeDefined();
    expect(appFile!.count).toBe(2);
    expect(appFile!.label).toBe("App.tsx");
    expect(appFile!.subtitle).toBe("src/App.tsx");
  });

  it("populates searchFields correctly for items", () => {
    const issues = [
      makeIssue({
        id: "i1",
        ruleId: "no-unused-vars",
        filePath: "src/App.tsx",
        dataLoc: "src/App.tsx:10:5",
        message: "Variable 'x' is unused",
      }),
    ];
    const rules = [makeRule({ id: "no-unused-vars", name: "No Unused Variables", description: "Disallow unused variables" })];
    const services = createMockServices(issues, rules);
    const items = getSearchItems(services);

    const ruleItem = items.find((i) => i.id === "rule:no-unused-vars");
    expect(ruleItem!.searchFields.label).toBe("No Unused Variables");
    expect(ruleItem!.searchFields.subtitle).toBe("Disallow unused variables");
    expect(ruleItem!.searchFields.keywords).toContain("no-unused-vars");
    expect(ruleItem!.searchFields.extra).toContain("Variable 'x' is unused");

    const fileItem = items.find((i) => i.id === "file:src/App.tsx");
    expect(fileItem!.searchFields.label).toBe("App.tsx");
    expect(fileItem!.searchFields.subtitle).toBe("src/App.tsx");
    expect(fileItem!.searchFields.keywords).toContain("no-unused-vars");
  });

  it("sorts items by error count descending, then by total count", () => {
    const issues = [
      // rule-a: 3 warnings, 0 errors
      makeIssue({ id: "i1", ruleId: "rule-a", severity: "warning", filePath: "a.ts", dataLoc: "a.ts:1:1" }),
      makeIssue({ id: "i2", ruleId: "rule-a", severity: "warning", filePath: "a.ts", dataLoc: "a.ts:2:1" }),
      makeIssue({ id: "i3", ruleId: "rule-a", severity: "warning", filePath: "a.ts", dataLoc: "a.ts:3:1" }),
      // rule-b: 1 error
      makeIssue({ id: "i4", ruleId: "rule-b", severity: "error", filePath: "b.ts", dataLoc: "b.ts:1:1" }),
    ];
    const services = createMockServices(issues);
    const items = getSearchItems(services);

    // rule-b has errors and should come before rule-a
    const ruleItems = items.filter((i) => i.section === "rules");
    expect(ruleItems[0].metadata?.ruleId).toBe("rule-b");
    expect(ruleItems[1].metadata?.ruleId).toBe("rule-a");
  });

  it("uses rule metadata for label when available", () => {
    const issues = [
      makeIssue({ id: "i1", ruleId: "my-rule", filePath: "a.ts", dataLoc: "a.ts:1:1" }),
    ];
    const rules = [makeRule({ id: "my-rule", name: "My Custom Rule", description: "A custom rule" })];
    const services = createMockServices(issues, rules);
    const items = getSearchItems(services);

    const ruleItem = items.find((i) => i.id === "rule:my-rule");
    expect(ruleItem!.label).toBe("My Custom Rule");
    expect(ruleItem!.subtitle).toBe("my-rule");
  });

  it("extracts short name from scoped rule IDs", () => {
    const issues = [
      makeIssue({
        id: "i1",
        ruleId: "@typescript-eslint/no-explicit-any",
        filePath: "a.ts",
        dataLoc: "a.ts:1:1",
      }),
    ];
    const services = createMockServices(issues);
    const items = getSearchItems(services);

    const ruleItem = items.find((i) => i.id === "rule:@typescript-eslint/no-explicit-any");
    // Without rule metadata, label should be the short name
    expect(ruleItem!.label).toBe("no-explicit-any");
  });
});

// ============================================================================
// getPreviewPanel Tests
// ============================================================================

// Mock the panel components since they are React components
vi.mock("./panels/RulePreviewPanel", () => ({
  RulePreviewPanel: () => null,
}));

vi.mock("./panels/FilePreviewPanel", () => ({
  FilePreviewPanel: () => null,
}));

describe("getPreviewPanel", () => {
  const services = createMockServices([]);

  it("returns element for rule type", () => {
    const item: SearchItem = {
      id: "rule:no-unused-vars",
      section: "rules",
      label: "no-unused-vars",
      searchFields: { label: "no-unused-vars" },
      metadata: { tileType: "rule", ruleId: "no-unused-vars" },
    };
    const result = getPreviewPanel(item, services);

    expect(result).not.toBeNull();
    expect(result!.element).toBeDefined();
  });

  it("returns element for file type", () => {
    const item: SearchItem = {
      id: "file:src/App.tsx",
      section: "files",
      label: "App.tsx",
      searchFields: { label: "App.tsx" },
      metadata: { tileType: "file", filePath: "src/App.tsx" },
    };
    const result = getPreviewPanel(item, services);

    expect(result).not.toBeNull();
    expect(result!.element).toBeDefined();
  });

  it("returns null for unknown type", () => {
    const item: SearchItem = {
      id: "unknown:x",
      section: "commands",
      label: "Unknown",
      searchFields: { label: "Unknown" },
      metadata: { tileType: "other" },
    };
    const result = getPreviewPanel(item, services);

    expect(result).toBeNull();
  });

  it("returns null when metadata has no tileType", () => {
    const item: SearchItem = {
      id: "item:1",
      section: "rules",
      label: "Item",
      searchFields: { label: "Item" },
      metadata: {},
    };
    const result = getPreviewPanel(item, services);

    expect(result).toBeNull();
  });
});
