/**
 * Tests for ElementDetail component
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ElementDetail } from "./ElementDetail";
import type { Issue } from "../../types";

// Mock the useIssues hook
vi.mock("../../hooks", () => ({
  useIssues: () => ({
    getIssuesForDataLoc: (dataLoc: string) => {
      if (dataLoc === "test.tsx:10:5") {
        return [{
          id: "issue-1",
          ruleId: "no-unused-vars",
          message: "Variable is unused",
          severity: "warning",
          line: 10,
          column: 5,
          dataLoc: "test.tsx:10:5",
          filePath: "test.tsx",
        }] as Issue[];
      }
      return [];
    },
  }),
}));

describe("ElementDetail", () => {
  it("renders issues for the given dataLoc", () => {
    const { container } = render(
      <ElementDetail dataLoc="test.tsx:10:5" onSelectIssue={() => {}} />
    );

    // Component should render and have content
    expect(container.firstChild).toBeTruthy();
    expect(container.textContent).toContain("issue");
  });

  it("shows empty state when no issues", () => {
    const { container } = render(
      <ElementDetail dataLoc="other.tsx:1:1" onSelectIssue={() => {}} />
    );

    expect(container.textContent).toContain("No issues");
  });
});
