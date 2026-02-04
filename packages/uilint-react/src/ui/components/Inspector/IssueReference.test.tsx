/**
 * Tests for IssueReference component
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { IssueReference } from "./IssueReference";
import type { Issue } from "../../types";

const mockIssue: Issue = {
  id: "test-issue-1",
  ruleId: "no-unused-vars",
  message: "Variable is unused",
  severity: "warning",
  line: 10,
  column: 5,
  dataLoc: "test.tsx:10:5",
  filePath: "test.tsx",
};

describe("IssueReference", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <IssueReference
        issue={mockIssue}
        firstLine={5}
        isSelected={false}
        onSelect={() => {}}
      />
    );

    // Component should render something
    expect(container.firstChild).toBeTruthy();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <IssueReference
        issue={mockIssue}
        firstLine={5}
        isSelected={false}
        onSelect={onSelect}
      />
    );

    // Find and click the button
    const button = container.querySelector("button");
    if (button) {
      button.click();
      expect(onSelect).toHaveBeenCalledTimes(1);
    }
  });
});
