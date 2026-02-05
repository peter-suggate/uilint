/**
 * Tests for Breadcrumbs component
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { Breadcrumbs } from "./Breadcrumbs";

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

describe("Breadcrumbs", () => {
  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("returns null when no rule is expanded", () => {
      const onCollapseToRoot = vi.fn();
      const onCollapseFile = vi.fn();
      const { container } = render(
        <Breadcrumbs
          expandedRuleName={null}
          expandedFileName={null}
          onCollapseToRoot={onCollapseToRoot}
          onCollapseFile={onCollapseFile}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders 'All Rules' and rule name when rule is expanded", () => {
      const onCollapseToRoot = vi.fn();
      const onCollapseFile = vi.fn();
      render(
        <Breadcrumbs
          expandedRuleName="no-console"
          expandedFileName={null}
          onCollapseToRoot={onCollapseToRoot}
          onCollapseFile={onCollapseFile}
        />
      );

      expect(screen.getByText("All Rules")).toBeTruthy();
      expect(screen.getByText("no-console")).toBeTruthy();
    });

    it("renders all three segments when file is also expanded", () => {
      const onCollapseToRoot = vi.fn();
      const onCollapseFile = vi.fn();
      render(
        <Breadcrumbs
          expandedRuleName="no-console"
          expandedFileName="App.tsx"
          onCollapseToRoot={onCollapseToRoot}
          onCollapseFile={onCollapseFile}
        />
      );

      expect(screen.getByText("All Rules")).toBeTruthy();
      expect(screen.getByText("no-console")).toBeTruthy();
      expect(screen.getByText("App.tsx")).toBeTruthy();
    });
  });

  describe("Navigation", () => {
    it("calls onCollapseToRoot when 'All Rules' is clicked", () => {
      const onCollapseToRoot = vi.fn();
      const onCollapseFile = vi.fn();
      render(
        <Breadcrumbs
          expandedRuleName="no-console"
          expandedFileName={null}
          onCollapseToRoot={onCollapseToRoot}
          onCollapseFile={onCollapseFile}
        />
      );

      fireEvent.click(screen.getByText("All Rules"));
      expect(onCollapseToRoot).toHaveBeenCalledTimes(1);
    });

    it("calls onCollapseFile when rule name is clicked (with file expanded)", () => {
      const onCollapseToRoot = vi.fn();
      const onCollapseFile = vi.fn();
      render(
        <Breadcrumbs
          expandedRuleName="no-console"
          expandedFileName="App.tsx"
          onCollapseToRoot={onCollapseToRoot}
          onCollapseFile={onCollapseFile}
        />
      );

      fireEvent.click(screen.getByText("no-console"));
      expect(onCollapseFile).toHaveBeenCalledTimes(1);
    });

    it("does not call onCollapseFile when rule is active (no file expanded)", () => {
      const onCollapseToRoot = vi.fn();
      const onCollapseFile = vi.fn();
      render(
        <Breadcrumbs
          expandedRuleName="no-console"
          expandedFileName={null}
          onCollapseToRoot={onCollapseToRoot}
          onCollapseFile={onCollapseFile}
        />
      );

      // The rule name button should be disabled when it's the active segment
      const ruleButton = screen.getByText("no-console").closest("button");
      expect(ruleButton?.disabled).toBe(true);
    });

    it("file segment is not clickable (always active)", () => {
      const onCollapseToRoot = vi.fn();
      const onCollapseFile = vi.fn();
      render(
        <Breadcrumbs
          expandedRuleName="no-console"
          expandedFileName="App.tsx"
          onCollapseToRoot={onCollapseToRoot}
          onCollapseFile={onCollapseFile}
        />
      );

      const fileButton = screen.getByText("App.tsx").closest("button");
      expect(fileButton?.disabled).toBe(true);
    });
  });

  describe("Styling", () => {
    it("applies custom className", () => {
      const onCollapseToRoot = vi.fn();
      const onCollapseFile = vi.fn();
      const { container } = render(
        <Breadcrumbs
          expandedRuleName="no-console"
          expandedFileName={null}
          onCollapseToRoot={onCollapseToRoot}
          onCollapseFile={onCollapseFile}
          className="custom-breadcrumbs"
        />
      );

      const breadcrumbsDiv = container.firstChild as HTMLElement;
      expect(breadcrumbsDiv.className).toContain("custom-breadcrumbs");
    });
  });
});
