/**
 * Tests for Tile component behavior
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Tile } from "./Tile";
import type { TileItem } from "../../../core/plugin-system/types";

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

const createTestItem = (overrides: Partial<TileItem> = {}): TileItem => ({
  id: "test-tile-1",
  label: "Test Rule",
  count: 5,
  ...overrides,
});

describe("Tile - rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders label and count correctly", () => {
    const { container } = render(
      <Tile
        item={createTestItem({ label: "My Rule Name", count: 42 })}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).toContain("My Rule Name");
    expect(container.textContent).toContain("42");
  });

  // Note: severityCounts is accepted by TileItem but not currently rendered by Tile component
  // These tests were removed as they tested non-existent functionality

  it("renders subtitle when provided for non-compact bucket", () => {
    const { container } = render(
      <Tile
        item={createTestItem({ subtitle: "Additional info here" })}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Additional info here");
  });

  it("does not render subtitle for xs bucket even when provided", () => {
    const { container } = render(
      <Tile
        item={createTestItem({ subtitle: "Hidden subtitle" })}
        bucket="xs"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).not.toContain("Hidden subtitle");
  });

  it("does not render subtitle for sm bucket even when provided", () => {
    const { container } = render(
      <Tile
        item={createTestItem({ subtitle: "Hidden subtitle" })}
        bucket="sm"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).not.toContain("Hidden subtitle");
  });
});

describe("Tile - interactions", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Tile
        item={createTestItem()}
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
