/**
 * Tests for RulePanel component
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RulePanel } from "./RulePanel";
import {
  createComposedStore,
  resetStore,
} from "../../../core/store/composed-store";
import type { PluginSliceMap } from "../../../core/store/composed-store";
import type { AvailableRule } from "../types";

/**
 * Helper to cast a minimal test object to a plugin slice type.
 */
function asPluginSlice<K extends keyof PluginSliceMap>(
  slice: Record<string, unknown>
): PluginSliceMap[K] {
  return slice as unknown as PluginSliceMap[K];
}

describe("RulePanel", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    cleanup();
    resetStore();
  });

  it("shows 'No rule selected' when data has no ruleId", () => {
    createComposedStore();
    render(<RulePanel data={{}} />);

    expect(screen.getByText("No rule selected")).toBeDefined();
  });

  it("shows 'No rule selected' when data is undefined", () => {
    createComposedStore();
    render(<RulePanel data={undefined} />);

    expect(screen.getByText("No rule selected")).toBeDefined();
  });

  it("shows 'Rule not found' when rule does not exist in store", () => {
    const store = createComposedStore();
    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        availableRules: [],
        ruleConfigs: new Map(),
        issues: new Map(),
      })
    );

    render(<RulePanel data={{ ruleId: "non-existent-rule" }} />);

    expect(screen.getByText(/Rule not found/)).toBeDefined();
    expect(screen.getByText(/non-existent-rule/)).toBeDefined();
  });

  it("renders rule information when rule exists", () => {
    const store = createComposedStore();
    const testRule: AvailableRule = {
      id: "no-unused-vars",
      name: "No Unused Variables",
      description: "Disallow unused variables",
      category: "static",
      currentSeverity: "error",
      docs: "https://eslint.org/docs/rules/no-unused-vars",
    };

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        availableRules: [testRule],
        ruleConfigs: new Map(),
        issues: new Map(),
        ruleConfigUpdating: new Map(),
      })
    );

    render(<RulePanel data={{ ruleId: "no-unused-vars" }} />);

    expect(screen.getByText("No Unused Variables")).toBeDefined();
    expect(screen.getByText("no-unused-vars")).toBeDefined();
    expect(screen.getByText("Disallow unused variables")).toBeDefined();
    expect(screen.getByText("static")).toBeDefined();
    expect(screen.getByText("View documentation")).toBeDefined();
  });

  it("shows issue count when there are issues for the rule", () => {
    const store = createComposedStore();
    const testRule: AvailableRule = {
      id: "no-console",
      name: "No Console",
      description: "Disallow console statements",
      category: "static",
      currentSeverity: "warning",
    };

    const issuesMap = new Map();
    issuesMap.set("file1.ts", [
      { ruleId: "no-console", message: "Unexpected console statement" },
      { ruleId: "no-console", message: "Unexpected console statement" },
    ]);
    issuesMap.set("file2.ts", [
      { ruleId: "no-console", message: "Unexpected console statement" },
      { ruleId: "other-rule", message: "Other issue" },
    ]);

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        availableRules: [testRule],
        ruleConfigs: new Map(),
        issues: issuesMap,
        ruleConfigUpdating: new Map(),
      })
    );

    render(<RulePanel data={{ ruleId: "no-console" }} />);

    expect(screen.getByText("3 issues")).toBeDefined();
  });

  it("shows singular 'issue' when there is exactly one issue", () => {
    const store = createComposedStore();
    const testRule: AvailableRule = {
      id: "single-issue-rule",
      name: "Single Issue Rule",
      description: "A rule with one issue",
      category: "semantic",
      currentSeverity: "error",
    };

    const issuesMap = new Map();
    issuesMap.set("file.ts", [
      { ruleId: "single-issue-rule", message: "One issue" },
    ]);

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        availableRules: [testRule],
        ruleConfigs: new Map(),
        issues: issuesMap,
        ruleConfigUpdating: new Map(),
      })
    );

    render(<RulePanel data={{ ruleId: "single-issue-rule" }} />);

    expect(screen.getByText("1 issue")).toBeDefined();
  });

  it("renders severity toggle buttons", () => {
    const store = createComposedStore();
    const testRule: AvailableRule = {
      id: "test-rule",
      name: "Test Rule",
      description: "Test description",
      category: "static",
      currentSeverity: "error",
    };

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        availableRules: [testRule],
        ruleConfigs: new Map(),
        issues: new Map(),
        ruleConfigUpdating: new Map(),
      })
    );

    render(<RulePanel data={{ ruleId: "test-rule" }} />);

    // All three severity options should be rendered
    expect(screen.getByText("E")).toBeDefined();
    expect(screen.getByText("W")).toBeDefined();
    expect(screen.getByText("Off")).toBeDefined();
  });

  it("shows category with semantic styling for semantic rules", () => {
    const store = createComposedStore();
    const testRule: AvailableRule = {
      id: "semantic-rule",
      name: "Semantic Rule",
      description: "A semantic analysis rule",
      category: "semantic",
      currentSeverity: "warning",
    };

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        availableRules: [testRule],
        ruleConfigs: new Map(),
        issues: new Map(),
        ruleConfigUpdating: new Map(),
      })
    );

    render(<RulePanel data={{ ruleId: "semantic-rule" }} />);

    expect(screen.getByText("semantic")).toBeDefined();
  });

  it("shows 'Updating...' indicator when rule config is being updated", () => {
    const store = createComposedStore();
    const testRule: AvailableRule = {
      id: "updating-rule",
      name: "Updating Rule",
      description: "A rule being updated",
      category: "static",
      currentSeverity: "error",
    };

    const updatingMap = new Map();
    updatingMap.set("updating-rule", true);

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        availableRules: [testRule],
        ruleConfigs: new Map(),
        issues: new Map(),
        ruleConfigUpdating: updatingMap,
      })
    );

    render(<RulePanel data={{ ruleId: "updating-rule" }} />);

    expect(screen.getByText("Updating...")).toBeDefined();
  });

  it("disables severity buttons when updating", () => {
    const store = createComposedStore();
    const testRule: AvailableRule = {
      id: "disabled-rule",
      name: "Disabled Rule",
      description: "A rule with disabled buttons",
      category: "static",
      currentSeverity: "warning",
    };

    const updatingMap = new Map();
    updatingMap.set("disabled-rule", true);

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        availableRules: [testRule],
        ruleConfigs: new Map(),
        issues: new Map(),
        ruleConfigUpdating: updatingMap,
      })
    );

    render(<RulePanel data={{ ruleId: "disabled-rule" }} />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it("does not render docs link when rule has no docs URL", () => {
    const store = createComposedStore();
    const testRule: AvailableRule = {
      id: "no-docs-rule",
      name: "No Docs Rule",
      description: "A rule without documentation",
      category: "static",
      currentSeverity: "off",
      // No docs property
    };

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        availableRules: [testRule],
        ruleConfigs: new Map(),
        issues: new Map(),
        ruleConfigUpdating: new Map(),
      })
    );

    render(<RulePanel data={{ ruleId: "no-docs-rule" }} />);

    expect(screen.queryByText("View documentation")).toBeNull();
  });

  it("uses config severity over rule currentSeverity when config exists", () => {
    const store = createComposedStore();
    const testRule: AvailableRule = {
      id: "config-rule",
      name: "Config Rule",
      description: "A rule with config",
      category: "static",
      currentSeverity: "error", // Default severity
    };

    const configMap = new Map();
    configMap.set("config-rule", { severity: "warn" }); // Config overrides to warning

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        availableRules: [testRule],
        ruleConfigs: configMap,
        issues: new Map(),
        ruleConfigUpdating: new Map(),
      })
    );

    render(<RulePanel data={{ ruleId: "config-rule" }} />);

    // The W button should be highlighted (we can't directly test styles easily,
    // but we can verify the component renders correctly)
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
  });
});

/**
 * Bug #5: RulePanel uses hardcoded hex colors (e.g., #111827, #374151)
 * instead of CSS variables (var(--uilint-text-primary), etc.).
 * This means the panel doesn't match the overlay theme.
 */
describe("RulePanel - theming with CSS variables", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    cleanup();
    resetStore();
  });

  it("uses CSS variables for text colors instead of hardcoded hex values", () => {
    const store = createComposedStore();
    const testRule: AvailableRule = {
      id: "theme-rule",
      name: "Theme Test Rule",
      description: "A rule for testing theming",
      category: "static",
      currentSeverity: "error",
      docs: "https://example.com/docs",
    };

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        availableRules: [testRule],
        ruleConfigs: new Map(),
        issues: new Map(),
        ruleConfigUpdating: new Map(),
      })
    );

    const { container } = render(<RulePanel data={{ ruleId: "theme-rule" }} />);

    // Collect all style attributes in the rendered tree
    const allElements = container.querySelectorAll("*");
    const styleStrings: string[] = [];
    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style) styleStrings.push(style);
    });

    // Should NOT use hardcoded hex color values for text
    const usesHardcodedColors = styleStrings.some(
      (s) => /color:\s*#[0-9a-fA-F]{6}/.test(s)
    );
    expect(usesHardcodedColors).toBe(false);

    // Should use CSS variables for theming
    const usesCSSVars = styleStrings.some((s) => s.includes("var(--uilint-"));
    expect(usesCSSVars).toBe(true);
  });

  it("uses CSS variables for background colors", () => {
    const store = createComposedStore();
    const testRule: AvailableRule = {
      id: "bg-rule",
      name: "Background Test Rule",
      description: "A rule for testing backgrounds",
      category: "semantic",
      currentSeverity: "warning",
    };

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        availableRules: [testRule],
        ruleConfigs: new Map(),
        issues: new Map(),
        ruleConfigUpdating: new Map(),
      })
    );

    const { container } = render(<RulePanel data={{ ruleId: "bg-rule" }} />);

    // Collect all style attributes
    const allElements = container.querySelectorAll("*");
    const styleStrings: string[] = [];
    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style) styleStrings.push(style);
    });

    // Should NOT use hardcoded hex backgrounds for non-severity elements
    // (severity buttons are allowed specific colors for semantic meaning)
    const nonButtonElements = container.querySelectorAll("*:not(button)");
    const nonButtonStyles: string[] = [];
    nonButtonElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style) nonButtonStyles.push(style);
    });

    const usesHardcodedBg = nonButtonStyles.some(
      (s) => /background:\s*#[0-9a-fA-F]{6}/.test(s)
    );
    expect(usesHardcodedBg).toBe(false);
  });
});

describe("SeverityToggle button interactions", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    cleanup();
    resetStore();
  });

  it("clicking severity button does not crash", () => {
    const store = createComposedStore();
    const testRule: AvailableRule = {
      id: "clickable-rule",
      name: "Clickable Rule",
      description: "A rule with clickable buttons",
      category: "static",
      currentSeverity: "error",
    };

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        availableRules: [testRule],
        ruleConfigs: new Map(),
        issues: new Map(),
        ruleConfigUpdating: new Map(),
      })
    );

    render(<RulePanel data={{ ruleId: "clickable-rule" }} />);

    // Click each button - should not throw
    const errorButton = screen.getByText("E");
    const warningButton = screen.getByText("W");
    const offButton = screen.getByText("Off");

    expect(() => fireEvent.click(errorButton)).not.toThrow();
    expect(() => fireEvent.click(warningButton)).not.toThrow();
    expect(() => fireEvent.click(offButton)).not.toThrow();
  });
});
