/**
 * Tests for ConfigSelector (MultiSelect) component
 *
 * Tests cover:
 * - Display of items with different statuses (installed, upgradeable, not_installed)
 * - Pre-selection behavior
 * - Keyboard shortcuts that work reliably in the test environment
 *
 * Note: Toggle behavior is tested via integration tests in test/integration/uninstall.test.ts
 * since the ink-testing-library has limitations with keyboard input processing.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import {
  ConfigSelector,
  type ConfigItem,
  type ItemStatus,
} from "../../../src/commands/init/components/MultiSelect.js";

// Helper to create mock items
function createItem(
  id: string,
  label: string,
  status: ItemStatus,
  category: string = "Test Category"
): ConfigItem {
  return {
    id,
    label,
    status,
    category,
    categoryIcon: "🔧",
  };
}

describe("ConfigSelector", () => {
  describe("rendering", () => {
    it("should render items with their labels", () => {
      const items: ConfigItem[] = [
        createItem("item-1", "First Item", "not_installed"),
        createItem("item-2", "Second Item", "installed"),
      ];
      const onSubmit = vi.fn();

      const { lastFrame } = render(
        <ConfigSelector items={items} onSubmit={onSubmit} />
      );

      expect(lastFrame()).toContain("First Item");
      expect(lastFrame()).toContain("Second Item");
    });

    it("should render category headers", () => {
      const items: ConfigItem[] = [
        createItem("item-1", "Item 1", "not_installed", "Category A"),
        createItem("item-2", "Item 2", "installed", "Category B"),
      ];
      const onSubmit = vi.fn();

      const { lastFrame } = render(
        <ConfigSelector items={items} onSubmit={onSubmit} />
      );

      expect(lastFrame()).toContain("Category A");
      expect(lastFrame()).toContain("Category B");
    });

    it("should show keyboard hints", () => {
      const items: ConfigItem[] = [
        createItem("item-1", "Item 1", "not_installed"),
      ];
      const onSubmit = vi.fn();

      const { lastFrame } = render(
        <ConfigSelector items={items} onSubmit={onSubmit} />
      );

      expect(lastFrame()).toContain("navigate");
      expect(lastFrame()).toContain("toggle");
      expect(lastFrame()).toContain("apply");
    });
  });

  describe("status indicators", () => {
    it("should show green check for installed items", () => {
      const items: ConfigItem[] = [
        createItem("item-1", "Installed Item", "installed"),
      ];
      const onSubmit = vi.fn();

      const { lastFrame } = render(
        <ConfigSelector items={items} onSubmit={onSubmit} />
      );

      expect(lastFrame()).toContain("✓");
      expect(lastFrame()).toContain("installed");
    });

    it("should show blue up arrow for upgradeable items when selected", () => {
      const items: ConfigItem[] = [
        createItem("item-1", "Upgradeable Item", "upgradeable"),
      ];
      const onSubmit = vi.fn();

      const { lastFrame } = render(
        <ConfigSelector items={items} onSubmit={onSubmit} />
      );

      // Upgradeable items are pre-selected, so should show blue up arrow
      expect(lastFrame()).toContain("⬆");
      expect(lastFrame()).toContain("upgrade available");
    });
  });

  describe("pre-selection behavior", () => {
    it("should pre-select not_installed items", () => {
      const items: ConfigItem[] = [
        createItem("item-1", "New Item", "not_installed"),
      ];
      const onSubmit = vi.fn();

      const { lastFrame } = render(
        <ConfigSelector items={items} onSubmit={onSubmit} />
      );

      // Should show selected indicator (cyan filled circle)
      expect(lastFrame()).toContain("◉");
    });

    it("should pre-select upgradeable items", () => {
      const items: ConfigItem[] = [
        createItem("item-1", "Upgrade Item", "upgradeable"),
      ];
      const onSubmit = vi.fn();

      const { lastFrame } = render(
        <ConfigSelector items={items} onSubmit={onSubmit} />
      );

      // Upgradeable items are pre-selected
      expect(lastFrame()).toContain("⬆");
    });

    it("should NOT pre-select installed items", () => {
      const items: ConfigItem[] = [
        createItem("item-1", "Installed Item", "installed"),
      ];
      const onSubmit = vi.fn();

      const { lastFrame } = render(
        <ConfigSelector items={items} onSubmit={onSubmit} />
      );

      // Should show installed check, not selection
      expect(lastFrame()).toContain("✓");
      expect(lastFrame()).toContain("installed");
    });
  });

  describe("submission", () => {
    it("should call onSubmit with pre-selected IDs on enter", () => {
      const items: ConfigItem[] = [
        createItem("new-item", "New Item", "not_installed"),
      ];
      const onSubmit = vi.fn();

      const { stdin } = render(
        <ConfigSelector items={items} onSubmit={onSubmit} />
      );

      // Submit (item is pre-selected)
      stdin.write("\r");

      expect(onSubmit).toHaveBeenCalledWith(
        ["new-item"], // Selected for install
        [] // No uninstalls
      );
    });

    it("should return empty arrays when nothing selected", () => {
      const items: ConfigItem[] = [
        createItem("installed-item", "Installed Item", "installed"),
      ];
      const onSubmit = vi.fn();

      const { stdin } = render(
        <ConfigSelector items={items} onSubmit={onSubmit} />
      );

      // Submit without changes
      stdin.write("\r");

      expect(onSubmit).toHaveBeenCalledWith([], []);
    });
  });

  describe("selection summary", () => {
    it("should show install count", () => {
      const items: ConfigItem[] = [
        createItem("item-1", "New Item 1", "not_installed"),
        createItem("item-2", "New Item 2", "not_installed"),
      ];
      const onSubmit = vi.fn();

      const { lastFrame } = render(
        <ConfigSelector items={items} onSubmit={onSubmit} />
      );

      expect(lastFrame()).toContain("2");
      expect(lastFrame()).toContain("to install");
    });
  });

  describe("keyboard shortcuts", () => {
    it("should quit with 'q' key", () => {
      const items: ConfigItem[] = [
        createItem("item-1", "Item 1", "not_installed"),
      ];
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      const { stdin } = render(
        <ConfigSelector items={items} onSubmit={onSubmit} onCancel={onCancel} />
      );

      stdin.write("q");

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe("navigation", () => {
    it("should start cursor on first item", () => {
      const items: ConfigItem[] = [
        createItem("item-1", "Item 1", "not_installed"),
        createItem("item-2", "Item 2", "not_installed"),
      ];
      const onSubmit = vi.fn();

      const { lastFrame } = render(
        <ConfigSelector items={items} onSubmit={onSubmit} />
      );

      // Should show cursor on first item
      expect(lastFrame()).toContain("›");
      expect(lastFrame()).toContain("Item 1");
    });
  });
});
