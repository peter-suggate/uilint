/**
 * Tests for InspectorSidebar component
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { InspectorSidebar } from "./InspectorSidebar";
import {
  createComposedStore,
  resetStore,
} from "../../../core/store/composed-store";
import { pluginRegistry } from "../../../core/plugin-system/registry";

// Mock createPortal to render inline for testing
vi.mock("react-dom", async () => {
  const actual = await vi.importActual("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

// Mock motion/react to avoid animation issues in tests
vi.mock("motion/react", () => {
  const React = require("react");

  function createMotionComponent(tag: string) {
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

describe("InspectorSidebar", () => {
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
    it("does not render when closed", () => {
      const store = createComposedStore();
      expect(store.getState().inspector.open).toBe(false);

      render(<InspectorSidebar />);

      // Should not find inspector elements when closed
      // Title is now "Issues" for the unified view
      expect(screen.queryByText("Issues")).toBeNull();
    });

    it("renders when opened", () => {
      const store = createComposedStore();
      store.getState().openInspector("issue", { issue: null });

      render(<InspectorSidebar />);

      // Close button should be visible
      expect(screen.queryByTitle("Close")).not.toBeNull();
    });

    it("shows issue details panel when opened with issue", () => {
      const store = createComposedStore();
      const mockIssue = {
        id: "test-issue-1",
        ruleId: "no-console",
        message: "Test issue message",
        severity: "warning",
        filePath: "/src/test.ts",
        line: 10,
        column: 5,
      };
      store.getState().openInspector("issue", { issue: mockIssue });

      render(<InspectorSidebar />);

      // Issue details title should be visible
      expect(screen.queryByText("Issue Details")).not.toBeNull();
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

      // Open in floating mode
      store.getState().openInspector("issue", { issue: null });
      store.getState().toggleInspectorDocked(); // Switch to floating

      render(<InspectorSidebar />);

      // On mobile, dock button should be hidden
      expect(screen.queryByTitle("Dock to side")).toBeNull();
      expect(screen.queryByTitle("Undock to floating window")).toBeNull();
    });

    it("shows dock toggle on non-mobile", () => {
      const store = createComposedStore();

      // Set non-mobile state
      store.getState().setMobileState({
        isMobile: false,
        isTablet: false,
        isTouchDevice: false,
        isSmallScreen: false,
      });

      // Ensure docked mode
      if (!store.getState().inspector.docked) {
        store.getState().toggleInspectorDocked();
      }

      // Open inspector in docked mode
      store.getState().openInspector("issue", { issue: null });

      render(<InspectorSidebar />);

      // Dock toggle should be visible (showing undock option when docked)
      expect(screen.queryByTitle("Undock to floating window")).not.toBeNull();
    });
  });

  describe("Store Integration - Drag State", () => {
    it("uses store drag state for floating inspector", () => {
      const store = createComposedStore();

      // Open in floating mode
      store.getState().openInspector("issue", { issue: null });
      store.getState().toggleInspectorDocked();

      // Set initial floating position
      store.getState().setInspectorFloatingPosition({ x: 100, y: 100 });

      render(<InspectorSidebar />);

      // Initially no drag should be active
      expect(store.getState().activeDrag).toBeNull();
    });

    it("starts drag in store when header is mousedown in floating mode", () => {
      const store = createComposedStore();

      // Set non-mobile
      store.getState().setMobileState({
        isMobile: false,
        isTablet: false,
        isTouchDevice: false,
        isSmallScreen: false,
      });

      // Ensure floating mode
      if (store.getState().inspector.docked) {
        store.getState().toggleInspectorDocked();
      }

      // Open in floating mode
      store.getState().openInspector("issue", { issue: null });

      // Set initial floating position
      store.getState().setInspectorFloatingPosition({ x: 100, y: 100 });

      render(<InspectorSidebar />);

      // Find the header by looking for the title text's parent container
      // In floating mode, the header is the element that contains the title and has mouseDown handler
      // Title is now "Issues" for the unified view (or "Issue Details" if opening with issue panel)
      const titleElement = screen.getByText("Issues");
      const header = titleElement.parentElement as HTMLElement;
      expect(header).toBeTruthy();

      // Simulate mousedown on header
      act(() => {
        fireEvent.mouseDown(header!, { button: 0, clientX: 150, clientY: 120 });
      });

      // Drag should be started in store
      expect(store.getState().activeDrag).not.toBeNull();
      expect(store.getState().activeDrag?.type).toBe("inspector-floating");
    });

    it("does not start drag when in docked mode", () => {
      const store = createComposedStore();

      // Ensure docked mode
      if (!store.getState().inspector.docked) {
        store.getState().toggleInspectorDocked();
      }

      // Open in docked mode
      store.getState().openInspector("issue", { issue: null });

      render(<InspectorSidebar />);

      // In docked mode, header should not be draggable
      // Verify inspector is in docked mode
      expect(store.getState().inspector.docked).toBe(true);

      // Drag should not be active
      expect(store.getState().activeDrag).toBeNull();
    });
  });

  describe("Store Integration - Close Action", () => {
    it("closes inspector when close button is clicked", () => {
      const store = createComposedStore();
      store.getState().openInspector("issue", { issue: null });

      render(<InspectorSidebar />);

      // Click close button
      const closeButton = screen.getByTitle("Close");
      fireEvent.click(closeButton);

      expect(store.getState().inspector.open).toBe(false);
    });
  });

  describe("Store Integration - Dock Toggle", () => {
    it("toggles docked state when dock button is clicked", () => {
      const store = createComposedStore();

      // Set non-mobile
      store.getState().setMobileState({
        isMobile: false,
        isTablet: false,
        isTouchDevice: false,
        isSmallScreen: false,
      });

      // Ensure docked mode first
      if (!store.getState().inspector.docked) {
        store.getState().toggleInspectorDocked();
      }

      store.getState().openInspector("issue", { issue: null });
      const initialDocked = store.getState().inspector.docked;
      expect(initialDocked).toBe(true);

      render(<InspectorSidebar />);

      // Click undock button
      const undockButton = screen.getByTitle("Undock to floating window");
      fireEvent.click(undockButton);

      expect(store.getState().inspector.docked).toBe(false);
    });
  });
});
