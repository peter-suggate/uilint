/**
 * Tests for CodeRegion component
 *
 * CodeRegion renders a contiguous block of source code lines
 * with inline issue annotations.
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { CodeRegion } from "./CodeRegion";
import type { Issue } from "../../types";

// Mock motion/react to avoid animation issues in tests
vi.mock("motion/react", () => {
  const React = require("react");
  const motion = new Proxy(
    {},
    {
      get(_target: unknown, prop: string) {
        return React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
          const filtered: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(props)) {
            if (
              ![
                "initial",
                "animate",
                "exit",
                "transition",
                "whileHover",
                "whileTap",
                "layout",
                "layoutId",
                "variants",
              ].includes(key)
            ) {
              filtered[key] = val;
            }
          }
          return React.createElement(prop, { ...filtered, ref });
        });
      },
    }
  );
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion,
  };
});

// Test helper to create mock issues
function createMockIssue(line: number, overrides: Partial<Issue> = {}): Issue {
  return {
    id: `test-issue-${line}`,
    message: `Issue at line ${line}`,
    severity: "warning",
    dataLoc: `file.tsx:${line}:1`,
    ruleId: "test-rule",
    pluginId: "eslint",
    filePath: "src/file.tsx",
    line,
    column: 1,
    ...overrides,
  };
}

describe("CodeRegion", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all code lines", () => {
    const lines = ["const a = 1;", "const b = 2;", "const c = 3;"];
    const { container } = render(
      <CodeRegion
        lines={lines}
        startLine={1}
        issues={[]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    expect(container.textContent).toContain("const a = 1;");
    expect(container.textContent).toContain("const b = 2;");
    expect(container.textContent).toContain("const c = 3;");
  });

  it("renders correct line numbers", () => {
    const lines = ["line one", "line two", "line three"];
    const { container } = render(
      <CodeRegion
        lines={lines}
        startLine={10}
        issues={[]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    expect(container.textContent).toContain("10");
    expect(container.textContent).toContain("11");
    expect(container.textContent).toContain("12");
  });

  it("renders issue annotations for lines with issues", () => {
    const lines = ["const a = 1;", "const b = 2;", "const c = 3;"];
    const issue = createMockIssue(2, { message: "Unused variable b" });

    const { container } = render(
      <CodeRegion
        lines={lines}
        startLine={1}
        issues={[issue]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Unused variable b");
  });

  it("renders multiple issue annotations on the same line", () => {
    const lines = ["const a = 1;"];
    const issue1 = createMockIssue(1, {
      id: "issue-1",
      message: "First issue",
      ruleId: "rule-a",
    });
    const issue2 = createMockIssue(1, {
      id: "issue-2",
      message: "Second issue",
      ruleId: "rule-b",
    });

    const { container } = render(
      <CodeRegion
        lines={lines}
        startLine={1}
        issues={[issue1, issue2]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    expect(container.textContent).toContain("First issue");
    expect(container.textContent).toContain("Second issue");
  });

  it("calls onIssueSelect when an issue annotation is clicked", () => {
    const lines = ["const a = 1;"];
    const issue = createMockIssue(1, { id: "issue-to-select" });
    const onIssueSelect = vi.fn();

    const { container } = render(
      <CodeRegion
        lines={lines}
        startLine={1}
        issues={[issue]}
        selectedIssueId={null}
        onIssueSelect={onIssueSelect}
      />
    );

    // Find the issue annotation element - it's the div with the border and severity styling
    // that contains the issue message. We need to find the clickable parent div.
    const elements = container.querySelectorAll("div");
    // The annotation is a div with cursor-pointer class that contains the message
    const annotation = Array.from(elements).find((el) => {
      const hasMessage = el.textContent?.includes("Issue at line 1");
      const isCursorPointer = el.className.includes("cursor-pointer");
      return hasMessage && isCursorPointer;
    });
    expect(annotation).toBeTruthy();

    fireEvent.click(annotation!);
    expect(onIssueSelect).toHaveBeenCalledWith("issue-to-select");
  });

  it("applies severity styling to lines with issues", () => {
    const lines = ["error line", "warning line", "info line"];
    const errorIssue = createMockIssue(1, { severity: "error" });
    const warningIssue = createMockIssue(2, { severity: "warning" });
    const infoIssue = createMockIssue(3, { severity: "info" });

    const { container } = render(
      <CodeRegion
        lines={lines}
        startLine={1}
        issues={[errorIssue, warningIssue, infoIssue]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    // Check that severity classes are applied
    const html = container.innerHTML;
    expect(html).toContain("bg-error");
    expect(html).toContain("bg-warning");
    expect(html).toContain("bg-info");
  });

  it("renders empty lines as a space", () => {
    const lines = ["", "content", ""];
    const { container } = render(
      <CodeRegion
        lines={lines}
        startLine={1}
        issues={[]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    // Empty lines should still be rendered (preserving structure)
    const codeElements = container.querySelectorAll("code");
    expect(codeElements).toHaveLength(3);
  });

  it("preserves whitespace in code", () => {
    const lines = ["    const indented = true;"];
    const { container } = render(
      <CodeRegion
        lines={lines}
        startLine={1}
        issues={[]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    const code = container.querySelector("code");
    expect(code?.textContent).toContain("    const indented = true;");
  });

  it("respects custom gutterWidth", () => {
    const lines = ["test"];
    const { container } = render(
      <CodeRegion
        lines={lines}
        startLine={1}
        issues={[]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
        gutterWidth={80}
      />
    );

    // Find the gutter span
    const spans = container.querySelectorAll("span");
    const gutterSpan = Array.from(spans).find(
      (s) => s.style.width === "80px"
    );
    expect(gutterSpan).toBeTruthy();
  });

  it("applies custom className", () => {
    const lines = ["test"];
    const { container } = render(
      <CodeRegion
        lines={lines}
        startLine={1}
        issues={[]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
        className="custom-class"
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("custom-class");
  });

  it("passes selectedIssueId to issue annotations", () => {
    const lines = ["test"];
    const issue = createMockIssue(1, { id: "selected-issue" });

    const { container } = render(
      <CodeRegion
        lines={lines}
        startLine={1}
        issues={[issue]}
        selectedIssueId="selected-issue"
        onIssueSelect={vi.fn()}
      />
    );

    // The selected annotation should have a ring class
    const html = container.innerHTML;
    expect(html).toContain("ring-");
  });

  // ============================================================================
  // Tests for issue collapsing behavior
  // ============================================================================

  describe("issue collapsing when another issue is selected", () => {
    it("shows all issues in full when no issue is selected", () => {
      const lines = ["line 1", "line 2", "line 3"];
      const issue1 = createMockIssue(1, { id: "issue-1", message: "First issue message" });
      const issue2 = createMockIssue(2, { id: "issue-2", message: "Second issue message" });
      const issue3 = createMockIssue(3, { id: "issue-3", message: "Third issue message" });

      const { container } = render(
        <CodeRegion
          lines={lines}
          startLine={1}
          issues={[issue1, issue2, issue3]}
          selectedIssueId={null}
          onIssueSelect={vi.fn()}
        />
      );

      // All issue messages should be visible
      expect(container.textContent).toContain("First issue message");
      expect(container.textContent).toContain("Second issue message");
      expect(container.textContent).toContain("Third issue message");
    });

    it("collapses non-selected issues when an issue is selected", () => {
      const lines = ["line 1", "line 2", "line 3"];
      const issue1 = createMockIssue(1, { id: "issue-1", message: "First issue message" });
      const issue2 = createMockIssue(2, { id: "issue-2", message: "Second issue message" });
      const issue3 = createMockIssue(3, { id: "issue-3", message: "Third issue message" });

      const { container } = render(
        <CodeRegion
          lines={lines}
          startLine={1}
          issues={[issue1, issue2, issue3]}
          selectedIssueId="issue-2"
          onIssueSelect={vi.fn()}
        />
      );

      // Selected issue should show full message
      expect(container.textContent).toContain("Second issue message");

      // Non-selected issues should be collapsed (showing line indicators like "L1", "L3")
      // and their full messages should NOT be visible in the main content
      const html = container.innerHTML;
      expect(html).toContain("L1"); // Line indicator for collapsed issue 1
      expect(html).toContain("L3"); // Line indicator for collapsed issue 3
    });

    it("collapsed issue indicators are clickable", () => {
      const lines = ["line 1", "line 2"];
      const issue1 = createMockIssue(1, { id: "issue-1", message: "First issue" });
      const issue2 = createMockIssue(2, { id: "issue-2", message: "Second issue" });
      const onIssueSelect = vi.fn();

      const { container } = render(
        <CodeRegion
          lines={lines}
          startLine={1}
          issues={[issue1, issue2]}
          selectedIssueId="issue-2"
          onIssueSelect={onIssueSelect}
        />
      );

      // Find the collapsed indicator button (should contain "L1")
      const buttons = container.querySelectorAll("button");
      const collapsedIndicator = Array.from(buttons).find(
        (btn) => btn.textContent?.includes("L1")
      );
      expect(collapsedIndicator).toBeTruthy();

      // Click it
      fireEvent.click(collapsedIndicator!);
      expect(onIssueSelect).toHaveBeenCalledWith("issue-1");
    });

    it("shows full annotation for the selected issue", () => {
      const lines = ["line 1"];
      const issue = createMockIssue(1, { id: "issue-1", message: "Important issue message" });

      const { container } = render(
        <CodeRegion
          lines={lines}
          startLine={1}
          issues={[issue]}
          selectedIssueId="issue-1"
          onIssueSelect={vi.fn()}
        />
      );

      // The full message should be visible (not just a line indicator)
      expect(container.textContent).toContain("Important issue message");
      // Should not have a collapsed line indicator style "L1" badge
      // (the line number appears in gutter, but not as "L1" badge)
      const buttons = container.querySelectorAll("button");
      const hasCollapsedIndicator = Array.from(buttons).some(
        (btn) => btn.textContent?.trim() === "L1"
      );
      expect(hasCollapsedIndicator).toBe(false);
    });

    it("collapses issues with different severities correctly", () => {
      const lines = ["line 1", "line 2", "line 3"];
      const errorIssue = createMockIssue(1, { id: "issue-error", severity: "error" });
      const warningIssue = createMockIssue(2, { id: "issue-warning", severity: "warning" });
      const infoIssue = createMockIssue(3, { id: "issue-info", severity: "info" });

      const { container } = render(
        <CodeRegion
          lines={lines}
          startLine={1}
          issues={[errorIssue, warningIssue, infoIssue]}
          selectedIssueId="issue-warning"
          onIssueSelect={vi.fn()}
        />
      );

      // Collapsed indicators should still show severity colors
      const html = container.innerHTML;
      // The error and info issues are collapsed, they should still have severity styling
      expect(html).toContain("L1"); // Error issue collapsed
      expect(html).toContain("L3"); // Info issue collapsed
      // Severity classes should be present for the collapsed indicators
      expect(html).toContain("bg-error");
      expect(html).toContain("bg-info");
    });
  });
});
