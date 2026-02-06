/**
 * Tests for HierarchicalTiles Tile component
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Tile } from "./Tile";
import type { TileBucket } from "./types";

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


describe("Tile - rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders label and count correctly", () => {
    const { container } = render(
      <Tile
        id="test-1"
        label="Test Rule"
        count={42}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Test Rule");
    expect(container.textContent).toContain("42");
  });

  it("renders issue summary with file count", () => {
    const { container } = render(
      <Tile
        id="test-1"
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
        id="test-1"
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
        id="test-1"
        label="Test Rule"
        count={1}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    // Count is displayed prominently, suffix shows "issue" (singular)
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("issue");
    expect(container.textContent).not.toContain("issues");
  });

  it("renders with tileType rule gradient", () => {
    const { container } = render(
      <Tile
        id="test-1"
        label="Test Rule"
        count={5}
        bucket="md"
        tileType="rule"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    // Verify the component renders without error
    expect(container.textContent).toContain("Test Rule");
  });

  it("renders with tileType file gradient", () => {
    const { container } = render(
      <Tile
        id="test-1"
        label="Test File"
        count={5}
        bucket="md"
        tileType="file"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    // Verify the component renders without error
    expect(container.textContent).toContain("Test File");
  });

  it("uses singular 'file' for fileCount of 1", () => {
    const { container } = render(
      <Tile
        id="test-1"
        label="Test Rule"
        count={5}
        fileCount={1}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    // Count is displayed prominently, suffix shows "issues in 1 file" (singular)
    expect(container.textContent).toContain("5");
    expect(container.textContent).toContain("issues in 1 file");
    expect(container.textContent).not.toContain("1 files");
  });

  it("renders data-tile-id attribute", () => {
    const { container } = render(
      <Tile
        id="my-tile-id"
        label="Test Rule"
        count={5}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const tileElement = container.querySelector('[data-tile-id="my-tile-id"]');
    expect(tileElement).toBeTruthy();
  });

  it.each<TileBucket>(["xs", "sm", "md", "lg", "xl"])(
    "renders correctly with bucket size %s",
    (bucket) => {
      const { container } = render(
        <Tile
          id="test-1"
          label="Test Rule"
          count={5}
          bucket={bucket}
          isSelected={false}
          onClick={vi.fn()}
        />
      );

      expect(container.textContent).toContain("Test Rule");
      expect(container.textContent).toContain("5");
    }
  );
});

describe("Tile - interactions", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Tile
        id="test-1"
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

  it("calls onOpenInInspector when inspector button is clicked", () => {
    const onClick = vi.fn();
    const onOpenInInspector = vi.fn();
    const { container } = render(
      <Tile
        id="test-1"
        label="Test Rule"
        count={5}
        bucket="md"
        isSelected={false}
        onClick={onClick}
        onOpenInInspector={onOpenInInspector}
      />
    );

    // Find the button with aria-label
    const inspectorButton = container.querySelector('button[aria-label="Open in inspector"]');
    expect(inspectorButton).toBeTruthy();

    fireEvent.click(inspectorButton!);
    expect(onOpenInInspector).toHaveBeenCalledTimes(1);
    // onClick should NOT be called due to stopPropagation
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Tile - selection state", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies selected styling when isSelected is true", () => {
    const { container } = render(
      <Tile
        id="test-1"
        label="Test Rule"
        count={5}
        bucket="md"
        isSelected={true}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    const classAttr = root.getAttribute("class") || "";
    // Selected tiles have specific border styling
    expect(classAttr).toContain("border");
  });

  it("applies non-selected styling when isSelected is false", () => {
    const { container } = render(
      <Tile
        id="test-1"
        label="Test Rule"
        count={5}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root).toBeTruthy();
  });
});
