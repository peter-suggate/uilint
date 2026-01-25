/**
 * Tests for Fix Prompt Panel prompt generation
 *
 * Tests the conditional prompt generation based on hook availability.
 * When hooks are available, prompts should be condensed (files only).
 * When hooks are not available, prompts should be detailed (all issues).
 */

import { describe, it, expect } from "vitest";
import type { Issue } from "../../ui/types";

// Import the module to access the generateFixPrompt function
// We need to test the pure function, so we'll extract it

/**
 * Group issues by file path (copied from FixPromptPanel for testing)
 */
function groupIssuesByFile(issues: Issue[]): Map<string, Issue[]> {
  const grouped = new Map<string, Issue[]>();

  for (const issue of issues) {
    const filePath = issue.filePath || "unknown";
    const existing = grouped.get(filePath) || [];
    existing.push(issue);
    grouped.set(filePath, existing);
  }

  // Sort issues within each file by line number
  for (const [filePath, fileIssues] of grouped) {
    grouped.set(
      filePath,
      fileIssues.sort((a, b) => a.line - b.line)
    );
  }

  return grouped;
}

/**
 * Generate the fix prompt text (copied from FixPromptPanel for testing)
 */
function generateFixPrompt(
  issuesByFile: Map<string, Issue[]>,
  workspaceRoot: string | null,
  hookAvailable: boolean
): string {
  const totalIssues = Array.from(issuesByFile.values()).reduce(
    (sum, issues) => sum + issues.length,
    0
  );
  const fileCount = issuesByFile.size;

  if (totalIssues === 0) {
    return "No lint issues found on the current page.";
  }

  const lines: string[] = [];

  // Header
  lines.push(`# Fix Lint Issues`);
  lines.push(``);
  lines.push(
    `There are **${totalIssues} lint issue${totalIssues === 1 ? "" : "s"}** across **${fileCount} file${fileCount === 1 ? "" : "s"}** that need to be fixed.`
  );
  lines.push(``);

  // Instructions
  lines.push(`## Instructions`);
  lines.push(``);
  lines.push(`1. Fix ALL of the lint issues in the files listed below`);
  lines.push(`2. Do NOT ignore or suppress any issues with eslint-disable comments`);
  lines.push(`3. Do NOT skip any issues - each one must be properly addressed`);
  lines.push(`4. Run the linter after fixing to verify all issues are resolved`);
  lines.push(
    `5. If an issue cannot be fixed without breaking functionality, explain why and propose an alternative solution`
  );
  lines.push(``);

  if (hookAvailable) {
    // CONDENSED FORMAT: Only list affected files (hook will provide details on edit)
    lines.push(`## Affected Files`);
    lines.push(``);
    lines.push(
      `The following files have lint issues. When you edit each file, you will receive the specific lint errors automatically.`
    );
    lines.push(``);

    for (const [filePath, issues] of issuesByFile) {
      const displayPath =
        workspaceRoot && filePath.startsWith(workspaceRoot)
          ? filePath.slice(workspaceRoot.length + 1)
          : filePath;
      lines.push(
        `- \`${displayPath}\` (${issues.length} issue${issues.length === 1 ? "" : "s"})`
      );
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(``);
    lines.push(
      `Open each file above and fix all reported lint issues. The linter will provide specific error details when you edit each file.`
    );
  } else {
    // DETAILED FORMAT: List all issues with locations and messages
    lines.push(`## Affected Files`);
    lines.push(``);

    for (const [filePath, issues] of issuesByFile) {
      const displayPath =
        workspaceRoot && filePath.startsWith(workspaceRoot)
          ? filePath.slice(workspaceRoot.length + 1)
          : filePath;

      lines.push(`### ${displayPath}`);
      lines.push(``);

      for (const issue of issues) {
        const location = issue.column
          ? `Line ${issue.line}, Column ${issue.column}`
          : `Line ${issue.line}`;

        const severity = issue.severity === "error" ? "ERROR" : "WARNING";
        const ruleId = issue.ruleId ? ` (${issue.ruleId})` : "";

        lines.push(`- **[${severity}]** ${location}${ruleId}`);
        lines.push(`  ${issue.message}`);
      }

      lines.push(``);
    }

    // Summary
    lines.push(`---`);
    lines.push(``);
    lines.push(
      `Please fix all ${totalIssues} issues listed above. Do not use eslint-disable comments or any other method to suppress warnings. Each issue must be properly resolved.`
    );
  }

  return lines.join("\n");
}

/**
 * Helper to create test issues
 */
function createTestIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "eslint:test-rule:test.tsx:10:5:10",
    message: "Test issue message",
    severity: "warning",
    dataLoc: "test.tsx:10:5",
    ruleId: "test-rule",
    pluginId: "eslint",
    filePath: "/project/src/test.tsx",
    line: 10,
    column: 5,
    ...overrides,
  };
}

describe("generateFixPrompt", () => {
  describe("with no issues", () => {
    it("returns empty message when no issues", () => {
      const issuesByFile = new Map<string, Issue[]>();
      const result = generateFixPrompt(issuesByFile, null, false);
      expect(result).toBe("No lint issues found on the current page.");
    });
  });

  describe("condensed format (hookAvailable = true)", () => {
    it("lists only file names with issue counts", () => {
      const issues = [
        createTestIssue({
          filePath: "/project/src/Button.tsx",
          dataLoc: "src/Button.tsx:10:5",
        }),
        createTestIssue({
          filePath: "/project/src/Button.tsx",
          dataLoc: "src/Button.tsx:20:3",
        }),
        createTestIssue({
          filePath: "/project/src/Input.tsx",
          dataLoc: "src/Input.tsx:15:2",
        }),
      ];
      const issuesByFile = groupIssuesByFile(issues);

      const result = generateFixPrompt(issuesByFile, "/project", true);

      // Should have condensed format indicators
      expect(result).toContain("you will receive the specific lint errors automatically");
      expect(result).toContain("`src/Button.tsx` (2 issues)");
      expect(result).toContain("`src/Input.tsx` (1 issue)");

      // Should NOT have detailed issue info
      expect(result).not.toContain("Line 10");
      expect(result).not.toContain("Line 20");
      expect(result).not.toContain("[ERROR]");
      expect(result).not.toContain("[WARNING]");
    });

    it("uses relative paths when workspace root is provided", () => {
      const issues = [
        createTestIssue({ filePath: "/home/user/project/src/Component.tsx" }),
      ];
      const issuesByFile = groupIssuesByFile(issues);

      const result = generateFixPrompt(issuesByFile, "/home/user/project", true);

      expect(result).toContain("`src/Component.tsx`");
      expect(result).not.toContain("/home/user/project");
    });

    it("handles singular issue count", () => {
      const issues = [createTestIssue({ filePath: "/project/src/Single.tsx" })];
      const issuesByFile = groupIssuesByFile(issues);

      const result = generateFixPrompt(issuesByFile, "/project", true);

      expect(result).toContain("**1 lint issue**");
      expect(result).toContain("**1 file**");
      expect(result).toContain("(1 issue)");
    });
  });

  describe("detailed format (hookAvailable = false)", () => {
    it("lists all issues with line numbers and messages", () => {
      const issues = [
        createTestIssue({
          filePath: "/project/src/Button.tsx",
          line: 10,
          column: 5,
          message: "Unused variable 'x'",
          ruleId: "no-unused-vars",
          severity: "error",
        }),
        createTestIssue({
          filePath: "/project/src/Button.tsx",
          line: 25,
          column: 3,
          message: "Unexpected console statement",
          ruleId: "no-console",
          severity: "warning",
        }),
      ];
      const issuesByFile = groupIssuesByFile(issues);

      const result = generateFixPrompt(issuesByFile, "/project", false);

      // Should have detailed issue info
      expect(result).toContain("### src/Button.tsx");
      expect(result).toContain("Line 10, Column 5");
      expect(result).toContain("Line 25, Column 3");
      expect(result).toContain("[ERROR]");
      expect(result).toContain("[WARNING]");
      expect(result).toContain("(no-unused-vars)");
      expect(result).toContain("(no-console)");
      expect(result).toContain("Unused variable 'x'");
      expect(result).toContain("Unexpected console statement");

      // Should NOT have condensed format message
      expect(result).not.toContain("you will receive the specific lint errors automatically");
    });

    it("handles issues without column number", () => {
      const issues = [
        createTestIssue({
          filePath: "/project/src/NoColumn.tsx",
          line: 42,
          column: undefined,
        }),
      ];
      const issuesByFile = groupIssuesByFile(issues);

      const result = generateFixPrompt(issuesByFile, "/project", false);

      // Should show line number without column
      expect(result).toContain("Line 42 (test-rule)");
      // Should NOT have "Line X, Column Y" format
      expect(result).not.toContain("Line 42, Column");
    });

    it("includes summary with total issue count", () => {
      const issues = [
        createTestIssue({ filePath: "/project/src/A.tsx" }),
        createTestIssue({ filePath: "/project/src/B.tsx" }),
        createTestIssue({ filePath: "/project/src/C.tsx" }),
      ];
      const issuesByFile = groupIssuesByFile(issues);

      const result = generateFixPrompt(issuesByFile, "/project", false);

      expect(result).toContain("Please fix all 3 issues listed above");
    });
  });

  describe("common elements", () => {
    it("always includes header with issue and file counts", () => {
      const issues = [
        createTestIssue({ filePath: "/project/src/A.tsx" }),
        createTestIssue({ filePath: "/project/src/A.tsx" }),
        createTestIssue({ filePath: "/project/src/B.tsx" }),
      ];
      const issuesByFile = groupIssuesByFile(issues);

      // Both formats should have the header
      const condensed = generateFixPrompt(issuesByFile, "/project", true);
      const detailed = generateFixPrompt(issuesByFile, "/project", false);

      expect(condensed).toContain("**3 lint issues** across **2 files**");
      expect(detailed).toContain("**3 lint issues** across **2 files**");
    });

    it("always includes instructions about not using eslint-disable", () => {
      const issues = [createTestIssue()];
      const issuesByFile = groupIssuesByFile(issues);

      const condensed = generateFixPrompt(issuesByFile, null, true);
      const detailed = generateFixPrompt(issuesByFile, null, false);

      const instruction = "Do NOT ignore or suppress any issues with eslint-disable";
      expect(condensed).toContain(instruction);
      expect(detailed).toContain(instruction);
    });
  });
});

describe("groupIssuesByFile", () => {
  it("groups issues by their file path", () => {
    const issues = [
      createTestIssue({ filePath: "/src/A.tsx", line: 10 }),
      createTestIssue({ filePath: "/src/B.tsx", line: 5 }),
      createTestIssue({ filePath: "/src/A.tsx", line: 20 }),
    ];

    const grouped = groupIssuesByFile(issues);

    expect(grouped.size).toBe(2);
    expect(grouped.get("/src/A.tsx")).toHaveLength(2);
    expect(grouped.get("/src/B.tsx")).toHaveLength(1);
  });

  it("sorts issues within each file by line number", () => {
    const issues = [
      createTestIssue({ filePath: "/src/A.tsx", line: 30 }),
      createTestIssue({ filePath: "/src/A.tsx", line: 10 }),
      createTestIssue({ filePath: "/src/A.tsx", line: 20 }),
    ];

    const grouped = groupIssuesByFile(issues);
    const fileIssues = grouped.get("/src/A.tsx")!;

    expect(fileIssues[0].line).toBe(10);
    expect(fileIssues[1].line).toBe(20);
    expect(fileIssues[2].line).toBe(30);
  });

  it("handles issues with undefined filePath", () => {
    const issues = [
      createTestIssue({ filePath: undefined as unknown as string }),
    ];

    const grouped = groupIssuesByFile(issues);

    expect(grouped.has("unknown")).toBe(true);
  });
});
