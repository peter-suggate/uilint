import { describe, it, expect } from "vitest";
import {
  buildConsistencyPrompt,
  countElements,
  hasAnalyzableGroups,
} from "../../src/consistency/prompts.js";
import type {
  GroupedSnapshot,
  ElementSnapshot,
} from "../../src/consistency/types.js";

function makeElement(overrides: Partial<ElementSnapshot> = {}): ElementSnapshot {
  return {
    id: "el-1",
    tag: "button",
    role: "button",
    text: "Click me",
    context: "main",
    styles: {},
    rect: { width: 100, height: 40 },
    ...overrides,
  };
}

function makeEmptySnapshot(): GroupedSnapshot {
  return {
    buttons: [],
    headings: [],
    cards: [],
    links: [],
    inputs: [],
    containers: [],
  };
}

describe("countElements", () => {
  it("returns 0 for an empty snapshot", () => {
    expect(countElements(makeEmptySnapshot())).toBe(0);
  });

  it("sums elements across all groups", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.buttons = [makeElement(), makeElement({ id: "el-2" })];
    snapshot.headings = [makeElement({ id: "el-3" })];
    snapshot.links = [
      makeElement({ id: "el-4" }),
      makeElement({ id: "el-5" }),
      makeElement({ id: "el-6" }),
    ];

    expect(countElements(snapshot)).toBe(6);
  });
});

describe("hasAnalyzableGroups", () => {
  it("returns false when all groups have fewer than 2 elements", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.buttons = [makeElement()];
    expect(hasAnalyzableGroups(snapshot)).toBe(false);
  });

  it("returns false for empty snapshot", () => {
    expect(hasAnalyzableGroups(makeEmptySnapshot())).toBe(false);
  });

  it("returns true when any single group has 2+ elements", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.cards = [makeElement(), makeElement({ id: "el-2" })];
    expect(hasAnalyzableGroups(snapshot)).toBe(true);
  });

  it("returns true for each group type individually", () => {
    const groups: (keyof GroupedSnapshot)[] = [
      "buttons",
      "headings",
      "cards",
      "links",
      "inputs",
      "containers",
    ];

    for (const group of groups) {
      const snapshot = makeEmptySnapshot();
      snapshot[group] = [makeElement(), makeElement({ id: "el-2" })];
      expect(hasAnalyzableGroups(snapshot)).toBe(true);
    }
  });
});

describe("buildConsistencyPrompt", () => {
  it("returns fallback message when no groups have 2+ elements", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.buttons = [makeElement()]; // only 1

    const result = buildConsistencyPrompt(snapshot);

    expect(result).toBe(
      "No element groups with 2+ elements found for consistency analysis."
    );
  });

  it("includes group header with element count for analyzable groups", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.buttons = [
      makeElement({ id: "el-1" }),
      makeElement({ id: "el-2" }),
      makeElement({ id: "el-3" }),
    ];

    const result = buildConsistencyPrompt(snapshot);

    expect(result).toContain("## Buttons (3 elements)");
  });

  it("excludes groups with fewer than 2 elements", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.buttons = [makeElement(), makeElement({ id: "el-2" })];
    snapshot.headings = [makeElement({ id: "el-3" })]; // only 1

    const result = buildConsistencyPrompt(snapshot);

    expect(result).toContain("## Buttons");
    expect(result).not.toContain("## Headings");
  });

  it("includes element id, text, and context", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.links = [
      makeElement({ id: "el-10", text: "Home", context: "nav" }),
      makeElement({ id: "el-11", text: "About", context: "nav" }),
    ];

    const result = buildConsistencyPrompt(snapshot);

    expect(result).toContain("id: el-10");
    expect(result).toContain('text: "Home"');
    expect(result).toContain("context: nav");
  });

  it("includes component name when present", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.buttons = [
      makeElement({ id: "el-1", component: "PrimaryButton" }),
      makeElement({ id: "el-2", component: "SecondaryButton" }),
    ];

    const result = buildConsistencyPrompt(snapshot);

    expect(result).toContain("component: PrimaryButton");
  });

  it("defaults context to 'root' when not specified", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.inputs = [
      makeElement({ id: "el-1", context: "" }),
      makeElement({ id: "el-2", context: "" }),
    ];

    const result = buildConsistencyPrompt(snapshot);

    expect(result).toContain("context: root");
  });

  it("includes non-trivial style values and filters out defaults", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.buttons = [
      makeElement({
        id: "el-1",
        styles: {
          fontSize: "16px",
          padding: "12px 24px",
          color: "none", // should be filtered
          backgroundColor: "0px", // should be filtered
          border: "normal", // should be filtered
        },
      }),
      makeElement({ id: "el-2" }),
    ];

    const result = buildConsistencyPrompt(snapshot);

    expect(result).toContain("fontSize: 16px");
    expect(result).toContain("padding: 12px 24px");
    expect(result).not.toContain("color: none");
    expect(result).not.toContain("backgroundColor: 0px");
  });

  it("includes element size when width or height > 0", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.containers = [
      makeElement({ id: "el-1", rect: { width: 320, height: 200 } }),
      makeElement({ id: "el-2", rect: { width: 0, height: 0 } }),
    ];

    const result = buildConsistencyPrompt(snapshot);

    expect(result).toContain("size: 320x200");
  });

  it("omits size when both width and height are 0", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.headings = [
      makeElement({ id: "el-1", rect: { width: 0, height: 0 } }),
      makeElement({ id: "el-2", rect: { width: 0, height: 0 } }),
    ];

    const result = buildConsistencyPrompt(snapshot);

    expect(result).not.toContain("size:");
  });

  it("includes instructions and response format", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.buttons = [makeElement(), makeElement({ id: "el-2" })];

    const result = buildConsistencyPrompt(snapshot);

    expect(result).toContain("UI consistency analyzer");
    expect(result).toContain("# Response Format");
    expect(result).toContain('"violations"');
  });

  it("includes all analyzable groups in a single prompt", () => {
    const snapshot = makeEmptySnapshot();
    snapshot.buttons = [makeElement(), makeElement({ id: "el-2" })];
    snapshot.cards = [
      makeElement({ id: "el-3" }),
      makeElement({ id: "el-4" }),
    ];

    const result = buildConsistencyPrompt(snapshot);

    expect(result).toContain("## Buttons");
    expect(result).toContain("## Cards");
  });
});
