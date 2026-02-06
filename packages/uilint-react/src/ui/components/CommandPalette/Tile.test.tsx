/**
 * Tests for CommandPalette Tile usage
 *
 * These tests verify the shared Tile component works correctly
 * when used in the CommandPalette context.
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Tile } from "../HierarchicalTiles/Tile";

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
            if (!["initial", "animate", "exit", "transition", "whileHover", "whileTap", "layout"].includes(key)) {
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

describe("Tile - CommandPalette usage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders label and count correctly", () => {
    const { container } = render(
      <Tile
        id="test-tile-1"
        label="My Rule Name"
        count={42}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).toContain("My Rule Name");
    expect(container.textContent).toContain("42");
  });

  it("renders subtitle (path) when provided", () => {
    const { container } = render(
      <Tile
        id="test-tile-1"
        label="page.tsx"
        subtitle="src/app"
        count={10}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).toContain("page.tsx");
    expect(container.textContent).toContain("src/app");
  });

  it("renders with tileType for visual differentiation", () => {
    const { container } = render(
      <Tile
        id="test-tile-1"
        label="Rule Name"
        tileType="rule"
        count={5}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    // Verify the tile renders without error
    expect(container.textContent).toContain("Rule Name");
  });

  it("renders issue summary with file count", () => {
    const { container } = render(
      <Tile
        id="test-tile-1"
        label="Test Rule"
        count={72}
        fileCount={4}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    // Count is displayed prominently, suffix shows "issues in X files"
    expect(container.textContent).toContain("72");
    expect(container.textContent).toContain("issues in 4 files");
  });

  it("renders issue summary without file count", () => {
    const { container } = render(
      <Tile
        id="test-tile-1"
        label="Test Rule"
        count={12}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    // Count is displayed prominently, suffix shows "issues"
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("issues");
  });

  it("uses singular 'issue' for count of 1", () => {
    const { container } = render(
      <Tile
        id="test-tile-1"
        label="Test Rule"
        count={1}
        fileCount={1}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    // Count is displayed prominently, suffix uses singular forms
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("issue in 1 file");
    expect(container.textContent).not.toContain("issues");
    expect(container.textContent).not.toContain("files");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Tile
        id="test-tile-1"
        label="Test Rule"
        count={5}
        bucket="md"
        isSelected={false}
        onClick={onClick}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    fireEvent.click(root);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
