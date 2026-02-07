/**
 * Tests for RuleToggleBar component
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { RuleToggleBar } from "./RuleToggleBar";

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
            if (!["initial", "animate", "exit", "transition", "whileHover", "whileTap", "layout", "variants"].includes(key)) {
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

// Mock the store
const mockToggleRule = vi.fn();
const mockStoreState = {
  plugins: {
    eslint: {
      availableRules: [
        { id: "uilint/prefer-tailwind", name: "prefer-tailwind" },
        { id: "uilint/no-inline-styles", name: "no-inline-styles" },
      ],
      disabledRules: new Set<string>(),
      toggleRule: mockToggleRule,
      issues: new Map(),
    },
  },
};

vi.mock("../../../core/store", () => ({
  useComposedStore: (selector?: (s: unknown) => unknown) => {
    if (selector) return selector(mockStoreState);
    return mockStoreState;
  },
}));

describe("RuleToggleBar", () => {
  afterEach(() => {
    cleanup();
    mockToggleRule.mockClear();
  });

  it("renders rule toggle buttons for available rules", () => {
    const { container } = render(<RuleToggleBar />);

    expect(container.textContent).toContain("prefer-tailwind");
    expect(container.textContent).toContain("no-inline-styles");
  });

  it("calls toggleRule when a button is clicked", () => {
    const { container } = render(<RuleToggleBar />);

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);

    fireEvent.click(buttons[0]);
    expect(mockToggleRule).toHaveBeenCalledWith("uilint/prefer-tailwind");
  });

  it("renders nothing when no rules are available", () => {
    const originalRules = mockStoreState.plugins.eslint.availableRules;
    mockStoreState.plugins.eslint.availableRules = [];

    const { container } = render(<RuleToggleBar />);
    expect(container.innerHTML).toBe("");

    mockStoreState.plugins.eslint.availableRules = originalRules;
  });

  it("shows issue count badges when issues exist", () => {
    const originalIssues = mockStoreState.plugins.eslint.issues;
    mockStoreState.plugins.eslint.issues = new Map([
      ["file1.tsx", [{ ruleId: "uilint/prefer-tailwind", id: "1", message: "test", severity: "warning" as const }]],
    ]);

    const { container } = render(<RuleToggleBar />);
    expect(container.textContent).toContain("1");

    mockStoreState.plugins.eslint.issues = originalIssues;
  });
});
