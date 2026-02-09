/**
 * Tests for RulePreviewPanel
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { RulePreviewPanel } from "./RulePreviewPanel";
import type { PluginServices } from "../../../core/plugin-system/types";
import type { Issue } from "../../../ui/types";
import type { AvailableRule } from "../types";

// Mock useComposedStore — returns values based on selector
const mockStoreState = {
  plugins: {
    eslint: {
      ruleConfigs: new Map<string, { severity: string; options?: Record<string, unknown> }>(),
      ruleConfigUpdating: new Map<string, boolean>(),
    },
  },
};

vi.mock("../../../core/store", () => ({
  useComposedStore: (selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

// Mock pluginRegistry
vi.mock("../../../core/plugin-system/registry", () => ({
  pluginRegistry: {
    setRuleSeverity: vi.fn(),
    setRuleConfig: vi.fn(),
  },
}));

// Mock RuleConfig to avoid rendering the full form
vi.mock("../../../ui/components/Inspector/RuleConfig", () => ({
  RuleConfig: ({
    ruleId,
    currentSeverity,
    onSeverityChange,
  }: {
    ruleId: string;
    currentSeverity: string;
    onSeverityChange: (s: string) => void;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "rule-config" },
      React.createElement("span", { "data-testid": "config-rule-id" }, ruleId),
      React.createElement("span", { "data-testid": "config-severity" }, currentSeverity),
      React.createElement(
        "button",
        { "data-testid": "change-severity", onClick: () => onSeverityChange("error") },
        "Set Error"
      )
    ),
}));

// Mock Popover to render trigger and children inline (children always visible)
vi.mock("../../../ui/components/primitives", () => ({
  Popover: ({
    trigger,
    children,
    open,
  }: {
    trigger: React.ReactNode;
    children: React.ReactNode;
    open: boolean;
    onClose: () => void;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "popover-wrapper" },
      trigger,
      open ? React.createElement("div", { "data-testid": "popover-content" }, children) : null
    ),
}));

// Mock Breadcrumbs
vi.mock("../../../ui/components/Inspector/Breadcrumbs", () => ({
  Breadcrumbs: ({
    expandedRuleName,
    expandedFileName,
    onCollapseToRoot,
  }: {
    expandedRuleName: string;
    expandedFileName: string;
    onCollapseToRoot: () => void;
    onCollapseFile: () => void;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "breadcrumbs" },
      React.createElement(
        "button",
        { "data-testid": "breadcrumb-root", onClick: onCollapseToRoot },
        expandedRuleName
      ),
      React.createElement("span", { "data-testid": "breadcrumb-file" }, expandedFileName)
    ),
}));

// Mock FileSourceView
vi.mock("../../../ui/components/Inspector/FileSourceView", () => ({
  FileSourceView: ({
    filePath,
    issues,
    selectedIssueId,
  }: {
    filePath: string;
    issues: Issue[];
    selectedIssueId: string | null;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "file-source-view" },
      `${filePath} (${issues.length} issues, selected: ${selectedIssueId ?? "none"})`
    ),
}));

// Mock icons
vi.mock("../../../ui/icons", () => ({
  SettingsIcon: (props: { size?: number }) =>
    React.createElement("span", { "data-testid": "settings-icon", ...props }),
}));

function createMockServices(
  issues: Issue[],
  rules: AvailableRule[] = []
): PluginServices {
  const issuesMap = new Map<string, Issue[]>();
  for (const issue of issues) {
    const existing = issuesMap.get(issue.dataLoc) || [];
    issuesMap.set(issue.dataLoc, [...existing, issue]);
  }

  return {
    getState: vi.fn(() => ({
      plugins: {
        eslint: {
          issues: issuesMap,
          availableRules: rules,
          disabledRules: new Set<string>(),
        },
      },
    })),
    setState: vi.fn(),
    websocket: {
      isConnected: false,
      url: "",
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
    openInspector: vi.fn(),
    closeInspector: vi.fn(),
    closeCommandPalette: vi.fn(),
  };
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "test-1",
    message: "Test issue message",
    severity: "warning",
    dataLoc: "src/App.tsx:10:5",
    ruleId: "uilint/semantic",
    pluginId: "eslint",
    filePath: "src/App.tsx",
    line: 10,
    ...overrides,
  };
}

describe("RulePreviewPanel", () => {
  afterEach(() => {
    cleanup();
    // Reset mock store state
    mockStoreState.plugins.eslint.ruleConfigs = new Map();
    mockStoreState.plugins.eslint.ruleConfigUpdating = new Map();
  });

  it("renders rule name and description", () => {
    const rules: AvailableRule[] = [
      {
        id: "uilint/semantic",
        name: "Semantic consistency",
        description: "Check semantic consistency across UI elements",
        category: "semantic",
        defaultSeverity: "warn",
      },
    ];
    const issues = [makeIssue()];
    const services = createMockServices(issues, rules);

    const { getByText } = render(
      <RulePreviewPanel ruleId="uilint/semantic" services={services} />
    );

    expect(getByText("Semantic consistency")).toBeTruthy();
    expect(getByText("Check semantic consistency across UI elements")).toBeTruthy();
  });

  it("shows severity badge", () => {
    const issues = [makeIssue({ severity: "error" })];
    const services = createMockServices(issues);

    const { getByText } = render(
      <RulePreviewPanel ruleId="uilint/semantic" services={services} />
    );

    expect(getByText("error")).toBeTruthy();
  });

  it("groups issues by file", () => {
    const issues = [
      makeIssue({ id: "i1", filePath: "src/A.tsx", dataLoc: "src/A.tsx:1:0" }),
      makeIssue({ id: "i2", filePath: "src/A.tsx", dataLoc: "src/A.tsx:5:0" }),
      makeIssue({ id: "i3", filePath: "src/B.tsx", dataLoc: "src/B.tsx:1:0" }),
    ];
    const services = createMockServices(issues);

    const { getByText } = render(
      <RulePreviewPanel ruleId="uilint/semantic" services={services} />
    );

    expect(getByText("A.tsx")).toBeTruthy();
    expect(getByText("B.tsx")).toBeTruthy();
  });

  it("shows issue and file counts", () => {
    const issues = [
      makeIssue({ id: "i1", filePath: "src/A.tsx", dataLoc: "src/A.tsx:1:0" }),
      makeIssue({ id: "i2", filePath: "src/B.tsx", dataLoc: "src/B.tsx:1:0" }),
    ];
    const services = createMockServices(issues);

    const { getByText } = render(
      <RulePreviewPanel ruleId="uilint/semantic" services={services} />
    );

    expect(getByText("2 issues")).toBeTruthy();
    expect(getByText("2 files")).toBeTruthy();
  });

  it("shows Configure button that opens RuleConfig in popover", () => {
    const rules: AvailableRule[] = [
      {
        id: "uilint/semantic",
        name: "Semantic consistency",
        description: "Check consistency",
        category: "semantic",
        defaultSeverity: "warn",
      },
    ];
    const issues = [makeIssue()];
    const services = createMockServices(issues, rules);

    const { getByText, queryByTestId } = render(
      <RulePreviewPanel ruleId="uilint/semantic" services={services} />
    );

    // Configure button should be visible
    const configureBtn = getByText("Configure");
    expect(configureBtn).toBeTruthy();

    // Popover content should not be visible initially
    expect(queryByTestId("popover-content")).toBeNull();

    // Click Configure to open popover
    fireEvent.click(configureBtn);

    // RuleConfig should now be visible inside popover
    expect(queryByTestId("popover-content")).toBeTruthy();
    expect(queryByTestId("rule-config")).toBeTruthy();
    expect(queryByTestId("config-rule-id")?.textContent).toBe("uilint/semantic");
    expect(queryByTestId("config-severity")?.textContent).toBe("warn");
  });

  it("calls pluginRegistry.setRuleSeverity on severity change", async () => {
    const { pluginRegistry } = await import("../../../core/plugin-system/registry");
    const rules: AvailableRule[] = [
      {
        id: "uilint/semantic",
        name: "Semantic consistency",
        description: "Check consistency",
        category: "semantic",
        defaultSeverity: "warn",
      },
    ];
    const issues = [makeIssue()];
    const services = createMockServices(issues, rules);

    const { getByText, getByTestId } = render(
      <RulePreviewPanel ruleId="uilint/semantic" services={services} />
    );

    // Open popover first
    fireEvent.click(getByText("Configure"));

    fireEvent.click(getByTestId("change-severity"));
    expect(pluginRegistry.setRuleSeverity).toHaveBeenCalledWith("uilint/semantic", "error");
  });

  it("shows inline severity toggle with Off/Warn/Error buttons", () => {
    const rules: AvailableRule[] = [
      {
        id: "uilint/semantic",
        name: "Semantic consistency",
        description: "Check consistency",
        category: "semantic",
        defaultSeverity: "warn",
      },
    ];
    const issues = [makeIssue()];
    const services = createMockServices(issues, rules);

    const { getByText } = render(
      <RulePreviewPanel ruleId="uilint/semantic" services={services} />
    );

    // All three severity buttons should be visible in the compact config row
    expect(getByText("Off")).toBeTruthy();
    expect(getByText("Warn")).toBeTruthy();
    expect(getByText("Error")).toBeTruthy();
  });

  it("calls severity change when toggle button is clicked", async () => {
    const { pluginRegistry } = await import("../../../core/plugin-system/registry");
    const rules: AvailableRule[] = [
      {
        id: "uilint/semantic",
        name: "Semantic consistency",
        description: "Check consistency",
        category: "semantic",
        defaultSeverity: "warn",
      },
    ];
    const issues = [makeIssue()];
    const services = createMockServices(issues, rules);

    const { getByText } = render(
      <RulePreviewPanel ruleId="uilint/semantic" services={services} />
    );

    // Click "Error" in the inline toggle
    fireEvent.click(getByText("Error"));
    expect(pluginRegistry.setRuleSeverity).toHaveBeenCalledWith("uilint/semantic", "error");
  });

  it("shows config tags for category", () => {
    const rules: AvailableRule[] = [
      {
        id: "uilint/semantic",
        name: "Semantic consistency",
        description: "Check consistency",
        category: "accessibility",
        defaultSeverity: "warn",
      },
    ];
    const issues = [makeIssue()];
    const services = createMockServices(issues, rules);

    const { getByText } = render(
      <RulePreviewPanel ruleId="uilint/semantic" services={services} />
    );

    // Category tag should be visible
    expect(getByText("accessibility")).toBeTruthy();
  });

  it("drills down to FileSourceView when issue is clicked", () => {
    const rules: AvailableRule[] = [
      {
        id: "uilint/semantic",
        name: "Semantic consistency",
        description: "Check consistency",
        category: "semantic",
        defaultSeverity: "warn",
      },
    ];
    const issues = [
      makeIssue({ id: "i1", filePath: "src/App.tsx", dataLoc: "src/App.tsx:10:5", message: "Issue one" }),
    ];
    const services = createMockServices(issues, rules);

    const { getByText, getByTestId, queryByText } = render(
      <RulePreviewPanel ruleId="uilint/semantic" services={services} />
    );

    // Click on the issue
    fireEvent.click(getByText("Issue one"));

    // Should show breadcrumbs
    expect(getByTestId("breadcrumbs")).toBeTruthy();
    expect(getByTestId("breadcrumb-root").textContent).toBe("Semantic consistency");
    expect(getByTestId("breadcrumb-file").textContent).toBe("App.tsx");

    // Should show FileSourceView
    const sourceView = getByTestId("file-source-view");
    expect(sourceView.textContent).toContain("src/App.tsx");
    expect(sourceView.textContent).toContain("1 issues");
    expect(sourceView.textContent).toContain("selected: i1");

    // Header and file groups should be gone
    expect(queryByText("Configure")).toBeNull();
  });

  it("navigates back from drill-down via breadcrumb click", () => {
    const rules: AvailableRule[] = [
      {
        id: "uilint/semantic",
        name: "Semantic consistency",
        description: "Check consistency",
        category: "semantic",
        defaultSeverity: "warn",
      },
    ];
    const issues = [
      makeIssue({ id: "i1", filePath: "src/App.tsx", dataLoc: "src/App.tsx:10:5", message: "Issue one" }),
    ];
    const services = createMockServices(issues, rules);

    const { getByText, getByTestId, queryByTestId } = render(
      <RulePreviewPanel ruleId="uilint/semantic" services={services} />
    );

    // Drill down
    fireEvent.click(getByText("Issue one"));
    expect(getByTestId("file-source-view")).toBeTruthy();

    // Click breadcrumb to go back
    fireEvent.click(getByTestId("breadcrumb-root"));

    // Should be back to rule view
    expect(queryByTestId("file-source-view")).toBeNull();
    expect(queryByTestId("breadcrumbs")).toBeNull();
    expect(getByText("Configure")).toBeTruthy();
    expect(getByText("Semantic consistency")).toBeTruthy();
  });
});
