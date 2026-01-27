/**
 * Tests for CommandPalette - ESLint rule search integration
 *
 * These tests verify the rule search feature works correctly with the plugin system:
 * - Bug #1: Rules should update reactively when plugin data arrives after mount
 * - Bug #2: Rules should be included in keyboard navigation (allResults)
 * - Bug #4: Selecting a rule should use a generic pluginId-based panel ID
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import type { RuleDefinition } from "../../../core/plugin-system/types";
import type { PluginSliceMap } from "../../../core/store/composed-store";

// Mock motion/react to avoid animation issues in tests
vi.mock("motion/react", () => {
  const React = require("react");

  function createMotionComponent(tag: string) {
    return React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      // Filter out motion-specific props
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
            "whileFocus",
            "whileDrag",
            "whileInView",
            "layout",
            "layoutId",
            "onAnimationComplete",
            "onAnimationStart",
            "variants",
          ].includes(key)
        ) {
          filtered[key] = val;
        }
      }
      return React.createElement(tag, { ...filtered, ref });
    });
  }

  const motion = new Proxy(
    {},
    {
      get(_target: unknown, prop: string) {
        return createMotionComponent(prop);
      },
    }
  );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion,
  };
});

import { pluginRegistry } from "../../../core/plugin-system/registry";
import {
  createComposedStore,
  resetStore,
} from "../../../core/store/composed-store";
import { CommandPalette } from "./CommandPalette";

/** Helper to cast a minimal test object to a plugin slice type */
function asPluginSlice<K extends keyof PluginSliceMap>(
  slice: Record<string, unknown>
): PluginSliceMap[K] {
  return slice as unknown as PluginSliceMap[K];
}

const testRules: RuleDefinition[] = [
  {
    id: "uilint/no-console",
    name: "No Console",
    description: "Disallow console statements",
    category: "static",
    severity: "warning",
    fixable: false,
    pluginId: "eslint",
  },
  {
    id: "uilint/prefer-tailwind",
    name: "Prefer Tailwind",
    description: "Prefer Tailwind CSS classes",
    category: "static",
    severity: "error",
    fixable: false,
    pluginId: "eslint",
  },
];

describe("CommandPalette - ESLint rule search", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    cleanup();
    resetStore();
    vi.restoreAllMocks();
  });

  /**
   * Bug #1: allRules uses useMemo with empty deps [], so rules that arrive
   * asynchronously via WebSocket (rules:metadata) never appear in search.
   *
   * This test simulates the real scenario: CommandPalette mounts before rules
   * metadata arrives, then rules arrive via store update.
   */
  it("shows rules in search results after plugin data arrives post-mount", () => {
    // Initially registry returns no rules (rules metadata hasn't arrived yet)
    const getAllRulesSpy = vi
      .spyOn(pluginRegistry, "getAllRules")
      .mockReturnValue([]);
    vi.spyOn(pluginRegistry, "getAllCommands").mockReturnValue([]);
    vi.spyOn(pluginRegistry, "getAllInspectorPanels").mockReturnValue([]);

    const store = createComposedStore();
    store.getState().openCommandPalette();

    render(<CommandPalette />);

    // Now simulate rules:metadata arriving - store updates and getAllRules returns data
    act(() => {
      getAllRulesSpy.mockReturnValue(testRules);
      // Simulate the eslint plugin slice update that would happen via WebSocket
      store.getState().registerPluginSlice(
        "eslint",
        asPluginSlice<"eslint">({
          availableRules: [
            {
              id: "uilint/no-console",
              name: "No Console",
              description: "Disallow console statements",
              category: "static",
              currentSeverity: "warning",
            },
          ],
          ruleConfigs: new Map(),
          issues: new Map(),
          ruleConfigUpdating: new Map(),
        })
      );
    });

    // Search for the rule
    // CommandPalette uses createPortal so query from document, not container
    const input = document.querySelector("input")!;
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: "console" } });

    // Bug #1: This should show the rule but fails because allRules
    // was computed once at mount time with empty deps
    expect(screen.queryByText("No Console")).not.toBeNull();
  });

  /**
   * Bug #2: Rules are rendered in the UI but NOT included in the allResults
   * array used for keyboard navigation. When rules are the only search results,
   * they should appear as selectable items (not just rendered separately).
   *
   * We verify that rules appear as selectable result items when searching,
   * and that clicking them opens the inspector. This tests the same code path
   * as keyboard Enter (handleSelectResult -> handleSelectRule).
   */
  it("includes rules as selectable items in search results", () => {
    // Rules are available from the start
    vi.spyOn(pluginRegistry, "getAllRules").mockReturnValue(testRules);
    vi.spyOn(pluginRegistry, "getAllCommands").mockReturnValue([]);
    vi.spyOn(pluginRegistry, "getAllInspectorPanels").mockReturnValue([]);

    const store = createComposedStore();
    store.getState().openCommandPalette();

    render(<CommandPalette />);

    // Search for "console" - should match one rule
    // CommandPalette uses createPortal so query from document, not container
    const input = document.querySelector("input")!;

    act(() => {
      fireEvent.change(input, { target: { value: "console" } });
    });

    // Rule should appear as a clickable result item in the results list
    const ruleElement = screen.queryByText("No Console");
    expect(ruleElement).not.toBeNull();

    // Clicking the rule should open inspector (same path as Enter key)
    act(() => {
      fireEvent.click(ruleElement!);
    });

    const inspectorState = store.getState().inspector;
    expect(inspectorState.open).toBe(true);
    expect(inspectorState.data?.ruleId).toBe("uilint/no-console");
  });

  /**
   * Bug #4: handleSelectRule hardcodes openInspector("eslint-rule", ...)
   * instead of using the rule's pluginId to derive the panel ID.
   * This means rules from non-ESLint plugins open the wrong panel.
   */
  it("opens inspector with plugin-specific panel ID when selecting a rule", () => {
    const customRules: RuleDefinition[] = [
      {
        id: "custom/my-rule",
        name: "My Custom Rule",
        description: "A custom rule from a custom plugin",
        category: "custom",
        severity: "warning",
        fixable: false,
        pluginId: "custom-plugin",
      },
    ];

    vi.spyOn(pluginRegistry, "getAllRules").mockReturnValue(customRules);
    vi.spyOn(pluginRegistry, "getAllCommands").mockReturnValue([]);
    vi.spyOn(pluginRegistry, "getAllInspectorPanels").mockReturnValue([]);

    const store = createComposedStore();
    store.getState().openCommandPalette();

    render(<CommandPalette />);

    // Search for the custom rule
    // CommandPalette uses createPortal so query from document, not container
    const input = document.querySelector("input")!;
    fireEvent.change(input, { target: { value: "custom" } });

    // Click the rule
    const ruleElement = screen.queryByText("My Custom Rule");
    expect(ruleElement).not.toBeNull();
    fireEvent.click(ruleElement!);

    // Bug #4: Should open with "custom-plugin-rule", not "eslint-rule"
    const inspectorState = store.getState().inspector;
    expect(inspectorState.open).toBe(true);
    expect(inspectorState.panelId).toBe("custom-plugin-rule");
  });
});
