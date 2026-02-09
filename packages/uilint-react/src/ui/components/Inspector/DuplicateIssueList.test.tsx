/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { DuplicateIssueList } from "./DuplicateIssueList";
import type { Issue } from "../../types";

// Mock motion/react
vi.mock("motion/react", () => {
  const React = require("react");
  const motion = new Proxy(
    {},
    {
      get(_target: unknown, prop: string) {
        return React.forwardRef(
          (props: Record<string, unknown>, ref: unknown) => {
            const filtered: Record<string, unknown> = {};
            for (const [key, val] of Object.entries(props)) {
              if (
                !["initial", "animate", "exit", "transition", "layoutId"].includes(key)
              ) {
                filtered[key] = val;
              }
            }
            return React.createElement(prop, { ...filtered, ref });
          }
        );
      },
    }
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

afterEach(cleanup);

function createIssue(id: string, similarity: string, sourceName: string, targetName: string): Issue {
  return {
    id,
    message: `This component '${sourceName}' is ${similarity}% similar to '${targetName}'`,
    severity: "warning",
    dataLoc: `test.tsx:${id}:0`,
    ruleId: "no-duplicates",
    pluginId: "eslint",
    filePath: "test.tsx",
    line: parseInt(id),
    metadata: {
      sourceCode: `function ${sourceName}() { return <div />; }`,
      targetCode: `function ${targetName}() { return <div />; }`,
      sourceLocation: JSON.stringify({ filePath: "test.tsx", startLine: 1, endLine: 3 }),
      targetLocation: JSON.stringify({ filePath: "other.tsx", startLine: 1, endLine: 3 }),
      sourceName,
      targetName,
      similarity,
      kind: "component",
    },
  };
}

const issues: Issue[] = [
  createIssue("10", "85", "UserCard", "ProfileCard"),
  createIssue("20", "78", "useAuth", "useSession"),
  createIssue("30", "92", "Button", "PrimaryButton"),
];

describe("DuplicateIssueList", () => {
  it("renders the correct number of pair cards", () => {
    render(
      <DuplicateIssueList
        issues={issues}
        selectedIssueId={null}
        onIssueClick={vi.fn()}
      />
    );

    // All three pairs should be visible
    expect(screen.getByText("UserCard")).toBeTruthy();
    expect(screen.getByText("useAuth")).toBeTruthy();
    expect(screen.getByText("Button")).toBeTruthy();
  });

  it("sorts by similarity descending", () => {
    const { container } = render(
      <DuplicateIssueList
        issues={issues}
        selectedIssueId={null}
        onIssueClick={vi.fn()}
      />
    );

    // The percentages should appear in descending order: 92%, 85%, 78%
    const percentages = container.querySelectorAll(".tabular-nums");
    const texts = Array.from(percentages).map((el) => el.textContent);
    expect(texts).toEqual(["92%", "85%", "78%"]);
  });

  it("shows summary count", () => {
    render(
      <DuplicateIssueList
        issues={issues}
        selectedIssueId={null}
        onIssueClick={vi.fn()}
      />
    );

    expect(screen.getByText("3 duplicates found")).toBeTruthy();
  });

  it("calls onIssueClick when a card is clicked", () => {
    const onIssueClick = vi.fn();
    render(
      <DuplicateIssueList
        issues={issues}
        selectedIssueId={null}
        onIssueClick={onIssueClick}
      />
    );

    fireEvent.click(screen.getByText("UserCard"));
    expect(onIssueClick).toHaveBeenCalled();
  });

  it("hides ignored issues when showIgnored is false", () => {
    const ignored = new Set(["10"]);
    render(
      <DuplicateIssueList
        issues={issues}
        selectedIssueId={null}
        onIssueClick={vi.fn()}
        ignoredIssueIds={ignored}
        showIgnored={false}
      />
    );

    expect(screen.queryByText("UserCard")).toBeNull();
    expect(screen.getByText("useAuth")).toBeTruthy();
  });

  it("shows ignored issues when showIgnored is true", () => {
    const ignored = new Set(["10"]);
    render(
      <DuplicateIssueList
        issues={issues}
        selectedIssueId={null}
        onIssueClick={vi.fn()}
        ignoredIssueIds={ignored}
        showIgnored={true}
      />
    );

    expect(screen.getByText("UserCard")).toBeTruthy();
  });

  it("displays ignored count badge", () => {
    const ignored = new Set(["10", "20"]);
    render(
      <DuplicateIssueList
        issues={issues}
        selectedIssueId={null}
        onIssueClick={vi.fn()}
        ignoredIssueIds={ignored}
        showIgnored={false}
      />
    );

    expect(screen.getByText("2 ignored")).toBeTruthy();
  });

  it("renders empty state when all are ignored", () => {
    const ignored = new Set(["10", "20", "30"]);
    render(
      <DuplicateIssueList
        issues={issues}
        selectedIssueId={null}
        onIssueClick={vi.fn()}
        ignoredIssueIds={ignored}
        showIgnored={false}
      />
    );

    expect(
      screen.getByText("All duplicates in this file are ignored.")
    ).toBeTruthy();
  });
});
