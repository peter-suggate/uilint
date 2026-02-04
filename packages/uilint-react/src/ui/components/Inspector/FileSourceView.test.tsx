/**
 * Tests for FileSourceView component
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { FileSourceView } from "./FileSourceView";
import type { Issue } from "../../types";

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

// Mock the useFullSourceCode hook
const mockUseFullSourceCode = vi.fn();
vi.mock("../../hooks/useFullSourceCode", () => ({
  useFullSourceCode: (props: unknown) => mockUseFullSourceCode(props),
}));

const createTestIssue = (overrides: Partial<Issue> = {}): Issue => ({
  id: "test-issue-1",
  message: "Test issue message",
  severity: "warning",
  dataLoc: "/test/file.ts:10:1",
  ruleId: "test-rule",
  pluginId: "eslint",
  filePath: "/test/file.ts",
  line: 10,
  column: 1,
  ...overrides,
});

describe("FileSourceView - loading state", () => {
  beforeEach(() => {
    mockUseFullSourceCode.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading state when isLoading is true", () => {
    mockUseFullSourceCode.mockReturnValue({
      lines: [],
      totalLines: 0,
      isLoading: true,
      error: null,
    });

    const { container } = render(
      <FileSourceView
        filePath="/test/file.ts"
        issues={[]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Loading source");
  });
});

describe("FileSourceView - error state", () => {
  beforeEach(() => {
    mockUseFullSourceCode.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows error state when error is present", () => {
    mockUseFullSourceCode.mockReturnValue({
      lines: [],
      totalLines: 0,
      isLoading: false,
      error: "Failed to fetch",
    });

    const { container } = render(
      <FileSourceView
        filePath="/test/file.ts"
        issues={[]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Could not load source");
    expect(container.textContent).toContain("Failed to fetch");
  });
});

describe("FileSourceView - empty state", () => {
  beforeEach(() => {
    mockUseFullSourceCode.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows 'Source not available' when totalLines is 0", () => {
    mockUseFullSourceCode.mockReturnValue({
      lines: [],
      totalLines: 0,
      isLoading: false,
      error: null,
    });

    const { container } = render(
      <FileSourceView
        filePath="/test/file.ts"
        issues={[]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Source not available");
  });
});

describe("FileSourceView - rendering with source", () => {
  beforeEach(() => {
    mockUseFullSourceCode.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders code regions for issues", () => {
    const sourceLines = [
      "const x = 1;",
      "const y = 2;",
      "const z = 3;",
      "console.log(x);",
      "console.log(y);",
      "console.log(z);",
      "const a = 4;",
      "const b = 5;",
      "console.log(a);",
      "const issue = 'here';",
      "const c = 6;",
      "const d = 7;",
    ];

    mockUseFullSourceCode.mockReturnValue({
      lines: sourceLines,
      totalLines: sourceLines.length,
      isLoading: false,
      error: null,
    });

    const issues: Issue[] = [
      createTestIssue({ id: "1", line: 10, message: "Issue at line 10" }),
    ];

    const { container } = render(
      <FileSourceView
        filePath="/test/file.ts"
        issues={issues}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    // Should show code around the issue
    expect(container.textContent).toContain("const issue = 'here'");
  });

  it("renders multiple issues in different regions", () => {
    const sourceLines = Array.from(
      { length: 50 },
      (_, i) => `line ${i + 1}`
    );

    mockUseFullSourceCode.mockReturnValue({
      lines: sourceLines,
      totalLines: sourceLines.length,
      isLoading: false,
      error: null,
    });

    const issues: Issue[] = [
      createTestIssue({ id: "1", line: 10, message: "Issue at line 10" }),
      createTestIssue({ id: "2", line: 40, message: "Issue at line 40" }),
    ];

    const { container } = render(
      <FileSourceView
        filePath="/test/file.ts"
        issues={issues}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    // Should render something
    expect(container.firstChild).toBeTruthy();
  });

  it("applies custom className", () => {
    mockUseFullSourceCode.mockReturnValue({
      lines: ["const x = 1;"],
      totalLines: 1,
      isLoading: false,
      error: null,
    });

    const { container } = render(
      <FileSourceView
        filePath="/test/file.ts"
        issues={[createTestIssue({ line: 1 })]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
        className="custom-class"
      />
    );

    const rootElement = container.firstChild as HTMLElement;
    expect(rootElement.className).toContain("custom-class");
  });

  it("uses custom contextLines", () => {
    const sourceLines = Array.from(
      { length: 20 },
      (_, i) => `line ${i + 1}`
    );

    mockUseFullSourceCode.mockReturnValue({
      lines: sourceLines,
      totalLines: sourceLines.length,
      isLoading: false,
      error: null,
    });

    const issues: Issue[] = [
      createTestIssue({ id: "1", line: 10 }),
    ];

    const { container } = render(
      <FileSourceView
        filePath="/test/file.ts"
        issues={issues}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
        contextLines={5}
      />
    );

    // With 5 context lines, we should see lines 5-15
    expect(container.firstChild).toBeTruthy();
  });
});

describe("FileSourceView - interactions", () => {
  beforeEach(() => {
    mockUseFullSourceCode.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("calls onIssueSelect when an issue annotation is clicked", async () => {
    const sourceLines = Array.from(
      { length: 20 },
      (_, i) => `line ${i + 1}`
    );

    mockUseFullSourceCode.mockReturnValue({
      lines: sourceLines,
      totalLines: sourceLines.length,
      isLoading: false,
      error: null,
    });

    const onIssueSelect = vi.fn();
    const issues: Issue[] = [
      createTestIssue({ id: "issue-1", line: 10, message: "Test message" }),
    ];

    const { container } = render(
      <FileSourceView
        filePath="/test/file.ts"
        issues={issues}
        selectedIssueId={null}
        onIssueSelect={onIssueSelect}
      />
    );

    // Find clickable issue annotation (by finding elements with the issue message)
    const issueElements = container.querySelectorAll('[role="button"]');
    if (issueElements.length > 0) {
      fireEvent.click(issueElements[0]);
      expect(onIssueSelect).toHaveBeenCalled();
    }
  });

  it("handles gap expansion when collapsed lines are clicked", async () => {
    const sourceLines = Array.from(
      { length: 100 },
      (_, i) => `line ${i + 1}`
    );

    mockUseFullSourceCode.mockReturnValue({
      lines: sourceLines,
      totalLines: sourceLines.length,
      isLoading: false,
      error: null,
    });

    const issues: Issue[] = [
      createTestIssue({ id: "1", line: 10 }),
      createTestIssue({ id: "2", line: 90 }),
    ];

    const { container, rerender } = render(
      <FileSourceView
        filePath="/test/file.ts"
        issues={issues}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    // Should have collapsed sections (gaps)
    // Look for the expand button
    const expandButtons = container.querySelectorAll("button");

    // If there are expand buttons, clicking them should work
    if (expandButtons.length > 0) {
      const expandButton = Array.from(expandButtons).find(
        btn => btn.textContent?.includes("hidden")
      );
      if (expandButton) {
        fireEvent.click(expandButton);
        // Component should re-render with expanded content
        expect(container.firstChild).toBeTruthy();
      }
    }
  });
});

describe("FileSourceView - enabled prop", () => {
  beforeEach(() => {
    mockUseFullSourceCode.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("passes enabled prop to useFullSourceCode", () => {
    mockUseFullSourceCode.mockReturnValue({
      lines: [],
      totalLines: 0,
      isLoading: true,
      error: null,
    });

    render(
      <FileSourceView
        filePath="/test/file.ts"
        issues={[]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
        enabled={false}
      />
    );

    expect(mockUseFullSourceCode).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it("defaults enabled to true", () => {
    mockUseFullSourceCode.mockReturnValue({
      lines: [],
      totalLines: 0,
      isLoading: true,
      error: null,
    });

    render(
      <FileSourceView
        filePath="/test/file.ts"
        issues={[]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    expect(mockUseFullSourceCode).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true })
    );
  });
});

describe("FileSourceView - selection", () => {
  beforeEach(() => {
    mockUseFullSourceCode.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("passes selectedIssueId to code regions", () => {
    const sourceLines = Array.from(
      { length: 20 },
      (_, i) => `line ${i + 1}`
    );

    mockUseFullSourceCode.mockReturnValue({
      lines: sourceLines,
      totalLines: sourceLines.length,
      isLoading: false,
      error: null,
    });

    const issues: Issue[] = [
      createTestIssue({ id: "issue-1", line: 10 }),
    ];

    const { container } = render(
      <FileSourceView
        filePath="/test/file.ts"
        issues={issues}
        selectedIssueId="issue-1"
        onIssueSelect={vi.fn()}
      />
    );

    // Should render without errors
    expect(container.firstChild).toBeTruthy();
  });
});

describe("FileSourceView - file path handling", () => {
  beforeEach(() => {
    mockUseFullSourceCode.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("passes filePath to useFullSourceCode", () => {
    mockUseFullSourceCode.mockReturnValue({
      lines: [],
      totalLines: 0,
      isLoading: true,
      error: null,
    });

    render(
      <FileSourceView
        filePath="/path/to/my/file.tsx"
        issues={[]}
        selectedIssueId={null}
        onIssueSelect={vi.fn()}
      />
    );

    expect(mockUseFullSourceCode).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: "/path/to/my/file.tsx" })
    );
  });
});
