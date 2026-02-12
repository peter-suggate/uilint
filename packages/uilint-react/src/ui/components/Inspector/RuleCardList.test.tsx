/**
 * Tests for RuleCardList component
 * @vitest-environment jsdom
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { RuleCardList } from "./RuleCardList";
import {
  createComposedStore,
  resetStore,
} from "../../../core/store/composed-store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import type { Issue } from "../../types";

// Mock motion/react to avoid animation timing noise in tests
vi.mock("motion/react", () => {
  const React = require("react");
  const motion = new Proxy(
    {},
    {
      get(_target: unknown, tag: string) {
        return React.forwardRef(
          (props: Record<string, unknown>, ref: unknown) => {
            const filtered: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(props)) {
              if (
                ![
                  "initial",
                  "animate",
                  "exit",
                  "transition",
                  "layout",
                  "layoutId",
                ].includes(key)
              ) {
                filtered[key] = value;
              }
            }
            return React.createElement(tag, { ...filtered, ref });
          }
        );
      },
    }
  );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion,
  };
});

vi.mock("./FileSourceView", () => ({
  FileSourceView: ({ filePath }: { filePath: string }) => (
    <div data-testid="file-source-view">source:{filePath}</div>
  ),
}));

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
      dataLoc: "src/utils/helpers.ts:15:3",
      filePath: "src/utils/helpers.ts",
      pluginId: "eslint",
    },
    {
      id: "issue-3",
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

function setupStoreWithIssues(issues: Issue[]) {
  const store = createComposedStore();
  const issuesMap = new Map<string, Issue[]>();
  for (const issue of issues) {
    const existing = issuesMap.get(issue.dataLoc) ?? [];
    existing.push(issue);
    issuesMap.set(issue.dataLoc, existing);
  }

  store.setState((state) => ({
    ...state,
    plugins: {
      ...state.plugins,
      eslint: {
        ...((state.plugins?.eslint as Record<string, unknown>) ?? {}),
        issues: issuesMap,
        availableRules: [],
      },
    },
  }));

  return store;
}

describe("RuleCardList", () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterAll(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  beforeEach(() => {
    resetStore();
    pluginRegistry.clear();
  });

  afterEach(() => {
    cleanup();
    resetStore();
    pluginRegistry.clear();
  });

  it("renders rule cards and expands a rule to show files", async () => {
    const store = setupStoreWithIssues(createMockIssues());
    render(<RuleCardList />);

    store.getState().expandRule("no-unused-vars");

    await waitFor(() => {
      expect(screen.getByText("Files with issues")).toBeTruthy();
      expect(screen.getByText("helpers.ts")).toBeTruthy();
    });
  });

  it("supports back navigation from expanded file to file list", async () => {
    const store = setupStoreWithIssues(createMockIssues());
    render(<RuleCardList />);

    store.getState().expandRule("no-unused-vars");

    await waitFor(() => {
      expect(screen.getByText("helpers.ts")).toBeTruthy();
    });

    store.getState().expandFileInRule("src/components/Button.tsx");

    await waitFor(() => {
      expect(screen.getByLabelText("Back to file list")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("Back to file list"));

    await waitFor(() => {
      expect(screen.getByText("Files with issues")).toBeTruthy();
      expect(screen.queryByLabelText("Back to file list")).toBeNull();
    });
  });

  it("filters rule cards by severity from health pulse filter", async () => {
    const store = setupStoreWithIssues(createMockIssues());
    store.getState().setHealthPulseSeverityFilter("error");

    render(<RuleCardList />);

    await waitFor(() => {
      expect(screen.getByText("no-console")).toBeTruthy();
      expect(screen.queryByText("no-unused-vars")).toBeNull();
    });
  });

  it("transitions from issue summary to source view on issue click", async () => {
    const store = setupStoreWithIssues(createMockIssues());
    render(<RuleCardList />);

    store.getState().expandRule("no-unused-vars");
    store.getState().expandFileInRule("src/components/Button.tsx");

    await waitFor(() => {
      expect(
        screen.getByText("Variable 'x' is declared but never used")
      ).toBeTruthy();
    });

    fireEvent.click(
      screen.getByText("Variable 'x' is declared but never used")
    );

    await waitFor(() => {
      expect(screen.getByTestId("file-source-view")).toBeTruthy();
    });
  });

  it("auto-expands rule and file when selectedIssueId is set", async () => {
    const store = setupStoreWithIssues(createMockIssues());
    render(<RuleCardList />);

    store.getState().selectIssue("issue-3");

    await waitFor(() => {
      expect(store.getState().inspector.expandedRuleId).toBe("no-console");
      expect(store.getState().inspector.expandedFilePath).toBe(
        "src/components/Button.tsx"
      );
    });
  });
});
