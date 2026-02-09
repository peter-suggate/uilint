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

  it("renders RuleConfig with correct props", () => {
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

    const { getByTestId } = render(
      <RulePreviewPanel ruleId="uilint/semantic" services={services} />
    );

    expect(getByTestId("rule-config")).toBeTruthy();
    expect(getByTestId("config-rule-id").textContent).toBe("uilint/semantic");
    expect(getByTestId("config-severity").textContent).toBe("warn");
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

    const { getByTestId } = render(
      <RulePreviewPanel ruleId="uilint/semantic" services={services} />
    );

    fireEvent.click(getByTestId("change-severity"));
    expect(pluginRegistry.setRuleSeverity).toHaveBeenCalledWith("uilint/semantic", "error");
  });
});
