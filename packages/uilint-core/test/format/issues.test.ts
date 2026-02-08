import { describe, it, expect } from "vitest";
import { formatViolationsText, sanitizeIssues } from "../../src/format/issues.js";
import type { UILintIssue } from "../../src/types.js";

function makeIssue(overrides: Partial<UILintIssue> = {}): UILintIssue {
  return {
    id: "issue-1",
    type: "color",
    message: "Color mismatch",
    ...overrides,
  };
}

describe("sanitizeIssues", () => {
  it("trims string fields and drops suggestion", () => {
    const issues: UILintIssue[] = [
      {
        id: "  id-1  ",
        type: "spacing",
        message: "  extra padding  ",
        element: "  button  ",
        selector: "  .btn  ",
        currentValue: "  12px  ",
        expectedValue: "  8px  ",
        suggestion: "Use 8px padding",
      },
    ];

    const result = sanitizeIssues(issues);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("id-1");
    expect(result[0].message).toBe("extra padding");
    expect(result[0].element).toBe("button");
    expect(result[0].selector).toBe(".btn");
    expect(result[0].currentValue).toBe("12px");
    expect(result[0].expectedValue).toBe("8px");
    expect(result[0]).not.toHaveProperty("suggestion");
  });

  it("handles missing optional fields", () => {
    const issues: UILintIssue[] = [
      {
        id: "id-2",
        type: "typography",
        message: "Font size wrong",
      },
    ];

    const result = sanitizeIssues(issues);

    expect(result[0].element).toBeUndefined();
    expect(result[0].selector).toBeUndefined();
    expect(result[0].currentValue).toBeUndefined();
    expect(result[0].expectedValue).toBeUndefined();
  });

  it("handles empty array", () => {
    expect(sanitizeIssues([])).toEqual([]);
  });

  it("coerces id and message to string", () => {
    const issues = [
      {
        id: undefined as unknown as string,
        type: "color" as const,
        message: undefined as unknown as string,
      },
    ];

    const result = sanitizeIssues(issues);
    expect(result[0].id).toBe("");
    expect(result[0].message).toBe("");
  });
});

describe("formatViolationsText", () => {
  it("returns 'No violations found.' for empty array", () => {
    expect(formatViolationsText([])).toBe("No violations found.");
  });

  it("returns 'No violations found.' for null-ish input", () => {
    expect(formatViolationsText(null as unknown as UILintIssue[])).toBe(
      "No violations found."
    );
  });

  it("formats a single issue with type and message", () => {
    const result = formatViolationsText([makeIssue()]);

    expect(result).toContain("1. [color] Color mismatch");
  });

  it("includes current → expected when both are present", () => {
    const result = formatViolationsText([
      makeIssue({ currentValue: "#FF0000", expectedValue: "#3B82F6" }),
    ]);

    expect(result).toContain("#FF0000 → #3B82F6");
  });

  it("shows only currentValue when expectedValue is missing", () => {
    const result = formatViolationsText([
      makeIssue({ currentValue: "16px" }),
    ]);

    expect(result).toContain("   16px");
    expect(result).not.toContain("→");
  });

  it("numbers multiple issues sequentially", () => {
    const result = formatViolationsText([
      makeIssue({ id: "1", message: "First" }),
      makeIssue({ id: "2", message: "Second" }),
      makeIssue({ id: "3", message: "Third" }),
    ]);

    expect(result).toContain("1. [color] First");
    expect(result).toContain("2. [color] Second");
    expect(result).toContain("3. [color] Third");
  });

  it("includes context header when provided", () => {
    const result = formatViolationsText([makeIssue()], {
      context: "src/App.tsx",
    });

    expect(result).toMatch(/^Violations in src\/App\.tsx:/);
  });

  it("skips context header when context is empty or whitespace", () => {
    const result = formatViolationsText([makeIssue()], { context: "   " });

    expect(result).not.toContain("Violations in");
  });

  it("includes default footer by default", () => {
    const result = formatViolationsText([makeIssue()]);

    expect(result).toContain("Consult the style guide for guidance.");
  });

  it("uses custom footer message when provided", () => {
    const result = formatViolationsText([makeIssue()], {
      footerMessage: "Check docs.",
    });

    expect(result).toContain("Check docs.");
    expect(result).not.toContain("Consult the style guide");
  });

  it("omits footer when includeFooter is false", () => {
    const result = formatViolationsText([makeIssue()], {
      includeFooter: false,
    });

    expect(result).not.toContain("Consult the style guide");
  });

  it("does not end with trailing blank lines", () => {
    const result = formatViolationsText([makeIssue()], {
      includeFooter: false,
    });

    expect(result).not.toMatch(/\n$/);
  });
});
