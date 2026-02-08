/**
 * Tests for FilePreviewPanel
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { FilePreviewPanel } from "./FilePreviewPanel";
import type { PluginServices } from "../../../core/plugin-system/types";
import type { Issue } from "../../../ui/types";

// Mock FileSourceView since it requires WebSocket/source fetching
vi.mock("../../../ui/components/Inspector/FileSourceView", () => ({
  FileSourceView: ({ filePath, issues }: { filePath: string; issues: Issue[] }) =>
    React.createElement("div", { "data-testid": "file-source-view" }, `${filePath} (${issues.length} issues)`),
}));

function createMockServices(issues: Issue[]): PluginServices {
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
          availableRules: [],
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
    message: "Test issue",
    severity: "warning",
    dataLoc: "src/App.tsx:10:5",
    ruleId: "test/rule",
    pluginId: "eslint",
    filePath: "src/App.tsx",
    line: 10,
    ...overrides,
  };
}

describe("FilePreviewPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders filename header", () => {
    const issues = [makeIssue({ filePath: "src/components/Button.tsx", dataLoc: "src/components/Button.tsx:10:5" })];
    const services = createMockServices(issues);

    const { getByText } = render(
      <FilePreviewPanel filePath="src/components/Button.tsx" services={services} />
    );

    expect(getByText("Button.tsx")).toBeTruthy();
    expect(getByText("src/components/Button.tsx")).toBeTruthy();
  });

  it("renders FileSourceView with issues", () => {
    const issues = [
      makeIssue({ filePath: "src/App.tsx", id: "i1", dataLoc: "src/App.tsx:10:5" }),
      makeIssue({ filePath: "src/App.tsx", id: "i2", dataLoc: "src/App.tsx:20:5" }),
    ];
    const services = createMockServices(issues);

    const { getByTestId } = render(
      <FilePreviewPanel filePath="src/App.tsx" services={services} />
    );

    expect(getByTestId("file-source-view").textContent).toContain("2 issues");
  });

  it("shows no issues message when file has none", () => {
    const services = createMockServices([]);

    const { getByText } = render(
      <FilePreviewPanel filePath="src/Empty.tsx" services={services} />
    );

    expect(getByText("No issues in this file")).toBeTruthy();
  });
});
