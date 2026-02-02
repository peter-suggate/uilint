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
});
