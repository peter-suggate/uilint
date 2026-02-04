/**
 * Tests for IssueSummaryView component
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { IssueSummaryView } from "./IssueSummaryView";
import type { Issue } from "../../types";

const mockIssues: Issue[] = [
  {
    id: "issue-1",
    ruleId: "no-unused-vars",
    message: "Variable x is unused",
    severity: "warning",
    line: 10,
    column: 5,
    dataLoc: "test.tsx:10:5",
    filePath: "src/test.tsx",
  },
];

describe("IssueSummaryView", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <IssueSummaryView
        filePath="src/test.tsx"
        fileName="test.tsx"
        directory="src"
        issues={mockIssues}
        selectedIssueId={null}
        onIssueClick={() => {}}
        onShowFullSource={() => {}}
        onBack={() => {}}
      />
    );

    expect(container.firstChild).toBeTruthy();
  });

  it("renders issues in the list", () => {
    const { container } = render(
      <IssueSummaryView
        filePath="src/test.tsx"
        fileName="test.tsx"
        issues={mockIssues}
        selectedIssueId={null}
        onIssueClick={() => {}}
        onShowFullSource={() => {}}
        onBack={() => {}}
      />
    );

    // Should have buttons for issues
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});
