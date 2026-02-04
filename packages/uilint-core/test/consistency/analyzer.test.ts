import { describe, it, expect } from "vitest";
import {
  parseGroupedSnapshot,
  parseViolationsResponse,
  validateViolations,
  formatConsistencyViolations,
} from "../../src/consistency/analyzer.js";
import type { Violation } from "../../src/consistency/types.js";

describe("parseGroupedSnapshot", () => {
  it("returns null for invalid JSON", () => {
    expect(parseGroupedSnapshot("not json")).toBeNull();
    expect(parseGroupedSnapshot("{invalid")).toBeNull();
    expect(parseGroupedSnapshot("")).toBeNull();
  });

  it("returns null for non-object values", () => {
    expect(parseGroupedSnapshot("null")).toBeNull();
    expect(parseGroupedSnapshot('"string"')).toBeNull();
    expect(parseGroupedSnapshot("123")).toBeNull();
    // Note: arrays are objects in JS, so [] parses as an empty grouped snapshot
  });

  it("handles arrays by treating them as empty objects", () => {
    const result = parseGroupedSnapshot("[]");
    // Arrays are objects, so they're accepted but all groups default to empty
    expect(result).not.toBeNull();
    expect(result!.buttons).toEqual([]);
    expect(result!.headings).toEqual([]);
  });

  it("parses valid grouped snapshot with all element types", () => {
    const input = JSON.stringify({
      buttons: [{ id: "el-1", tag: "button" }],
      headings: [{ id: "el-2", tag: "h1" }],
      cards: [{ id: "el-3", tag: "div" }],
      links: [{ id: "el-4", tag: "a" }],
      inputs: [{ id: "el-5", tag: "input" }],
      containers: [{ id: "el-6", tag: "section" }],
    });

    const result = parseGroupedSnapshot(input);

    expect(result).not.toBeNull();
    expect(result!.buttons).toHaveLength(1);
    expect(result!.headings).toHaveLength(1);
    expect(result!.cards).toHaveLength(1);
    expect(result!.links).toHaveLength(1);
    expect(result!.inputs).toHaveLength(1);
    expect(result!.containers).toHaveLength(1);
  });

  it("handles missing arrays by defaulting to empty arrays", () => {
    const input = JSON.stringify({
      buttons: [{ id: "el-1" }],
      // missing: headings, cards, links, inputs, containers
    });

    const result = parseGroupedSnapshot(input);

    expect(result).not.toBeNull();
    expect(result!.buttons).toHaveLength(1);
    expect(result!.headings).toEqual([]);
    expect(result!.cards).toEqual([]);
    expect(result!.links).toEqual([]);
    expect(result!.inputs).toEqual([]);
    expect(result!.containers).toEqual([]);
  });

  it("handles non-array values by defaulting to empty arrays", () => {
    const input = JSON.stringify({
      buttons: "not-an-array",
      headings: { not: "array" },
      cards: 123,
      links: null,
    });

    const result = parseGroupedSnapshot(input);

    expect(result).not.toBeNull();
    expect(result!.buttons).toEqual([]);
    expect(result!.headings).toEqual([]);
    expect(result!.cards).toEqual([]);
    expect(result!.links).toEqual([]);
  });

  it("parses empty object as empty grouped snapshot", () => {
    const result = parseGroupedSnapshot("{}");

    expect(result).not.toBeNull();
    expect(result!.buttons).toEqual([]);
    expect(result!.headings).toEqual([]);
    expect(result!.cards).toEqual([]);
    expect(result!.links).toEqual([]);
    expect(result!.inputs).toEqual([]);
    expect(result!.containers).toEqual([]);
  });
});

describe("validateViolations", () => {
  it("returns empty array for invalid input", () => {
    expect(validateViolations([])).toEqual([]);
    expect(validateViolations([null])).toEqual([]);
    expect(validateViolations([undefined])).toEqual([]);
    expect(validateViolations(["string"])).toEqual([]);
    expect(validateViolations([123])).toEqual([]);
  });

  it("filters out violations with missing required fields", () => {
    const violations = [
      { category: "spacing", severity: "error", message: "test" }, // missing elementIds, details
      {
        elementIds: ["el-1"],
        severity: "error",
        message: "test",
        details: {},
      }, // missing category
      {
        elementIds: ["el-1"],
        category: "spacing",
        message: "test",
        details: {},
      }, // missing severity
      {
        elementIds: ["el-1"],
        category: "spacing",
        severity: "error",
        details: {},
      }, // missing message
      {
        elementIds: ["el-1"],
        category: "spacing",
        severity: "error",
        message: "test",
      }, // missing details
    ];

    expect(validateViolations(violations)).toEqual([]);
  });

  it("filters out violations with invalid category", () => {
    const violations = [
      {
        elementIds: ["el-1"],
        category: "invalid-category",
        severity: "error",
        message: "test",
        details: { property: "padding" },
      },
    ];

    expect(validateViolations(violations)).toEqual([]);
  });

  it("filters out violations with invalid severity", () => {
    const violations = [
      {
        elementIds: ["el-1"],
        category: "spacing",
        severity: "critical", // invalid
        message: "test",
        details: { property: "padding" },
      },
    ];

    expect(validateViolations(violations)).toEqual([]);
  });

  it("validates and normalizes valid violations", () => {
    const violations = [
      {
        elementIds: ["el-1", "el-2"],
        category: "spacing",
        severity: "error",
        message: "Inconsistent padding",
        details: {
          property: "padding",
          values: ["8px", "16px"],
          suggestion: "Use consistent padding",
        },
      },
    ];

    const result = validateViolations(violations);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      elementIds: ["el-1", "el-2"],
      category: "spacing",
      severity: "error",
      message: "Inconsistent padding",
      details: {
        property: "padding",
        values: ["8px", "16px"],
        suggestion: "Use consistent padding",
      },
    });
  });

  it("accepts all valid categories", () => {
    const validCategories = [
      "spacing",
      "color",
      "typography",
      "sizing",
      "borders",
      "shadows",
    ];

    validCategories.forEach((category) => {
      const violations = [
        {
          elementIds: ["el-1"],
          category,
          severity: "error",
          message: "test",
          details: { property: "test" },
        },
      ];

      const result = validateViolations(violations);
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe(category);
    });
  });

  it("accepts all valid severities", () => {
    const validSeverities = ["error", "warning", "info"];

    validSeverities.forEach((severity) => {
      const violations = [
        {
          elementIds: ["el-1"],
          category: "spacing",
          severity,
          message: "test",
          details: { property: "test" },
        },
      ];

      const result = validateViolations(violations);
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe(severity);
    });
  });

  it("handles missing optional fields in details", () => {
    const violations = [
      {
        elementIds: ["el-1"],
        category: "color",
        severity: "warning",
        message: "Inconsistent color",
        details: {
          property: "color",
          // values and suggestion are optional
        },
      },
    ];

    const result = validateViolations(violations);

    expect(result).toHaveLength(1);
    expect(result[0].details.values).toEqual([]);
    expect(result[0].details.suggestion).toBeUndefined();
  });

  it("handles invalid property type in details", () => {
    const violations = [
      {
        elementIds: ["el-1"],
        category: "color",
        severity: "warning",
        message: "test",
        details: {
          property: 123, // should be string
          values: "not-array", // should be array
          suggestion: { not: "string" }, // should be string
        },
      },
    ];

    const result = validateViolations(violations);

    expect(result).toHaveLength(1);
    expect(result[0].details.property).toBe("");
    expect(result[0].details.values).toEqual([]);
    expect(result[0].details.suggestion).toBeUndefined();
  });

  it("filters mixed valid and invalid violations", () => {
    const violations = [
      {
        elementIds: ["el-1"],
        category: "invalid",
        severity: "error",
        message: "invalid",
        details: { property: "test" },
      },
      {
        elementIds: ["el-2"],
        category: "spacing",
        severity: "error",
        message: "valid",
        details: { property: "padding", values: ["8px"] },
      },
      {
        elementIds: ["el-3"],
        category: "color",
        severity: "invalid",
        message: "invalid",
        details: { property: "test" },
      },
    ];

    const result = validateViolations(violations);

    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("valid");
  });
});

describe("parseViolationsResponse", () => {
  it("parses valid JSON response with violations array", () => {
    const response = JSON.stringify({
      violations: [
        {
          elementIds: ["el-1", "el-2"],
          category: "spacing",
          severity: "error",
          message: "Inconsistent padding",
          details: {
            property: "padding",
            values: ["8px", "16px"],
          },
        },
      ],
    });

    const result = parseViolationsResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0].elementIds).toEqual(["el-1", "el-2"]);
    expect(result[0].category).toBe("spacing");
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseViolationsResponse("not json")).toEqual([]);
    expect(parseViolationsResponse("{invalid")).toEqual([]);
  });

  it("returns empty array when violations is not an array", () => {
    const response = JSON.stringify({ violations: "not-array" });
    expect(parseViolationsResponse(response)).toEqual([]);
  });

  it("returns empty array when violations key is missing", () => {
    const response = JSON.stringify({ other: "data" });
    expect(parseViolationsResponse(response)).toEqual([]);
  });

  it("extracts JSON from response with surrounding text", () => {
    const response = `
Here's my analysis:

{"violations": [{"elementIds": ["el-1"], "category": "color", "severity": "warning", "message": "Color mismatch", "details": {"property": "color", "values": ["#fff", "#000"]}}]}

That's all I found.
`;

    const result = parseViolationsResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("color");
  });

  it("handles empty violations array", () => {
    const response = JSON.stringify({ violations: [] });
    expect(parseViolationsResponse(response)).toEqual([]);
  });

  it("filters invalid violations during parsing", () => {
    const response = JSON.stringify({
      violations: [
        {
          elementIds: ["el-1"],
          category: "invalid-category",
          severity: "error",
          message: "invalid",
          details: { property: "test" },
        },
        {
          elementIds: ["el-2"],
          category: "typography",
          severity: "info",
          message: "valid",
          details: { property: "fontSize", values: ["12px", "14px"] },
        },
      ],
    });

    const result = parseViolationsResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("valid");
  });

  it("handles malformed JSON in extracted block", () => {
    const response = `
{"violations": [{ malformed }]}
`;
    expect(parseViolationsResponse(response)).toEqual([]);
  });
});

describe("formatConsistencyViolations", () => {
  it("returns success message for empty violations", () => {
    const result = formatConsistencyViolations([]);
    expect(result).toContain("No consistency issues found");
  });

  it("formats single violation", () => {
    const violations: Violation[] = [
      {
        elementIds: ["el-1", "el-2"],
        category: "spacing",
        severity: "error",
        message: "Inconsistent padding between buttons",
        details: {
          property: "padding",
          values: ["8px", "16px"],
          suggestion: "Use consistent padding of 8px",
        },
      },
    ];

    const result = formatConsistencyViolations(violations);

    expect(result).toContain("1 consistency issue");
    expect(result).toContain("[spacing]");
    expect(result).toContain("Inconsistent padding between buttons");
    expect(result).toContain("el-1, el-2");
    expect(result).toContain("Property: padding");
    expect(result).toContain("8px vs 16px");
    expect(result).toContain("Use consistent padding of 8px");
  });

  it("formats multiple violations", () => {
    const violations: Violation[] = [
      {
        elementIds: ["el-1"],
        category: "color",
        severity: "warning",
        message: "Color issue",
        details: { property: "color", values: [] },
      },
      {
        elementIds: ["el-2"],
        category: "typography",
        severity: "info",
        message: "Font issue",
        details: { property: "fontSize", values: [] },
      },
    ];

    const result = formatConsistencyViolations(violations);

    expect(result).toContain("2 consistency issue");
    expect(result).toContain("1.");
    expect(result).toContain("2.");
  });

  it("shows correct severity icons", () => {
    const violations: Violation[] = [
      {
        elementIds: ["el-1"],
        category: "spacing",
        severity: "error",
        message: "Error message",
        details: { property: "p", values: [] },
      },
      {
        elementIds: ["el-2"],
        category: "color",
        severity: "warning",
        message: "Warning message",
        details: { property: "c", values: [] },
      },
      {
        elementIds: ["el-3"],
        category: "typography",
        severity: "info",
        message: "Info message",
        details: { property: "f", values: [] },
      },
    ];

    const result = formatConsistencyViolations(violations);

    // Error, warning, and info each have distinct icons
    expect(result).toMatch(/[0-9]+\.\s*\S+\s*\[spacing\]/);
    expect(result).toMatch(/[0-9]+\.\s*\S+\s*\[color\]/);
    expect(result).toMatch(/[0-9]+\.\s*\S+\s*\[typography\]/);
  });

  it("omits empty property field", () => {
    const violations: Violation[] = [
      {
        elementIds: ["el-1"],
        category: "spacing",
        severity: "error",
        message: "Test",
        details: { property: "", values: [] },
      },
    ];

    const result = formatConsistencyViolations(violations);

    expect(result).not.toContain("Property:");
  });

  it("omits empty values array", () => {
    const violations: Violation[] = [
      {
        elementIds: ["el-1"],
        category: "spacing",
        severity: "error",
        message: "Test",
        details: { property: "padding", values: [] },
      },
    ];

    const result = formatConsistencyViolations(violations);

    expect(result).not.toContain("Values:");
  });

  it("omits missing suggestion", () => {
    const violations: Violation[] = [
      {
        elementIds: ["el-1"],
        category: "spacing",
        severity: "error",
        message: "Test",
        details: { property: "padding", values: ["8px"] },
      },
    ];

    const result = formatConsistencyViolations(violations);

    expect(result).not.toContain("Suggestion:");
  });

  it("formats values with 'vs' separator", () => {
    const violations: Violation[] = [
      {
        elementIds: ["el-1"],
        category: "spacing",
        severity: "error",
        message: "Test",
        details: { property: "padding", values: ["8px", "12px", "16px"] },
      },
    ];

    const result = formatConsistencyViolations(violations);

    expect(result).toContain("8px vs 12px vs 16px");
  });
});
