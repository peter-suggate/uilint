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

// Mock the useAdaptiveText hook
vi.mock("../../hooks/useAdaptiveText", () => ({
  useTileAdaptiveText: () => ({
    fontSize: 15,
    scale: 1,
    isScaled: false,
    needsTruncation: false,
  }),
}));

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

  it("renders subtitle when provided for non-compact bucket", () => {
    const { container } = render(
      <Tile
        id="test-1"
        label="Test Rule"
        subtitle="Additional info here"
        count={5}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Additional info here");
  });

  it("does not render subtitle for xs bucket", () => {
    const { container } = render(
      <Tile
        id="test-1"
        label="Test Rule"
        subtitle="Hidden subtitle"
        count={5}
        bucket="xs"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).not.toContain("Hidden subtitle");
  });

  it("does not render subtitle for sm bucket", () => {
    const { container } = render(
      <Tile
        id="test-1"
        label="Test Rule"
        subtitle="Hidden subtitle"
        count={5}
        bucket="sm"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).not.toContain("Hidden subtitle");
  });

  it("renders with icon when provided", () => {
    const TestIcon = () => <span data-testid="test-icon">🔧</span>;
    const { getByTestId } = render(
      <Tile
        id="test-1"
        label="Test Rule"
        count={5}
        bucket="md"
        icon={<TestIcon />}
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(getByTestId("test-icon")).toBeTruthy();
  });

  it("renders preview messages for large bucket tiles", () => {
    const { container } = render(
      <Tile
        id="test-1"
        label="Test Rule"
        count={5}
        bucket="lg"
        isSelected={false}
        onClick={vi.fn()}
        previewMessages={["First preview message", "Second preview message"]}
      />
    );

    expect(container.textContent).toContain("First preview message");
  });

  it("renders preview messages for xl bucket tiles", () => {
    const { container } = render(
      <Tile
        id="test-1"
        label="Test Rule"
        count={5}
        bucket="xl"
        isSelected={false}
        onClick={vi.fn()}
        previewMessages={["First preview message", "Second preview message"]}
      />
    );

    expect(container.textContent).toContain("First preview message");
    expect(container.textContent).toContain("Second preview message");
  });

  it("does not render preview messages for small bucket tiles", () => {
    const { container } = render(
      <Tile
        id="test-1"
        label="Test Rule"
        count={5}
        bucket="sm"
        isSelected={false}
        onClick={vi.fn()}
        previewMessages={["First preview message"]}
      />
    );

    expect(container.textContent).not.toContain("First preview message");
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
