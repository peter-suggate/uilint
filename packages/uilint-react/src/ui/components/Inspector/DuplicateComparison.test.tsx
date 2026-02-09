/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { DuplicateComparison } from "./DuplicateComparison";
import type { Issue } from "../../types";

// Mock motion/react to avoid animation complexity in tests
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

function createDuplicateIssue(overrides?: Partial<Issue>): Issue {
  return {
    id: "eslint:no-duplicates:test.tsx:10:0:10",
    message: "This component 'UserCard' is 85% similar to 'ProfileCard'",
    severity: "warning",
    dataLoc: "test.tsx:10:0",
    ruleId: "no-duplicates",
    pluginId: "eslint",
    filePath: "test.tsx",
    line: 10,
    metadata: {
      sourceCode: "function UserCard() {\n  return <div>User</div>;\n}",
      targetCode: "function ProfileCard() {\n  return <div>Profile</div>;\n}",
      sourceLocation: JSON.stringify({
        filePath: "src/UserCard.tsx",
        startLine: 10,
        endLine: 12,
      }),
      targetLocation: JSON.stringify({
        filePath: "src/ProfileCard.tsx",
        startLine: 5,
        endLine: 7,
      }),
      sourceName: "UserCard",
      targetName: "ProfileCard",
      similarity: "85",
      kind: "component",
    },
    ...overrides,
  };
}

describe("DuplicateComparison", () => {
  it("renders similarity badge", () => {
    render(<DuplicateComparison issue={createDuplicateIssue()} />);
    expect(screen.getByText("85% similar")).toBeTruthy();
  });

  it("renders source and target names", () => {
    render(<DuplicateComparison issue={createDuplicateIssue()} />);
    expect(screen.getByText("UserCard")).toBeTruthy();
    expect(screen.getByText("ProfileCard")).toBeTruthy();
  });

  it("renders code viewer labels", () => {
    render(<DuplicateComparison issue={createDuplicateIssue()} />);
    expect(screen.getByText("This Code")).toBeTruthy();
    expect(screen.getByText("Similar Code")).toBeTruthy();
  });

  it("renders kind label", () => {
    render(<DuplicateComparison issue={createDuplicateIssue()} />);
    expect(screen.getByText("component")).toBeTruthy();
  });

  it("shows ignore button when onIgnore provided", () => {
    const onIgnore = vi.fn();
    render(
      <DuplicateComparison
        issue={createDuplicateIssue()}
        onIgnore={onIgnore}
      />
    );
    const ignoreButton = screen.getByText("Ignore");
    expect(ignoreButton).toBeTruthy();

    fireEvent.click(ignoreButton);
    expect(onIgnore).toHaveBeenCalledWith(
      "eslint:no-duplicates:test.tsx:10:0:10"
    );
  });

  it("shows restore button when ignored", () => {
    render(
      <DuplicateComparison
        issue={createDuplicateIssue()}
        onIgnore={vi.fn()}
        isIgnored={true}
      />
    );
    expect(screen.getByText("Restore")).toBeTruthy();
  });

  it("handles missing metadata gracefully", () => {
    const issue = createDuplicateIssue({ metadata: undefined });
    render(<DuplicateComparison issue={issue} />);
    expect(
      screen.getByText("No code comparison data available for this issue.")
    ).toBeTruthy();
  });
});
