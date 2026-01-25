/**
 * Tests for FloatingIcon component
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { FloatingIcon } from "./FloatingIcon";
import {
  createComposedStore,
  resetStore,
} from "../../core/store/composed-store";
import {
  pluginRegistry,
  createPluginRegistry,
} from "../../core/plugin-system/registry";
import type { Plugin, ToolbarAction, PluginServices } from "../../core/plugin-system/types";

// Mock createPortal to render inline for testing
vi.mock("react-dom", async () => {
  const actual = await vi.importActual("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

/**
 * Helper to create a mock toolbar action
 */
function createMockToolbarAction(
  overrides: Partial<ToolbarAction> = {}
): ToolbarAction {
  return {
    id: "test-action",
    tooltip: "Test Action",
    icon: "T",
    onClick: vi.fn(),
    ...overrides,
  };
}

/**
 * Helper to create a mock plugin with toolbar actions
 */
function createMockPlugin(
  id: string,
  toolbarActions: ToolbarAction[] = []
): Plugin {
  return {
    id,
    name: `${id} Plugin`,
    version: "1.0.0",
    description: `Test plugin: ${id}`,
    toolbarActions,
  };
}

describe("FloatingIcon", () => {
  beforeEach(() => {
    resetStore();
    pluginRegistry.clear();
  });

  afterEach(() => {
    cleanup();
    resetStore();
    pluginRegistry.clear();
  });

  describe("Basic Rendering", () => {
    it("renders search button and grip handle", () => {
      createComposedStore();
      render(<FloatingIcon />);

      // Check for search button (contains "Search" text)
      expect(screen.getByText("Search")).toBeDefined();

      // Check for grip handle (it's in the DOM as an SVG with specific structure)
      // The grip handle SVG has circles for the dots
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it("renders the keyboard shortcut hint", () => {
      createComposedStore();
      render(<FloatingIcon />);

      // Should show the keyboard shortcut (either "K" for the main hint)
      // The component shows either modKey (Alt+ or Option symbol) + K
      expect(screen.getByText(/K/)).toBeDefined();
    });
  });

  describe("Toolbar Actions", () => {
    it("renders toolbar actions from plugins", () => {
      createComposedStore();

      const mockAction = createMockToolbarAction({
        id: "capture-action",
        tooltip: "Capture Screenshot",
        icon: "C",
      });

      const mockPlugin = createMockPlugin("test-plugin", [mockAction]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      // The toolbar action should be rendered
      const actionButton = screen.getByTitle("Capture Screenshot");
      expect(actionButton).toBeDefined();
    });

    it("renders multiple toolbar actions from multiple plugins", () => {
      createComposedStore();

      const action1 = createMockToolbarAction({
        id: "action-1",
        tooltip: "Action One",
        icon: "1",
      });
      const action2 = createMockToolbarAction({
        id: "action-2",
        tooltip: "Action Two",
        icon: "2",
      });

      const plugin1 = createMockPlugin("plugin-1", [action1]);
      const plugin2 = createMockPlugin("plugin-2", [action2]);

      pluginRegistry.register(plugin1);
      pluginRegistry.register(plugin2);

      render(<FloatingIcon />);

      expect(screen.getByTitle("Action One")).toBeDefined();
      expect(screen.getByTitle("Action Two")).toBeDefined();
    });

    it("does not render toolbar actions when isVisible returns false", () => {
      createComposedStore();

      const visibleAction = createMockToolbarAction({
        id: "visible-action",
        tooltip: "Visible Action",
        icon: "V",
        isVisible: () => true,
      });

      const hiddenAction = createMockToolbarAction({
        id: "hidden-action",
        tooltip: "Hidden Action",
        icon: "H",
        isVisible: () => false,
      });

      const mockPlugin = createMockPlugin("test-plugin", [
        visibleAction,
        hiddenAction,
      ]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      expect(screen.getByTitle("Visible Action")).toBeDefined();
      expect(screen.queryByTitle("Hidden Action")).toBeNull();
    });

    it("renders actions without isVisible (defaults to visible)", () => {
      createComposedStore();

      const actionWithoutIsVisible = createMockToolbarAction({
        id: "default-visible",
        tooltip: "Default Visible",
        icon: "D",
        // No isVisible defined - should default to visible
      });

      const mockPlugin = createMockPlugin("test-plugin", [actionWithoutIsVisible]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      expect(screen.getByTitle("Default Visible")).toBeDefined();
    });

    it("disables toolbar action button when isEnabled returns false", () => {
      createComposedStore();

      const enabledAction = createMockToolbarAction({
        id: "enabled-action",
        tooltip: "Enabled Action",
        icon: "E",
        isEnabled: () => true,
      });

      const disabledAction = createMockToolbarAction({
        id: "disabled-action",
        tooltip: "Disabled Action",
        icon: "D",
        isEnabled: () => false,
      });

      const mockPlugin = createMockPlugin("test-plugin", [
        enabledAction,
        disabledAction,
      ]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      const enabledButton = screen.getByTitle("Enabled Action");
      const disabledButton = screen.getByTitle("Disabled Action");

      expect((enabledButton as HTMLButtonElement).disabled).toBe(false);
      expect((disabledButton as HTMLButtonElement).disabled).toBe(true);
    });

    it("enables actions without isEnabled (defaults to enabled)", () => {
      createComposedStore();

      const actionWithoutIsEnabled = createMockToolbarAction({
        id: "default-enabled",
        tooltip: "Default Enabled",
        icon: "D",
        // No isEnabled defined - should default to enabled
      });

      const mockPlugin = createMockPlugin("test-plugin", [actionWithoutIsEnabled]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      const button = screen.getByTitle("Default Enabled");
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });

    it("calls onClick when toolbar action is clicked", async () => {
      createComposedStore();

      const onClickMock = vi.fn();
      const clickableAction = createMockToolbarAction({
        id: "clickable-action",
        tooltip: "Clickable Action",
        icon: "C",
        onClick: onClickMock,
      });

      const mockPlugin = createMockPlugin("test-plugin", [clickableAction]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      const actionButton = screen.getByTitle("Clickable Action");
      fireEvent.click(actionButton);

      expect(onClickMock).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled action is clicked", () => {
      createComposedStore();

      const onClickMock = vi.fn();
      const disabledAction = createMockToolbarAction({
        id: "disabled-action",
        tooltip: "Disabled Action",
        icon: "D",
        isEnabled: () => false,
        onClick: onClickMock,
      });

      const mockPlugin = createMockPlugin("test-plugin", [disabledAction]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      const actionButton = screen.getByTitle("Disabled Action");
      fireEvent.click(actionButton);

      expect(onClickMock).not.toHaveBeenCalled();
    });
  });

  describe("Hint Text", () => {
    it("shows hint text initially", () => {
      createComposedStore();
      render(<FloatingIcon />);

      // The hint text should contain the keyboard shortcut
      // It shows either "Alt+K" or "Option+K" for commands
      const hintText = screen.getByText(/for commands/i);
      expect(hintText).toBeDefined();
    });

    it("hides hint text after first command palette open", () => {
      const store = createComposedStore();
      render(<FloatingIcon />);

      // Initially visible
      expect(screen.getByText(/for commands/i)).toBeDefined();

      // Open command palette
      act(() => {
        store.getState().openCommandPalette();
      });

      // After interaction, hint should be hidden
      // We need to wait for the component to re-render
      expect(screen.queryByText(/for commands/i)).toBeNull();
    });

    it("keeps hint hidden after command palette is closed", () => {
      const store = createComposedStore();
      render(<FloatingIcon />);

      // Open and close command palette
      act(() => {
        store.getState().openCommandPalette();
      });

      act(() => {
        store.getState().closeCommandPalette();
      });

      // Hint should remain hidden after first interaction
      expect(screen.queryByText(/for commands/i)).toBeNull();
    });
  });

  describe("Issue Count", () => {
    it("does not show issue count when there are no issues", () => {
      createComposedStore();
      render(<FloatingIcon />);

      // No issue count badge should be visible
      // The issue count would show a number like "3" or "99+"
      expect(screen.queryByText(/^\d+\+?$/)).toBeNull();
    });

    it("shows issue count when eslint plugin has issues", () => {
      const store = createComposedStore();

      const issuesMap = new Map();
      issuesMap.set("file1.ts", [
        { ruleId: "no-console", message: "Unexpected console statement" },
        { ruleId: "no-unused-vars", message: "Unused variable" },
      ]);
      issuesMap.set("file2.ts", [
        { ruleId: "no-console", message: "Unexpected console statement" },
      ]);

      store.getState().registerPluginSlice("eslint", {
        availableRules: [],
        ruleConfigs: new Map(),
        issues: issuesMap,
        ruleConfigUpdating: new Map(),
      } as any);

      render(<FloatingIcon />);

      // Should show "3" for 3 total issues
      expect(screen.getByText("3")).toBeDefined();
    });

    it("shows 99+ when issue count exceeds 99", () => {
      const store = createComposedStore();

      const issuesMap = new Map();
      const manyIssues = Array.from({ length: 100 }, (_, i) => ({
        ruleId: "some-rule",
        message: `Issue ${i}`,
      }));
      issuesMap.set("file.ts", manyIssues);

      store.getState().registerPluginSlice("eslint", {
        availableRules: [],
        ruleConfigs: new Map(),
        issues: issuesMap,
        ruleConfigUpdating: new Map(),
      } as any);

      render(<FloatingIcon />);

      expect(screen.getByText("99+")).toBeDefined();
    });
  });

  describe("Click Behavior", () => {
    it("opens command palette when search button is clicked", () => {
      const store = createComposedStore();
      render(<FloatingIcon />);

      // Verify command palette is initially closed
      expect(store.getState().commandPalette.open).toBe(false);

      // Click the search button
      const searchButton = screen.getByRole("button", { name: /search/i });
      fireEvent.click(searchButton);

      // Command palette should be open
      expect(store.getState().commandPalette.open).toBe(true);
    });
  });
});
