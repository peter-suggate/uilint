/**
 * Tests for FeatureSelector component
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import {
  FeatureSelector,
  type FeatureOption,
} from "../../../src/commands/install/components/FeatureSelector.js";

// Helper to create mock options
function createOptions(count: number): FeatureOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `feature-${i}`,
    label: `Feature ${i}`,
    description: `Description for feature ${i}`,
    enabled: i === 0, // First one enabled by default
    applicable: true,
  }));
}

describe("FeatureSelector", () => {
  it("should render title and instructions", () => {
    const options = createOptions(3);
    const onSubmit = vi.fn();

    const { lastFrame } = render(
      <FeatureSelector options={options} onSubmit={onSubmit} />
    );

    expect(lastFrame()).toContain("Select features to install");
    expect(lastFrame()).toContain("↑/↓ to navigate");
    expect(lastFrame()).toContain("Space to select");
    expect(lastFrame()).toContain("Enter to continue");
  });

  it("should render custom title", () => {
    const options = createOptions(2);
    const onSubmit = vi.fn();

    const { lastFrame } = render(
      <FeatureSelector
        title="Choose your installers"
        options={options}
        onSubmit={onSubmit}
      />
    );

    expect(lastFrame()).toContain("Choose your installers");
  });

  it("should display all applicable options", () => {
    const options = createOptions(3);
    const onSubmit = vi.fn();

    const { lastFrame } = render(
      <FeatureSelector options={options} onSubmit={onSubmit} />
    );

    expect(lastFrame()).toContain("Feature 0");
    expect(lastFrame()).toContain("Feature 1");
    expect(lastFrame()).toContain("Feature 2");
  });

  it("should filter out non-applicable options", () => {
    const options: FeatureOption[] = [
      {
        id: "feature-1",
        label: "Applicable Feature",
        enabled: true,
        applicable: true,
      },
      {
        id: "feature-2",
        label: "Not Applicable",
        enabled: false,
        applicable: false,
      },
    ];
    const onSubmit = vi.fn();

    const { lastFrame } = render(
      <FeatureSelector options={options} onSubmit={onSubmit} />
    );

    expect(lastFrame()).toContain("Applicable Feature");
    expect(lastFrame()).not.toContain("Not Applicable");
  });

  it("should show selected checkbox for enabled options", () => {
    const options: FeatureOption[] = [
      {
        id: "feature-1",
        label: "Enabled Feature",
        enabled: true,
        applicable: true,
      },
    ];
    const onSubmit = vi.fn();

    const { lastFrame } = render(
      <FeatureSelector options={options} onSubmit={onSubmit} />
    );

    expect(lastFrame()).toContain("◉"); // Selected checkbox
    expect(lastFrame()).toContain("Enabled Feature");
  });

  it("should show unselected checkbox for disabled options", () => {
    const options: FeatureOption[] = [
      {
        id: "feature-1",
        label: "Disabled Feature",
        enabled: false,
        applicable: true,
      },
    ];
    const onSubmit = vi.fn();

    const { lastFrame } = render(
      <FeatureSelector options={options} onSubmit={onSubmit} />
    );

    expect(lastFrame()).toContain("◯"); // Unselected checkbox
    expect(lastFrame()).toContain("Disabled Feature");
  });

  it("should show cursor pointer on first option by default", () => {
    const options = createOptions(3);
    const onSubmit = vi.fn();

    const { lastFrame } = render(
      <FeatureSelector options={options} onSubmit={onSubmit} />
    );

    expect(lastFrame()).toContain("❯"); // Cursor pointer
  });

  it("should show selection count", () => {
    const options: FeatureOption[] = [
      { id: "1", label: "A", enabled: true, applicable: true },
      { id: "2", label: "B", enabled: true, applicable: true },
      { id: "3", label: "C", enabled: false, applicable: true },
    ];
    const onSubmit = vi.fn();

    const { lastFrame } = render(
      <FeatureSelector options={options} onSubmit={onSubmit} />
    );

    expect(lastFrame()).toContain("Selected: 2 / 3");
  });

  it("should handle navigation with arrow keys", () => {
    const options = createOptions(3);
    const onSubmit = vi.fn();

    const { lastFrame, stdin } = render(
      <FeatureSelector options={options} onSubmit={onSubmit} />
    );

    // Initial state - cursor on first item
    expect(lastFrame()).toMatch(/❯.*Feature 0/);

    // Press down arrow
    stdin.write("\x1B[B"); // Down arrow
    expect(lastFrame()).toMatch(/❯.*Feature 1/);

    // Press down arrow again
    stdin.write("\x1B[B");
    expect(lastFrame()).toMatch(/❯.*Feature 2/);

    // Press up arrow
    stdin.write("\x1B[A"); // Up arrow
    expect(lastFrame()).toMatch(/❯.*Feature 1/);
  });

  it("should toggle selection with space key", () => {
    const options: FeatureOption[] = [
      { id: "1", label: "Feature 1", enabled: false, applicable: true },
    ];
    const onSubmit = vi.fn();

    const { lastFrame, stdin } = render(
      <FeatureSelector options={options} onSubmit={onSubmit} />
    );

    // Initially unselected
    expect(lastFrame()).toContain("◯");

    // Press space to select
    stdin.write(" ");
    expect(lastFrame()).toContain("◉");

    // Press space again to deselect
    stdin.write(" ");
    expect(lastFrame()).toContain("◯");
  });

  it("should call onSubmit with selected IDs on Enter", () => {
    const options: FeatureOption[] = [
      { id: "feature-1", label: "Feature 1", enabled: true, applicable: true },
      { id: "feature-2", label: "Feature 2", enabled: true, applicable: true },
      { id: "feature-3", label: "Feature 3", enabled: false, applicable: true },
    ];
    const onSubmit = vi.fn();

    const { stdin } = render(
      <FeatureSelector options={options} onSubmit={onSubmit} />
    );

    // Press Enter
    stdin.write("\r");

    expect(onSubmit).toHaveBeenCalledWith(["feature-1", "feature-2"]);
  });

  it("should call onCancel on Escape", () => {
    const options = createOptions(2);
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    const { stdin } = render(
      <FeatureSelector
        options={options}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    // Press Escape
    stdin.write("\x1B");

    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("should not call onCancel if not provided", () => {
    const options = createOptions(2);
    const onSubmit = vi.fn();

    const { stdin } = render(
      <FeatureSelector options={options} onSubmit={onSubmit} />
    );

    // Press Escape - should not throw
    expect(() => stdin.write("\x1B")).not.toThrow();
  });

  it("should show message when no options are applicable", () => {
    const options: FeatureOption[] = [
      { id: "1", label: "Feature 1", enabled: true, applicable: false },
    ];
    const onSubmit = vi.fn();

    const { lastFrame } = render(
      <FeatureSelector options={options} onSubmit={onSubmit} />
    );

    expect(lastFrame()).toContain("No features applicable to this project");
  });

  it("should not move cursor beyond bounds", () => {
    const options = createOptions(2);
    const onSubmit = vi.fn();

    const { lastFrame, stdin } = render(
      <FeatureSelector options={options} onSubmit={onSubmit} />
    );

    // Try to go up from first item
    stdin.write("\x1B[A"); // Up arrow
    expect(lastFrame()).toMatch(/❯.*Feature 0/); // Should stay on first

    // Go to last item
    stdin.write("\x1B[B"); // Down arrow
    expect(lastFrame()).toMatch(/❯.*Feature 1/);

    // Try to go down beyond last item
    stdin.write("\x1B[B"); // Down arrow
    expect(lastFrame()).toMatch(/❯.*Feature 1/); // Should stay on last
  });
});
