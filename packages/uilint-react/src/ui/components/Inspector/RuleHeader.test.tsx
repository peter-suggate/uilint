/**
 * Tests for RuleHeader component
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { RuleHeader } from "./RuleHeader";
import type { TileFilter } from "../../../core/plugin-system/types";

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

describe("RuleHeader", () => {
  const mockRuleFilter: TileFilter = {
    type: "rule",
    id: "uilint/no-console",
    label: "no-console",
  };

  beforeEach(() => {
    // Create portal root for Popover
    const portalRoot = document.createElement("div");
    portalRoot.id = "uilint-portal";
    document.body.appendChild(portalRoot);
  });

  afterEach(() => {
    cleanup();
    // Clean up portal root
    const portalRoot = document.getElementById("uilint-portal");
    if (portalRoot) {
      document.body.removeChild(portalRoot);
    }
  });

  describe("Rendering", () => {
    it("renders with rule filter", () => {
      const onClear = vi.fn();
      render(
        <RuleHeader
          ruleFilter={mockRuleFilter}
          onClear={onClear}
        />
      );

      // Should render the namespace from the rule ID
      expect(screen.getByText("uilint")).toBeTruthy();
    });

    it("renders category when provided", () => {
      const onClear = vi.fn();
      render(
        <RuleHeader
          ruleFilter={{ ...mockRuleFilter, id: "no-console" }}
          category="Best Practices"
          onClear={onClear}
        />
      );

      expect(screen.getByText("Best Practices")).toBeTruthy();
    });

    it("renders Info button when description is provided", () => {
      const onClear = vi.fn();
      render(
        <RuleHeader
          ruleFilter={mockRuleFilter}
          description="Disallow console statements"
          onClear={onClear}
        />
      );

      expect(screen.getByText("Info")).toBeTruthy();
    });

    it("renders Docs link when docsUrl is provided", () => {
      const onClear = vi.fn();
      render(
        <RuleHeader
          ruleFilter={mockRuleFilter}
          docsUrl="https://example.com/docs"
          onClear={onClear}
        />
      );

      const docsLink = screen.getByText("Docs");
      expect(docsLink).toBeTruthy();
      expect(docsLink.closest("a")?.href).toBe("https://example.com/docs");
    });
  });

  describe("Close Button", () => {
    it("renders close button by default", () => {
      const onClear = vi.fn();
      render(
        <RuleHeader
          ruleFilter={mockRuleFilter}
          onClear={onClear}
        />
      );

      const closeButton = screen.getByTitle("Clear filter");
      expect(closeButton).toBeTruthy();
    });

    it("calls onClear when close button is clicked", () => {
      const onClear = vi.fn();
      render(
        <RuleHeader
          ruleFilter={mockRuleFilter}
          onClear={onClear}
        />
      );

      fireEvent.click(screen.getByTitle("Clear filter"));
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it("hides close button when showCloseButton is false", () => {
      const onClear = vi.fn();
      render(
        <RuleHeader
          ruleFilter={mockRuleFilter}
          onClear={onClear}
          showCloseButton={false}
        />
      );

      expect(screen.queryByTitle("Clear filter")).toBeNull();
    });
  });

  describe("Info Toggle", () => {
    it("toggles description visibility when Info is clicked", () => {
      const onClear = vi.fn();
      render(
        <RuleHeader
          ruleFilter={mockRuleFilter}
          description="Disallow console statements"
          onClear={onClear}
        />
      );

      // Description not visible initially
      expect(screen.queryByText("Disallow console statements")).toBeNull();

      // Click Info to show description
      fireEvent.click(screen.getByText("Info"));
      expect(screen.getByText("Disallow console statements")).toBeTruthy();

      // Click Info again to hide description
      fireEvent.click(screen.getByText("Info"));
      expect(screen.queryByText("Disallow console statements")).toBeNull();
    });
  });

  describe("Configure Popover", () => {
    it("renders Configure button when onSeverityChange is provided", () => {
      const onClear = vi.fn();
      const onSeverityChange = vi.fn();
      render(
        <RuleHeader
          ruleFilter={mockRuleFilter}
          onClear={onClear}
          onSeverityChange={onSeverityChange}
        />
      );

      expect(screen.getByText("Configure")).toBeTruthy();
    });

    it("does not render Configure button when onSeverityChange is not provided", () => {
      const onClear = vi.fn();
      render(
        <RuleHeader
          ruleFilter={mockRuleFilter}
          onClear={onClear}
        />
      );

      expect(screen.queryByText("Configure")).toBeNull();
    });

    it("opens popover when Configure is clicked", () => {
      const onClear = vi.fn();
      const onSeverityChange = vi.fn();
      render(
        <RuleHeader
          ruleFilter={mockRuleFilter}
          onClear={onClear}
          onSeverityChange={onSeverityChange}
        />
      );

      fireEvent.click(screen.getByText("Configure"));

      // RuleConfig should render severity options
      expect(screen.getByText("Severity")).toBeTruthy();
      expect(screen.getByText("Off")).toBeTruthy();
      expect(screen.getByText("Warn")).toBeTruthy();
      expect(screen.getByText("Error")).toBeTruthy();
    });

    it("calls onSeverityChange when severity is changed in popover", () => {
      const onClear = vi.fn();
      const onSeverityChange = vi.fn();
      render(
        <RuleHeader
          ruleFilter={mockRuleFilter}
          onClear={onClear}
          onSeverityChange={onSeverityChange}
          currentSeverity="warn"
        />
      );

      // Open popover
      fireEvent.click(screen.getByText("Configure"));

      // Change severity
      fireEvent.click(screen.getByText("Error"));
      expect(onSeverityChange).toHaveBeenCalledWith("error");
    });
  });

  describe("Styling", () => {
    it("applies custom className", () => {
      const onClear = vi.fn();
      const { container } = render(
        <RuleHeader
          ruleFilter={mockRuleFilter}
          onClear={onClear}
          className="custom-header-class"
        />
      );

      const headerDiv = container.firstChild as HTMLElement;
      expect(headerDiv.className).toContain("custom-header-class");
    });
  });
});
