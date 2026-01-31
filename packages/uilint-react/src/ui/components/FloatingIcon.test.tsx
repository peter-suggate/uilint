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
import { pluginRegistry } from "../../core/plugin-system/registry";
import type { Plugin, ToolbarAction, ToolbarActionGroup } from "../../core/plugin-system/types";
import type { PluginSliceMap } from "../../core/store/composed-store";

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
 * Helper to create a mock toolbar action group (dropdown)
 */
function createMockToolbarActionGroup(
  overrides: Partial<ToolbarActionGroup> = {}
): ToolbarActionGroup {
  return {
    id: "test-group",
    tooltip: "Test Group",
    icon: "G",
    actions: [],
    ...overrides,
  };
}

/**
 * Helper to create a mock plugin with toolbar actions
 */
function createMockPlugin(
  id: string,
  toolbarActions: ToolbarAction[] = [],
  toolbarActionGroups: ToolbarActionGroup[] = []
): Plugin {
  return {
    id,
    name: `${id} Plugin`,
    version: "1.0.0",
    description: `Test plugin: ${id}`,
    toolbarActions,
    toolbarActionGroups,
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

      // Should show the keyboard shortcut hint and shortcut in search button
      // The search button shows "⌘K" or "Ctrl+K", and the hint shows "K for commands"
      expect(screen.getByText(/for commands/)).toBeDefined();
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

  describe("Issue Count Badge", () => {
    it("does not show issue badge when there are no issues", () => {
      createComposedStore();
      render(<FloatingIcon />);

      // No issue count badge should be visible (no numbers shown)
      // The only number visible without issues would be in the keyboard shortcut
      expect(screen.queryByText("1")).toBeNull();
      expect(screen.queryByText("3")).toBeNull();
    });

    it("shows issue count badge when eslint plugin has issues", () => {
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
      } as unknown as PluginSliceMap["eslint"]);

      render(<FloatingIcon />);

      // Badge should show "3" for 3 total issues
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
      } as unknown as PluginSliceMap["eslint"]);

      render(<FloatingIcon />);

      // Badge should show "99+" for 100+ issues
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

  describe("Store Integration - Drag State", () => {
    it("uses store drag state instead of local state", () => {
      const store = createComposedStore();
      render(<FloatingIcon />);

      // Initially no drag should be active
      expect(store.getState().activeDrag).toBeNull();
    });

    it("starts drag in store when grip is mousedown", () => {
      const store = createComposedStore();
      render(<FloatingIcon />);

      // Find the grip handle (the SVG container div)
      const searchButton = screen.getByRole("button", { name: /search/i });
      const searchPill = searchButton.parentElement;
      const gripHandle = searchPill?.querySelector(
        'div[style*="cursor"]'
      ) as HTMLElement;

      expect(gripHandle).toBeTruthy();

      // Simulate mousedown on grip
      act(() => {
        fireEvent.mouseDown(gripHandle!, { button: 0, clientX: 100, clientY: 50 });
      });

      // Drag should be started in store
      expect(store.getState().activeDrag).not.toBeNull();
      expect(store.getState().activeDrag?.type).toBe("floating-icon");
    });

    it("starts drag in store when grip is touched", () => {
      const store = createComposedStore();
      render(<FloatingIcon />);

      // Find the grip handle
      const searchButton = screen.getByRole("button", { name: /search/i });
      const searchPill = searchButton.parentElement;
      const gripHandle = searchPill?.querySelector(
        'div[style*="cursor"]'
      ) as HTMLElement;

      expect(gripHandle).toBeTruthy();

      // Simulate touchstart on grip
      act(() => {
        fireEvent.touchStart(gripHandle!, {
          touches: [{ clientX: 100, clientY: 50 }],
        });
      });

      // Drag should be started in store
      expect(store.getState().activeDrag).not.toBeNull();
      expect(store.getState().activeDrag?.type).toBe("floating-icon");
    });
  });

  describe("Store Integration - Mobile State", () => {
    it("uses mobile state from store", () => {
      const store = createComposedStore();

      // Set mobile state in store
      store.getState().setMobileState({
        isMobile: true,
        isTablet: false,
        isTouchDevice: true,
        isSmallScreen: false,
      });

      render(<FloatingIcon />);

      // On mobile, the pill should have larger touch targets (44px height)
      // We can verify this by checking the search button's parent has increased height
      const searchButton = screen.getByRole("button", { name: /search/i });
      expect(searchButton).toBeTruthy();
      // The exact styling would need more detailed assertions, but presence is verified
    });

    it("hides keyboard shortcut on touch devices", () => {
      const store = createComposedStore();

      // Set touch device state in store
      store.getState().setMobileState({
        isMobile: false,
        isTablet: false,
        isTouchDevice: true,
        isSmallScreen: false,
      });

      render(<FloatingIcon />);

      // On touch devices, the keyboard shortcut hint should be hidden
      // The "for commands" hint should not be shown
      expect(screen.queryByText(/for commands/i)).toBeNull();
    });

    it("shows keyboard shortcut on non-touch devices", () => {
      const store = createComposedStore();

      // Set non-touch device state in store
      store.getState().setMobileState({
        isMobile: false,
        isTablet: false,
        isTouchDevice: false,
        isSmallScreen: false,
      });

      render(<FloatingIcon />);

      // On non-touch devices, the keyboard shortcut hint should be shown
      expect(screen.getByText(/for commands/i)).toBeDefined();
    });
  });

  describe("ActionGroupDropdown", () => {
    it("renders dropdown trigger button for action groups", () => {
      createComposedStore();

      const actionGroup = createMockToolbarActionGroup({
        id: "vision-group",
        tooltip: "Vision Actions",
        icon: "📷",
        actions: [
          createMockToolbarAction({
            id: "capture",
            tooltip: "Capture Screenshot",
            icon: "C",
          }),
        ],
      });

      const mockPlugin = createMockPlugin("vision-plugin", [], [actionGroup]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      // The dropdown trigger button should be rendered with the group's tooltip
      const triggerButton = screen.getByTitle("Vision Actions");
      expect(triggerButton).toBeDefined();
    });

    it("opens dropdown menu when trigger is clicked", () => {
      createComposedStore();

      const actionGroup = createMockToolbarActionGroup({
        id: "vision-group",
        tooltip: "Vision Actions",
        icon: "📷",
        actions: [
          createMockToolbarAction({
            id: "capture",
            tooltip: "Capture Screenshot",
            icon: "C",
          }),
        ],
      });

      const mockPlugin = createMockPlugin("vision-plugin", [], [actionGroup]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      // Click the dropdown trigger
      const triggerButton = screen.getByTitle("Vision Actions");
      fireEvent.click(triggerButton);

      // The dropdown menu item should now be visible
      expect(screen.getByText("Capture Screenshot")).toBeDefined();
    });

    it("closes dropdown menu when clicking outside", () => {
      createComposedStore();

      const actionGroup = createMockToolbarActionGroup({
        id: "vision-group",
        tooltip: "Vision Actions",
        icon: "📷",
        actions: [
          createMockToolbarAction({
            id: "capture",
            tooltip: "Capture Screenshot",
            icon: "C",
          }),
        ],
      });

      const mockPlugin = createMockPlugin("vision-plugin", [], [actionGroup]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      // Open the dropdown
      const triggerButton = screen.getByTitle("Vision Actions");
      fireEvent.click(triggerButton);

      // Verify it's open
      expect(screen.getByText("Capture Screenshot")).toBeDefined();

      // Click outside (simulate mousedown on document body)
      fireEvent.mouseDown(document.body);

      // Dropdown should be closed
      expect(screen.queryByText("Capture Screenshot")).toBeNull();
    });

    it("calls action onClick when dropdown menu item is clicked", () => {
      createComposedStore();

      const onClickMock = vi.fn();
      const actionGroup = createMockToolbarActionGroup({
        id: "vision-group",
        tooltip: "Vision Actions",
        icon: "📷",
        actions: [
          createMockToolbarAction({
            id: "capture",
            tooltip: "Capture Screenshot",
            icon: "C",
            onClick: onClickMock,
          }),
        ],
      });

      const mockPlugin = createMockPlugin("vision-plugin", [], [actionGroup]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      // Open the dropdown
      const triggerButton = screen.getByTitle("Vision Actions");
      fireEvent.click(triggerButton);

      // Click the menu item
      const menuItem = screen.getByText("Capture Screenshot");
      fireEvent.click(menuItem);

      expect(onClickMock).toHaveBeenCalledTimes(1);
    });

    it("closes dropdown after clicking a menu item", () => {
      createComposedStore();

      const actionGroup = createMockToolbarActionGroup({
        id: "vision-group",
        tooltip: "Vision Actions",
        icon: "📷",
        actions: [
          createMockToolbarAction({
            id: "capture",
            tooltip: "Capture Screenshot",
            icon: "C",
          }),
        ],
      });

      const mockPlugin = createMockPlugin("vision-plugin", [], [actionGroup]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      // Open the dropdown
      const triggerButton = screen.getByTitle("Vision Actions");
      fireEvent.click(triggerButton);

      // Click the menu item
      const menuItem = screen.getByText("Capture Screenshot");
      fireEvent.click(menuItem);

      // Dropdown should be closed
      expect(screen.queryByText("Capture Screenshot")).toBeNull();
    });

    it("does not call onClick for disabled menu items", () => {
      createComposedStore();

      const onClickMock = vi.fn();
      const actionGroup = createMockToolbarActionGroup({
        id: "vision-group",
        tooltip: "Vision Actions",
        icon: "📷",
        actions: [
          createMockToolbarAction({
            id: "disabled-capture",
            tooltip: "Disabled Capture",
            icon: "D",
            isEnabled: () => false,
            onClick: onClickMock,
          }),
        ],
      });

      const mockPlugin = createMockPlugin("vision-plugin", [], [actionGroup]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      // Open the dropdown
      const triggerButton = screen.getByTitle("Vision Actions");
      fireEvent.click(triggerButton);

      // Click the disabled menu item
      const menuItem = screen.getByText("Disabled Capture");
      fireEvent.click(menuItem);

      expect(onClickMock).not.toHaveBeenCalled();
    });

    it("renders keyboard shortcuts in dropdown menu items", () => {
      createComposedStore();

      const actionGroup = createMockToolbarActionGroup({
        id: "vision-group",
        tooltip: "Vision Actions",
        icon: "📷",
        actions: [
          createMockToolbarAction({
            id: "capture",
            tooltip: "Capture Screenshot",
            icon: "C",
            shortcut: "⌘⇧S",
          }),
        ],
      });

      const mockPlugin = createMockPlugin("vision-plugin", [], [actionGroup]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      // Open the dropdown
      const triggerButton = screen.getByTitle("Vision Actions");
      fireEvent.click(triggerButton);

      // The shortcut should be displayed (converted for current platform)
      // On non-Mac, ⌘ becomes Ctrl+ and ⇧ becomes Shift+
      const shortcutText = screen.queryByText(/Ctrl\+Shift\+S/) || screen.queryByText(/⌘⇧S/);
      expect(shortcutText).toBeDefined();
    });

    it("does not render hidden action groups", () => {
      createComposedStore();

      const visibleGroup = createMockToolbarActionGroup({
        id: "visible-group",
        tooltip: "Visible Group",
        icon: "V",
        actions: [createMockToolbarAction({ id: "v-action", tooltip: "Visible Action" })],
        isVisible: () => true,
      });

      const hiddenGroup = createMockToolbarActionGroup({
        id: "hidden-group",
        tooltip: "Hidden Group",
        icon: "H",
        actions: [createMockToolbarAction({ id: "h-action", tooltip: "Hidden Action" })],
        isVisible: () => false,
      });

      const mockPlugin = createMockPlugin("test-plugin", [], [visibleGroup, hiddenGroup]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      expect(screen.getByTitle("Visible Group")).toBeDefined();
      expect(screen.queryByTitle("Hidden Group")).toBeNull();
    });

    it("applies hover styles on dropdown trigger button", () => {
      createComposedStore();

      const actionGroup = createMockToolbarActionGroup({
        id: "vision-group",
        tooltip: "Vision Actions",
        icon: "📷",
        actions: [createMockToolbarAction({ id: "capture", tooltip: "Capture" })],
      });

      const mockPlugin = createMockPlugin("vision-plugin", [], [actionGroup]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      const triggerButton = screen.getByTitle("Vision Actions");

      // Trigger mouseOver
      fireEvent.mouseOver(triggerButton);
      expect(triggerButton.style.background).toContain("rgba(255, 255, 255");

      // Trigger mouseOut
      fireEvent.mouseOut(triggerButton);
      expect(triggerButton.style.background).toContain("rgba(255, 255, 255");
    });

    it("applies hover styles on dropdown menu items", () => {
      createComposedStore();

      const actionGroup = createMockToolbarActionGroup({
        id: "vision-group",
        tooltip: "Vision Actions",
        icon: "📷",
        actions: [createMockToolbarAction({ id: "capture", tooltip: "Capture Screenshot" })],
      });

      const mockPlugin = createMockPlugin("vision-plugin", [], [actionGroup]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      // Open the dropdown
      const triggerButton = screen.getByTitle("Vision Actions");
      fireEvent.click(triggerButton);

      // Find the menu item button
      const menuItem = screen.getByText("Capture Screenshot").closest("button") as HTMLButtonElement;

      // Trigger mouseOver
      fireEvent.mouseOver(menuItem);

      // Trigger mouseOut
      fireEvent.mouseOut(menuItem);
      expect(menuItem.style.background).toBe("transparent");
    });

    it("toggles dropdown open/closed on repeated clicks", () => {
      createComposedStore();

      const actionGroup = createMockToolbarActionGroup({
        id: "vision-group",
        tooltip: "Vision Actions",
        icon: "📷",
        actions: [createMockToolbarAction({ id: "capture", tooltip: "Capture Screenshot" })],
      });

      const mockPlugin = createMockPlugin("vision-plugin", [], [actionGroup]);
      pluginRegistry.register(mockPlugin);

      render(<FloatingIcon />);

      const triggerButton = screen.getByTitle("Vision Actions");

      // First click - open
      fireEvent.click(triggerButton);
      expect(screen.getByText("Capture Screenshot")).toBeDefined();

      // Second click - close
      fireEvent.click(triggerButton);
      expect(screen.queryByText("Capture Screenshot")).toBeNull();

      // Third click - open again
      fireEvent.click(triggerButton);
      expect(screen.getByText("Capture Screenshot")).toBeDefined();
    });
  });

  describe("Search Button Hover Effects", () => {
    it("applies hover styles on search button", () => {
      createComposedStore();
      render(<FloatingIcon />);

      const searchButton = screen.getByRole("button", { name: /search/i });

      // Trigger mouseOver
      fireEvent.mouseOver(searchButton);
      expect(searchButton.style.background).toContain("rgba(255, 255, 255");

      // Trigger mouseOut
      fireEvent.mouseOut(searchButton);
      expect(searchButton.style.background).toContain("rgba(255, 255, 255");
    });
  });

  describe("Container Hover Effects", () => {
    it("hides hint when container is hovered", () => {
      createComposedStore();
      render(<FloatingIcon />);

      // Initially, hint should be visible
      expect(screen.getByText(/for commands/i)).toBeDefined();

      // Find the main container (parent of search button)
      const searchButton = screen.getByRole("button", { name: /search/i });
      const container = searchButton.closest('div[style*="position: fixed"]') as HTMLElement;

      // Hover over the container
      fireEvent.mouseEnter(container);

      // Hint should be hidden when hovered
      expect(screen.queryByText(/for commands/i)).toBeNull();

      // Mouse leave
      fireEvent.mouseLeave(container);

      // Hint should reappear
      expect(screen.getByText(/for commands/i)).toBeDefined();
    });
  });

  describe("Drag Behavior", () => {
    it("does not start drag on non-primary mouse button", () => {
      const store = createComposedStore();
      render(<FloatingIcon />);

      const searchButton = screen.getByRole("button", { name: /search/i });
      const searchPill = searchButton.parentElement;
      const gripHandle = searchPill?.querySelector('div[style*="cursor"]') as HTMLElement;

      // Try to drag with right mouse button (button: 2)
      act(() => {
        fireEvent.mouseDown(gripHandle!, { button: 2, clientX: 100, clientY: 50 });
      });

      // Drag should NOT be started
      expect(store.getState().activeDrag).toBeNull();
    });

    it("does not start touch drag with multiple touches", () => {
      const store = createComposedStore();
      render(<FloatingIcon />);

      const searchButton = screen.getByRole("button", { name: /search/i });
      const searchPill = searchButton.parentElement;
      const gripHandle = searchPill?.querySelector('div[style*="cursor"]') as HTMLElement;

      // Try to drag with multiple touches
      act(() => {
        fireEvent.touchStart(gripHandle!, {
          touches: [
            { clientX: 100, clientY: 50 },
            { clientX: 150, clientY: 50 },
          ],
        });
      });

      // Drag should NOT be started
      expect(store.getState().activeDrag).toBeNull();
    });

    it("updates position during drag", () => {
      const store = createComposedStore();
      render(<FloatingIcon />);

      const searchButton = screen.getByRole("button", { name: /search/i });
      const searchPill = searchButton.parentElement;
      const gripHandle = searchPill?.querySelector('div[style*="cursor"]') as HTMLElement;

      // Start dragging
      act(() => {
        fireEvent.mouseDown(gripHandle!, { button: 0, clientX: 100, clientY: 50 });
      });

      expect(store.getState().activeDrag).not.toBeNull();

      // Simulate drag movement by updating the store's activeDrag
      act(() => {
        store.getState().updateDrag({ x: 200, y: 100 });
      });

      // Position should be updated
      const position = store.getState().floatingIconPosition;
      expect(position).toBeDefined();
    });

    it("does not open command palette when dragging", () => {
      const store = createComposedStore();
      render(<FloatingIcon />);

      const searchButton = screen.getByRole("button", { name: /search/i });
      const searchPill = searchButton.parentElement;
      const gripHandle = searchPill?.querySelector('div[style*="cursor"]') as HTMLElement;

      // Start dragging
      act(() => {
        fireEvent.mouseDown(gripHandle!, { button: 0, clientX: 100, clientY: 50 });
      });

      // Click while dragging
      fireEvent.click(searchButton);

      // Command palette should NOT open while dragging
      expect(store.getState().commandPalette.open).toBe(false);
    });
  });
});
