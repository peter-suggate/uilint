/**
 * Tests for IssuesList component - Inline File Expansion Behavior
 *
 * Tests the hierarchical tile system where:
 * - Rules expand to show file tiles
 * - Files expand INLINE within the rule (keeping rule header visible)
 * - Source views are rendered inside the expanded rule tile
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { IssuesList } from "./IssuesList";
import {
  createComposedStore,
  resetStore,
} from "../../../core/store/composed-store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import { clearFileGroupsCache } from "../../../core/store/file-groups-selector";
import type { Issue } from "../../types";

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

// Mock FileSourceView to simplify testing
vi.mock("./FileSourceView", () => ({
  FileSourceView: ({ filePath }: { filePath: string }) => (
    <div data-testid="file-source-view">FileSourceView: {filePath}</div>
  ),
}));

// ============================================================================
// Test Data
// ============================================================================

function createMockIssues(): Issue[] {
  return [
    {
      id: "issue-1",
      ruleId: "no-unused-vars",
      message: "Variable 'x' is declared but never used",
      severity: "warning",
      line: 10,
      column: 5,
      dataLoc: "src/components/Button.tsx:10:5",
      filePath: "src/components/Button.tsx",
      pluginId: "eslint",
    },
    {
      id: "issue-2",
      ruleId: "no-unused-vars",
      message: "Variable 'y' is declared but never used",
      severity: "warning",
      line: 15,
      column: 3,
      dataLoc: "src/components/Button.tsx:15:3",
      filePath: "src/components/Button.tsx",
      pluginId: "eslint",
    },
    {
      id: "issue-3",
      ruleId: "no-unused-vars",
      message: "Variable 'z' is declared but never used",
      severity: "warning",
      line: 5,
      column: 1,
      dataLoc: "src/utils/helpers.ts:5:1",
      filePath: "src/utils/helpers.ts",
      pluginId: "eslint",
    },
    {
      id: "issue-4",
      ruleId: "no-console",
      message: "Unexpected console statement",
      severity: "error",
      line: 20,
      column: 1,
      dataLoc: "src/components/Button.tsx:20:1",
      filePath: "src/components/Button.tsx",
      pluginId: "eslint",
    },
  ];
}

// ============================================================================
// Test Setup
// ============================================================================

function setupStoreWithIssues(issues: Issue[]) {
  const store = createComposedStore();

  // Convert issues array to Map<string, Issue[]> grouped by pluginId
  // This is the format expected by the file-groups-selector
  const issuesMap = new Map<string, Issue[]>();
  for (const issue of issues) {
    const pluginId = issue.pluginId || "eslint";
    const existing = issuesMap.get(pluginId) || [];
    existing.push(issue);
    issuesMap.set(pluginId, existing);
  }

  // Set issues in the ESLint plugin state
  store.setState((state) => ({
    ...state,
    plugins: {
      ...state.plugins,
      eslint: {
        ...((state.plugins?.eslint as Record<string, unknown>) || {}),
        issues: issuesMap,
        scanStatus: "idle",
      },
    },
  }));
  return store;
}

// ============================================================================
// Tests
// ============================================================================

describe("IssuesList", () => {
  beforeEach(() => {
    resetStore();
    pluginRegistry.clear();
    clearFileGroupsCache();
  });

  afterEach(() => {
    cleanup();
    resetStore();
    pluginRegistry.clear();
    clearFileGroupsCache();
  });

  describe("Basic Rendering", () => {
    it("renders empty state when no issues exist", () => {
      createComposedStore();
      render(<IssuesList />);

      expect(screen.getByText("No issues found")).toBeTruthy();
    });

    it("renders rule tiles when issues exist", () => {
      setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Should show rule tiles (no-unused-vars and no-console)
      expect(screen.getByText("no-unused-vars")).toBeTruthy();
      expect(screen.getByText("no-console")).toBeTruthy();
    });
  });

  describe("Rule Expansion", () => {
    it("expands rule to show file tiles when clicked", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Click on the no-unused-vars rule tile
      const ruleTile = screen.getByText("no-unused-vars");
      fireEvent.click(ruleTile);

      // Wait for expansion
      await waitFor(() => {
        expect(store.getState().inspector.expandedRuleId).toBe("no-unused-vars");
      });

      // Should show file tiles within the expanded rule
      // File names should be visible
      expect(screen.getByText("Button.tsx")).toBeTruthy();
      expect(screen.getByText("helpers.ts")).toBeTruthy();
    });

    it("shows breadcrumbs when rule is expanded", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Expand a rule
      store.getState().expandRule("no-unused-vars");

      await waitFor(() => {
        // Breadcrumbs should show "All Rules" and the rule name
        expect(screen.getByText("All Rules")).toBeTruthy();
        // Rule name appears in both breadcrumbs and context strip
        expect(screen.getAllByText("no-unused-vars").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("collapses rule when clicking All Rules in breadcrumbs", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Expand a rule first
      store.getState().expandRule("no-unused-vars");

      await waitFor(() => {
        expect(store.getState().inspector.expandedRuleId).toBe("no-unused-vars");
      });

      // Click "All Rules" in breadcrumbs
      const allRulesButton = screen.getByText("All Rules");
      fireEvent.click(allRulesButton);

      await waitFor(() => {
        expect(store.getState().inspector.expandedRuleId).toBeNull();
      });
    });
  });

  describe("Inline File Expansion (Core Feature)", () => {
    it("expands file INLINE within the rule, keeping rule header visible", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Expand a rule first
      store.getState().expandRule("no-unused-vars");

      await waitFor(() => {
        expect(screen.getByText("Button.tsx")).toBeTruthy();
      });

      // Click on a file tile to expand it
      const fileTile = screen.getByText("Button.tsx");
      fireEvent.click(fileTile);

      await waitFor(() => {
        expect(store.getState().inspector.expandedFilePath).toBe(
          "src/components/Button.tsx"
        );
      });

      // The rule should still be expanded (file expands INSIDE rule)
      expect(store.getState().inspector.expandedRuleId).toBe("no-unused-vars");
    });

    it("shows issue summary view when file is expanded", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Expand rule and file
      store.getState().expandRule("no-unused-vars");
      store.getState().expandFileInRule("src/components/Button.tsx");

      await waitFor(() => {
        // Should show issue messages in the summary view
        expect(
          screen.getByText("Variable 'x' is declared but never used")
        ).toBeTruthy();
        expect(
          screen.getByText("Variable 'y' is declared but never used")
        ).toBeTruthy();
      });

      // Should have a "View source" button
      expect(screen.getByText("View source")).toBeTruthy();
    });

    it("shows full source view when clicking View source", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Expand rule and file
      store.getState().expandRule("no-unused-vars");
      store.getState().expandFileInRule("src/components/Button.tsx");

      await waitFor(() => {
        expect(screen.getByText("View source")).toBeTruthy();
      });

      // Click "View source"
      const viewSourceButton = screen.getByText("View source");
      fireEvent.click(viewSourceButton);

      await waitFor(() => {
        expect(store.getState().inspector.showFullSource).toBe(true);
      });

      // Should show the FileSourceView component
      expect(screen.getByTestId("file-source-view")).toBeTruthy();
    });

    it("shows full source view when clicking an issue in summary", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Expand rule and file
      store.getState().expandRule("no-unused-vars");
      store.getState().expandFileInRule("src/components/Button.tsx");

      await waitFor(() => {
        expect(
          screen.getByText("Variable 'x' is declared but never used")
        ).toBeTruthy();
      });

      // Click on an issue
      const issueRow = screen.getByText("Variable 'x' is declared but never used");
      fireEvent.click(issueRow);

      await waitFor(() => {
        // Should select the issue and show full source
        expect(store.getState().inspector.selectedIssueId).toBe("issue-1");
        expect(store.getState().inspector.showFullSource).toBe(true);
      });
    });

    it("updates breadcrumbs to show file name when file is expanded", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Expand rule and file
      store.getState().expandRule("no-unused-vars");
      store.getState().expandFileInRule("src/components/Button.tsx");

      await waitFor(() => {
        // Breadcrumbs should show All Rules > rule name > file name
        expect(screen.getByText("All Rules")).toBeTruthy();
        // Rule name appears in both breadcrumbs and context strip
        expect(screen.getAllByText("no-unused-vars").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("Button.tsx")).toBeTruthy();
      });
    });

    it("collapses file but keeps rule expanded when clicking rule in breadcrumbs", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Expand rule and file
      store.getState().expandRule("no-unused-vars");
      store.getState().expandFileInRule("src/components/Button.tsx");

      await waitFor(() => {
        expect(store.getState().inspector.expandedFilePath).toBe(
          "src/components/Button.tsx"
        );
      });

      // Click on rule name in breadcrumbs to collapse file
      // The rule name appears in breadcrumbs and context strip
      // Find the breadcrumb button (the one inside a breadcrumb-like element with max-w-[120px])
      const ruleButtons = screen.getAllByText("no-unused-vars");
      // The breadcrumb button has a truncate/max-w class; the strip item has a different class
      const breadcrumbRuleButton = ruleButtons.find(
        (el) => el.closest("button") && el.className.includes("max-w-[120px]")
      );
      if (breadcrumbRuleButton) {
        const btn = breadcrumbRuleButton.closest("button");
        if (btn) fireEvent.click(btn);
      }

      await waitFor(() => {
        // File should be collapsed, rule should still be expanded
        expect(store.getState().inspector.expandedFilePath).toBeNull();
        expect(store.getState().inspector.expandedRuleId).toBe("no-unused-vars");
      });
    });
  });

  describe("State Persistence", () => {
    it("maintains rule expansion state when navigating between files", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Expand rule
      store.getState().expandRule("no-unused-vars");

      await waitFor(() => {
        expect(store.getState().inspector.expandedRuleId).toBe("no-unused-vars");
      });

      // Expand first file
      store.getState().expandFileInRule("src/components/Button.tsx");

      await waitFor(() => {
        expect(store.getState().inspector.expandedFilePath).toBe(
          "src/components/Button.tsx"
        );
      });

      // Collapse file
      store.getState().collapseFileInRule();

      await waitFor(() => {
        expect(store.getState().inspector.expandedFilePath).toBeNull();
        // Rule should still be expanded
        expect(store.getState().inspector.expandedRuleId).toBe("no-unused-vars");
      });

      // Expand second file
      store.getState().expandFileInRule("src/utils/helpers.ts");

      await waitFor(() => {
        expect(store.getState().inspector.expandedFilePath).toBe(
          "src/utils/helpers.ts"
        );
        // Rule should still be expanded
        expect(store.getState().inspector.expandedRuleId).toBe("no-unused-vars");
      });
    });

    it("clears file expansion when collapsing rule", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Expand rule and file
      store.getState().expandRule("no-unused-vars");
      store.getState().expandFileInRule("src/components/Button.tsx");

      await waitFor(() => {
        expect(store.getState().inspector.expandedRuleId).toBe("no-unused-vars");
        expect(store.getState().inspector.expandedFilePath).toBe(
          "src/components/Button.tsx"
        );
      });

      // Collapse rule
      store.getState().collapseRule();

      await waitFor(() => {
        expect(store.getState().inspector.expandedRuleId).toBeNull();
        expect(store.getState().inspector.expandedFilePath).toBeNull();
      });
    });
  });

  describe("Auto-Expansion from Issue Selection", () => {
    it("auto-expands rule and file when issue is selected (e.g., from heatmap)", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Select an issue (simulating heatmap click)
      store.getState().selectIssue("issue-3"); // This is in helpers.ts

      await waitFor(() => {
        // Should auto-expand the rule containing the issue
        expect(store.getState().inspector.expandedRuleId).toBe("no-unused-vars");
        // Should auto-expand the file containing the issue
        expect(store.getState().inspector.expandedFilePath).toBe(
          "src/utils/helpers.ts"
        );
      });
    });
  });

  describe("Severity Indicator", () => {
    it("shows severity indicator with issue count in expanded rule header", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Expand a rule with error severity (no-console has 1 error)
      store.getState().expandRule("no-console");

      await waitFor(() => {
        // Should show the issue count in the severity indicator
        // no-console has 1 issue
        expect(screen.getByText("1")).toBeTruthy();
      });

      // Collapse and expand a rule with warning severity
      store.getState().collapseRule();
      store.getState().expandRule("no-unused-vars");

      await waitFor(() => {
        // no-unused-vars has 3 issues
        expect(screen.getByText("3")).toBeTruthy();
      });
    });
  });

  describe("Multiple Rules", () => {
    it("only shows files for the expanded rule", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Expand no-unused-vars rule
      store.getState().expandRule("no-unused-vars");

      await waitFor(() => {
        // Should show files for no-unused-vars
        expect(screen.getByText("Button.tsx")).toBeTruthy();
        expect(screen.getByText("helpers.ts")).toBeTruthy();
      });

      // Collapse and expand no-console rule
      store.getState().collapseRule();
      store.getState().expandRule("no-console");

      await waitFor(() => {
        // Should now show files for no-console
        expect(screen.getByText("Button.tsx")).toBeTruthy();
        // helpers.ts should not be visible (no-console only has issues in Button.tsx)
        expect(screen.queryByText("helpers.ts")).toBeNull();
      });
    });

    it("filters issues in file view to only show issues for the expanded rule", async () => {
      const store = setupStoreWithIssues(createMockIssues());
      render(<IssuesList />);

      // Expand no-console rule and Button.tsx file
      store.getState().expandRule("no-console");
      store.getState().expandFileInRule("src/components/Button.tsx");

      await waitFor(() => {
        // Should show the no-console issue in the issue summary view
        expect(screen.getByText("Unexpected console statement")).toBeTruthy();
      });

      // The issue summary should only have one issue row for no-console
      // We can verify by checking the line number - no-console is on line 20
      // and no-unused-vars is on lines 10 and 15
      await waitFor(() => {
        // Line 20 should be visible (no-console issue)
        expect(screen.getByText("20")).toBeTruthy();
        // Verify we're in the issue summary view (meaning we're viewing
        // the correct content and "View source" button is available)
        expect(screen.getByText("View source")).toBeTruthy();
      });
    });
  });
});
