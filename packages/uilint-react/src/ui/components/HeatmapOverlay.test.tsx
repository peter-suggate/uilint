/**
 * Tests for HeatmapOverlay component
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { HeatmapOverlay } from "./HeatmapOverlay";
import {
  createComposedStore,
  resetStore,
} from "../../core/store/composed-store";
import type { PluginSliceMap } from "../../core/store/composed-store";

// Mock createPortal to render inline for testing
vi.mock("react-dom", async () => {
  const actual = await vi.importActual("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

// Mock useElementRects to return controlled rect data
vi.mock("../hooks/useElementRects", () => ({
  useElementRects: vi.fn(() => new Map()),
}));

import { useElementRects } from "../hooks/useElementRects";

/**
 * Helper to set up the store with eslint issues
 */
function setupStoreWithIssues(
  issuesMap: Map<
    string,
    Array<{
      ruleId: string;
      message: string;
      filePath?: string;
      line?: number;
      column?: number;
    }>
  >
) {
  const store = createComposedStore();

  store.getState().registerPluginSlice("eslint", {
    availableRules: [],
    ruleConfigs: new Map(),
    issues: issuesMap,
    ruleConfigUpdating: new Map(),
  } as unknown as PluginSliceMap["eslint"]);

  return store;
}

/**
 * Helper to create mock element rects
 */
function mockElementRects(
  rects: Map<string, { rect: DOMRect; element: HTMLElement }>
) {
  (useElementRects as ReturnType<typeof vi.fn>).mockReturnValue(rects);
}

describe("HeatmapOverlay", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    resetStore();
  });

  describe("Basic Rendering", () => {
    it("renders nothing when there are no issues", () => {
      createComposedStore();
      const { container } = render(<HeatmapOverlay />);

      // Should render empty (null returned)
      expect(container.firstChild).toBeNull();
    });

    it("renders overlay items when issues exist", () => {
      const issuesMap = new Map();
      issuesMap.set("src/App.tsx:10:5", [
        {
          id: "issue-1",
          ruleId: "no-console",
          message: "Unexpected console statement",
          filePath: "src/App.tsx",
          line: 10,
          column: 5,
          severity: "warning",
        },
      ]);
      setupStoreWithIssues(issuesMap);

      // Mock element rects
      const mockRect = new DOMRect(100, 100, 200, 50);
      const rects = new Map([
        [
          "src/App.tsx:10:5",
          { rect: mockRect, element: document.createElement("div") },
        ],
      ]);
      mockElementRects(rects);

      const { container } = render(<HeatmapOverlay />);

      // Should render the overlay container
      expect(container.firstChild).not.toBeNull();
    });
  });

  describe("Badge Click Behavior", () => {
    it("adds file filter when badge is clicked", () => {
      const issuesMap = new Map();
      issuesMap.set("src/components/Button.tsx:15:3", [
        {
          id: "issue-1",
          ruleId: "no-unused-vars",
          message: "Variable is defined but never used",
          filePath: "src/components/Button.tsx",
          line: 15,
          column: 3,
          severity: "warning",
        },
      ]);
      const store = setupStoreWithIssues(issuesMap);

      // Mock element rects
      const mockRect = new DOMRect(100, 100, 200, 50);
      const rects = new Map([
        [
          "src/components/Button.tsx:15:3",
          { rect: mockRect, element: document.createElement("div") },
        ],
      ]);
      mockElementRects(rects);

      const { container } = render(<HeatmapOverlay />);

      // Find the badge (span with issue count)
      const badge = container.querySelector(
        'span[style*="pointer-events: auto"]'
      );
      expect(badge).not.toBeNull();

      // Click the badge
      act(() => {
        fireEvent.click(badge!);
      });

      // Verify file filter was added
      const filters = store.getState().commandPalette.filters;
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        type: "file",
        id: "src/components/Button.tsx",
        label: "Button.tsx",
      });
    });

    it("opens inspector panel when badge is clicked", () => {
      const issuesMap = new Map();
      issuesMap.set("src/App.tsx:10:5", [
        {
          id: "issue-1",
          ruleId: "no-console",
          message: "Unexpected console statement",
          filePath: "src/App.tsx",
          line: 10,
          column: 5,
          severity: "warning",
        },
      ]);
      const store = setupStoreWithIssues(issuesMap);

      const mockRect = new DOMRect(100, 100, 200, 50);
      const rects = new Map([
        [
          "src/App.tsx:10:5",
          { rect: mockRect, element: document.createElement("div") },
        ],
      ]);
      mockElementRects(rects);

      const { container } = render(<HeatmapOverlay />);

      const badge = container.querySelector(
        'span[style*="pointer-events: auto"]'
      );

      act(() => {
        fireEvent.click(badge!);
      });

      // Verify inspector panel was opened
      expect(store.getState().inspector.open).toBe(true);
    });

    it("expands file and selects first issue when badge is clicked", () => {
      const issuesMap = new Map();
      issuesMap.set("src/utils/helpers.ts:25:10", [
        {
          id: "issue-1",
          ruleId: "no-unused-vars",
          message: "Unused variable",
          filePath: "src/utils/helpers.ts",
          line: 25,
          column: 10,
          severity: "warning",
        },
        {
          id: "issue-2",
          ruleId: "no-console",
          message: "No console",
          filePath: "src/utils/helpers.ts",
          line: 26,
          column: 5,
          severity: "error",
        },
      ]);
      const store = setupStoreWithIssues(issuesMap);

      const mockRect = new DOMRect(100, 100, 200, 50);
      const rects = new Map([
        [
          "src/utils/helpers.ts:25:10",
          { rect: mockRect, element: document.createElement("div") },
        ],
      ]);
      mockElementRects(rects);

      const { container } = render(<HeatmapOverlay />);

      const badge = container.querySelector(
        'span[style*="pointer-events: auto"]'
      );

      act(() => {
        fireEvent.click(badge!);
      });

      // Verify file was expanded
      expect(store.getState().inspector.expandedFiles).toContain(
        "src/utils/helpers.ts"
      );

      // Verify first issue was selected
      expect(store.getState().inspector.selectedIssueId).toBe("issue-1");
    });
  });

  describe("Pointer Events", () => {
    it("element rectangle has pointerEvents: none for click-through", () => {
      const issuesMap = new Map();
      issuesMap.set("src/App.tsx:10:5", [
        {
          id: "issue-1",
          ruleId: "no-console",
          message: "Unexpected console statement",
          filePath: "src/App.tsx",
          line: 10,
          column: 5,
          severity: "warning",
        },
      ]);
      setupStoreWithIssues(issuesMap);

      const mockRect = new DOMRect(100, 100, 200, 50);
      const rects = new Map([
        [
          "src/App.tsx:10:5",
          { rect: mockRect, element: document.createElement("div") },
        ],
      ]);
      mockElementRects(rects);

      const { container } = render(<HeatmapOverlay />);

      // Find the overlay item div (has border styling)
      const overlayItem = container.querySelector(
        'div[style*="border"][style*="position: fixed"]'
      );

      expect(overlayItem).not.toBeNull();
      expect((overlayItem as HTMLElement).style.pointerEvents).toBe("none");
    });

    it("badge has pointerEvents: auto for click handling", () => {
      const issuesMap = new Map();
      issuesMap.set("src/App.tsx:10:5", [
        {
          id: "issue-1",
          ruleId: "no-console",
          message: "Unexpected console statement",
          filePath: "src/App.tsx",
          line: 10,
          column: 5,
          severity: "warning",
        },
      ]);
      setupStoreWithIssues(issuesMap);

      const mockRect = new DOMRect(100, 100, 200, 50);
      const rects = new Map([
        [
          "src/App.tsx:10:5",
          { rect: mockRect, element: document.createElement("div") },
        ],
      ]);
      mockElementRects(rects);

      const { container } = render(<HeatmapOverlay />);

      // Find the badge span
      const badge = container.querySelector(
        'span[style*="pointer-events: auto"]'
      );

      expect(badge).not.toBeNull();
    });
  });

  describe("Badge Design", () => {
    it("badge is positioned flush with corner (top: 0, right: 0)", () => {
      const issuesMap = new Map();
      issuesMap.set("src/App.tsx:10:5", [
        {
          id: "issue-1",
          ruleId: "no-console",
          message: "Unexpected console statement",
          filePath: "src/App.tsx",
          line: 10,
          column: 5,
          severity: "warning",
        },
      ]);
      setupStoreWithIssues(issuesMap);

      const mockRect = new DOMRect(100, 100, 200, 50);
      const rects = new Map([
        [
          "src/App.tsx:10:5",
          { rect: mockRect, element: document.createElement("div") },
        ],
      ]);
      mockElementRects(rects);

      const { container } = render(<HeatmapOverlay />);

      const badge = container.querySelector(
        'span[style*="pointer-events: auto"]'
      ) as HTMLElement;

      expect(badge).not.toBeNull();
      expect(badge.style.top).toBe("0px");
      expect(badge.style.right).toBe("0px");
    });

    it("badge has square border radius (2px)", () => {
      const issuesMap = new Map();
      issuesMap.set("src/App.tsx:10:5", [
        {
          id: "issue-1",
          ruleId: "no-console",
          message: "Unexpected console statement",
          filePath: "src/App.tsx",
          line: 10,
          column: 5,
          severity: "warning",
        },
      ]);
      setupStoreWithIssues(issuesMap);

      const mockRect = new DOMRect(100, 100, 200, 50);
      const rects = new Map([
        [
          "src/App.tsx:10:5",
          { rect: mockRect, element: document.createElement("div") },
        ],
      ]);
      mockElementRects(rects);

      const { container } = render(<HeatmapOverlay />);

      const badge = container.querySelector(
        'span[style*="pointer-events: auto"]'
      ) as HTMLElement;

      expect(badge).not.toBeNull();
      expect(badge.style.borderRadius).toBe("2px");
    });

    it("badge displays issue count", () => {
      const issuesMap = new Map();
      issuesMap.set("src/App.tsx:10:5", [
        {
          id: "issue-1",
          ruleId: "no-console",
          message: "Console 1",
          filePath: "src/App.tsx",
          line: 10,
          column: 5,
          severity: "warning",
        },
        {
          id: "issue-2",
          ruleId: "no-unused-vars",
          message: "Unused var",
          filePath: "src/App.tsx",
          line: 10,
          column: 5,
          severity: "error",
        },
        {
          id: "issue-3",
          ruleId: "prefer-const",
          message: "Use const",
          filePath: "src/App.tsx",
          line: 10,
          column: 5,
          severity: "info",
        },
      ]);
      setupStoreWithIssues(issuesMap);

      const mockRect = new DOMRect(100, 100, 200, 50);
      const rects = new Map([
        [
          "src/App.tsx:10:5",
          { rect: mockRect, element: document.createElement("div") },
        ],
      ]);
      mockElementRects(rects);

      const { container } = render(<HeatmapOverlay />);

      const badge = container.querySelector(
        'span[style*="pointer-events: auto"]'
      );

      expect(badge).not.toBeNull();
      expect(badge?.textContent).toBe("3");
    });
  });

  describe("Badge Hover Behavior", () => {
    it("updates hovered element on badge mouseenter", () => {
      const issuesMap = new Map();
      issuesMap.set("src/App.tsx:10:5", [
        {
          id: "issue-1",
          ruleId: "no-console",
          message: "Unexpected console statement",
          filePath: "src/App.tsx",
          line: 10,
          column: 5,
          severity: "warning",
        },
      ]);
      const store = setupStoreWithIssues(issuesMap);

      const mockRect = new DOMRect(100, 100, 200, 50);
      const rects = new Map([
        [
          "src/App.tsx:10:5",
          { rect: mockRect, element: document.createElement("div") },
        ],
      ]);
      mockElementRects(rects);

      const { container } = render(<HeatmapOverlay />);

      const badge = container.querySelector(
        'span[style*="pointer-events: auto"]'
      );

      act(() => {
        fireEvent.mouseEnter(badge!);
      });

      expect(store.getState().hoveredElementId).toBe("src/App.tsx:10:5");
    });

    it("clears hovered element on badge mouseleave", () => {
      const issuesMap = new Map();
      issuesMap.set("src/App.tsx:10:5", [
        {
          id: "issue-1",
          ruleId: "no-console",
          message: "Unexpected console statement",
          filePath: "src/App.tsx",
          line: 10,
          column: 5,
          severity: "warning",
        },
      ]);
      const store = setupStoreWithIssues(issuesMap);

      const mockRect = new DOMRect(100, 100, 200, 50);
      const rects = new Map([
        [
          "src/App.tsx:10:5",
          { rect: mockRect, element: document.createElement("div") },
        ],
      ]);
      mockElementRects(rects);

      const { container } = render(<HeatmapOverlay />);

      const badge = container.querySelector(
        'span[style*="pointer-events: auto"]'
      );

      // First hover
      act(() => {
        fireEvent.mouseEnter(badge!);
      });

      expect(store.getState().hoveredElementId).toBe("src/App.tsx:10:5");

      // Then leave
      act(() => {
        fireEvent.mouseLeave(badge!);
      });

      expect(store.getState().hoveredElementId).toBeNull();
    });
  });

  describe("Multiple Elements", () => {
    it("renders multiple badges for multiple elements", () => {
      const issuesMap = new Map();
      issuesMap.set("src/App.tsx:10:5", [
        {
          id: "issue-1",
          ruleId: "no-console",
          message: "Console in App",
          filePath: "src/App.tsx",
          line: 10,
          column: 5,
          severity: "warning",
        },
      ]);
      issuesMap.set("src/Button.tsx:20:3", [
        {
          id: "issue-2",
          ruleId: "no-unused-vars",
          message: "Unused in Button",
          filePath: "src/Button.tsx",
          line: 20,
          column: 3,
          severity: "error",
        },
      ]);
      setupStoreWithIssues(issuesMap);

      const mockRect1 = new DOMRect(100, 100, 200, 50);
      const mockRect2 = new DOMRect(100, 200, 200, 50);
      const rects = new Map([
        [
          "src/App.tsx:10:5",
          { rect: mockRect1, element: document.createElement("div") },
        ],
        [
          "src/Button.tsx:20:3",
          { rect: mockRect2, element: document.createElement("div") },
        ],
      ]);
      mockElementRects(rects);

      const { container } = render(<HeatmapOverlay />);

      const badges = container.querySelectorAll(
        'span[style*="pointer-events: auto"]'
      );
      expect(badges).toHaveLength(2);
    });

    it("adds file filter for the clicked badge element", () => {
      const issuesMap = new Map();
      issuesMap.set("src/App.tsx:10:5", [
        {
          id: "issue-1",
          ruleId: "no-console",
          message: "Console in App",
          filePath: "src/App.tsx",
          line: 10,
          column: 5,
          severity: "warning",
        },
      ]);
      const store = setupStoreWithIssues(issuesMap);

      const mockRect1 = new DOMRect(100, 100, 200, 50);
      const rects = new Map([
        [
          "src/App.tsx:10:5",
          { rect: mockRect1, element: document.createElement("div") },
        ],
      ]);
      mockElementRects(rects);

      const { container } = render(<HeatmapOverlay />);

      const badge = container.querySelector(
        'span[style*="pointer-events: auto"]'
      );

      act(() => {
        fireEvent.click(badge!);
      });

      // File filter should be added
      const filters = store.getState().commandPalette.filters;
      expect(filters).toHaveLength(1);
      expect(filters[0].type).toBe("file");
      expect(filters[0].id).toBe("src/App.tsx");
      expect(filters[0].label).toBe("App.tsx");
    });
  });
});
