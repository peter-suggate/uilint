/**
 * Tests for CollapsedIssueIndicator component
 *
 * CollapsedIssueIndicator shows a minimal view of an issue when another
 * issue is selected, helping users focus on the selected issue.
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { CollapsedIssueIndicator } from "./CollapsedIssueIndicator";
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

describe("CollapsedIssueIndicator", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the line number badge", () => {
    const issue = createMockIssue(42);

    const { container } = render(
      <CollapsedIssueIndicator issue={issue} onSelect={vi.fn()} />
    );

    expect(container.textContent).toContain("L42");
  });

  it("renders as a button for accessibility", () => {
    const issue = createMockIssue(10);

    const { container } = render(
      <CollapsedIssueIndicator issue={issue} onSelect={vi.fn()} />
    );

    const button = container.querySelector("button");
    expect(button).toBeTruthy();
  });

  it("calls onSelect when clicked", () => {
    const issue = createMockIssue(5);
    const onSelect = vi.fn();

    const { container } = render(
      <CollapsedIssueIndicator issue={issue} onSelect={onSelect} />
    );

    const button = container.querySelector("button");
    fireEvent.click(button!);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("applies error severity styling", () => {
    const issue = createMockIssue(1, { severity: "error" });

    const { container } = render(
      <CollapsedIssueIndicator issue={issue} onSelect={vi.fn()} />
    );

    const html = container.innerHTML;
    expect(html).toContain("bg-error");
    expect(html).toContain("border-error");
  });

  it("applies warning severity styling", () => {
    const issue = createMockIssue(1, { severity: "warning" });

    const { container } = render(
      <CollapsedIssueIndicator issue={issue} onSelect={vi.fn()} />
    );

    const html = container.innerHTML;
    expect(html).toContain("bg-warning");
    expect(html).toContain("border-warning");
  });

  it("applies info severity styling", () => {
    const issue = createMockIssue(1, { severity: "info" });

    const { container } = render(
      <CollapsedIssueIndicator issue={issue} onSelect={vi.fn()} />
    );

    const html = container.innerHTML;
    expect(html).toContain("bg-info");
    expect(html).toContain("border-info");
  });

  it("has proper aria-label for accessibility", () => {
    const issue = createMockIssue(7, { message: "Unused variable" });

    const { container } = render(
      <CollapsedIssueIndicator issue={issue} onSelect={vi.fn()} />
    );

    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-label")).toContain("Issue on line 7");
    expect(button?.getAttribute("aria-label")).toContain("Unused variable");
  });

  it("respects custom gutterWidth", () => {
    const issue = createMockIssue(1);

    const { container } = render(
      <CollapsedIssueIndicator
        issue={issue}
        onSelect={vi.fn()}
        gutterWidth={80}
      />
    );

    const button = container.querySelector("button");
    expect(button?.style.marginLeft).toBe("88px"); // gutterWidth + 8
  });

  it("applies custom className", () => {
    const issue = createMockIssue(1);

    const { container } = render(
      <CollapsedIssueIndicator
        issue={issue}
        onSelect={vi.fn()}
        className="custom-class"
      />
    );

    const button = container.querySelector("button");
    expect(button?.className).toContain("custom-class");
  });

  it("shows severity dot indicator", () => {
    const issue = createMockIssue(1, { severity: "error" });

    const { container } = render(
      <CollapsedIssueIndicator issue={issue} onSelect={vi.fn()} />
    );

    // Should have a small dot div with severity color
    const dots = container.querySelectorAll("div");
    const severityDot = Array.from(dots).find(
      (div) =>
        div.className.includes("rounded-full") && div.className.includes("w-1.5")
    );
    expect(severityDot).toBeTruthy();
    expect(severityDot?.className).toContain("bg-error");
  });
});
