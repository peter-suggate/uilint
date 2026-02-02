/**
 * Tests for IssueAnnotation component
 *
 * IssueAnnotation displays issue details inline below a code line
 * with severity-based styling.
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { IssueAnnotation } from "./IssueAnnotation";
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
function createMockIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "test-issue-1",
    message: "Test issue message",
    severity: "warning",
    dataLoc: "file.tsx:10:1",
    ruleId: "test-rule",
    pluginId: "eslint",
    filePath: "src/file.tsx",
    line: 10,
    column: 1,
    ...overrides,
  };
}

describe("IssueAnnotation", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the issue message", () => {
    const issue = createMockIssue({ message: "Custom error message" });
    const { container } = render(
      <IssueAnnotation
        issue={issue}
        isSelected={false}
        onSelect={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Custom error message");
  });

  it("does not display rule ID (removed for cleaner design)", () => {
    const issue = createMockIssue({
      ruleId: "@typescript-eslint/no-unused-vars",
    });
    const { container } = render(
      <IssueAnnotation
        issue={issue}
        isSelected={false}
        onSelect={vi.fn()}
      />
    );

    // Rule badge removed for cleaner UI - rule context provided by parent components
    expect(container.textContent).not.toContain("no-unused-vars");
    expect(container.textContent).not.toContain("@typescript-eslint/");
  });

  it("only displays message content, not rule metadata", () => {
    const issue = createMockIssue({ ruleId: "no-console", message: "Unexpected console statement" });
    const { container } = render(
      <IssueAnnotation
        issue={issue}
        isSelected={false}
        onSelect={vi.fn()}
      />
    );

    // Should only contain the message, not the rule ID
    expect(container.textContent).toContain("Unexpected console statement");
    expect(container.textContent).not.toContain("no-console");
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    const issue = createMockIssue();
    const { container } = render(
      <IssueAnnotation
        issue={issue}
        isSelected={false}
        onSelect={onSelect}
      />
    );

    const element = container.firstElementChild;
    expect(element).toBeTruthy();

    fireEvent.click(element!);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("applies error severity styling", () => {
    const issue = createMockIssue({ severity: "error" });
    const { container } = render(
      <IssueAnnotation
        issue={issue}
        isSelected={false}
        onSelect={vi.fn()}
      />
    );

    const element = container.firstElementChild as HTMLElement;
    expect(element.className).toContain("border-error");
    expect(element.className).toContain("bg-error");
  });

  it("applies warning severity styling", () => {
    const issue = createMockIssue({ severity: "warning" });
    const { container } = render(
      <IssueAnnotation
        issue={issue}
        isSelected={false}
        onSelect={vi.fn()}
      />
    );

    const element = container.firstElementChild as HTMLElement;
    expect(element.className).toContain("border-warning");
    expect(element.className).toContain("bg-warning");
  });

  it("applies info severity styling", () => {
    const issue = createMockIssue({ severity: "info" });
    const { container } = render(
      <IssueAnnotation
        issue={issue}
        isSelected={false}
        onSelect={vi.fn()}
      />
    );

    const element = container.firstElementChild as HTMLElement;
    expect(element.className).toContain("border-info");
    expect(element.className).toContain("bg-info");
  });

  it("applies selected styling when isSelected is true", () => {
    const issue = createMockIssue();
    const { container } = render(
      <IssueAnnotation
        issue={issue}
        isSelected={true}
        onSelect={vi.fn()}
      />
    );

    const element = container.firstElementChild as HTMLElement;
    expect(element.className).toContain("ring-");
  });

  it("does not apply selected styling when isSelected is false", () => {
    const issue = createMockIssue();
    const { container } = render(
      <IssueAnnotation
        issue={issue}
        isSelected={false}
        onSelect={vi.fn()}
      />
    );

    const element = container.firstElementChild as HTMLElement;
    // Should not have ring class when not selected
    expect(element.className).not.toContain("ring-1");
  });

  it("respects custom gutterWidth", () => {
    const issue = createMockIssue();
    const { container } = render(
      <IssueAnnotation
        issue={issue}
        isSelected={false}
        onSelect={vi.fn()}
        gutterWidth={60}
      />
    );

    // The container uses marginLeft based on gutterWidth + 8
    const element = container.firstElementChild as HTMLElement;
    expect(element.style.marginLeft).toBe("68px");
  });

  it("applies custom className", () => {
    const issue = createMockIssue();
    const { container } = render(
      <IssueAnnotation
        issue={issue}
        isSelected={false}
        onSelect={vi.fn()}
        className="custom-class"
      />
    );

    const element = container.firstElementChild as HTMLElement;
    expect(element.className).toContain("custom-class");
  });
});
