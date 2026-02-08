import { describe, it, expect } from "vitest";
import {
  createEmptyStyleGuide,
  validateStyleGuide,
  mergeStyleGuides,
  createColorRule,
  createTypographyRule,
  createSpacingRule,
  createComponentRule,
} from "../../src/styleguide/schema.js";
import type { StyleGuide } from "../../src/types.js";

describe("createEmptyStyleGuide", () => {
  it("returns a guide with all empty arrays", () => {
    const guide = createEmptyStyleGuide();

    expect(guide.colors).toEqual([]);
    expect(guide.typography).toEqual([]);
    expect(guide.spacing).toEqual([]);
    expect(guide.components).toEqual([]);
  });
});

describe("validateStyleGuide", () => {
  it("returns true for a valid style guide", () => {
    const guide = createEmptyStyleGuide();
    expect(validateStyleGuide(guide)).toBe(true);
  });

  it("returns false for null", () => {
    expect(validateStyleGuide(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(validateStyleGuide(undefined)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(validateStyleGuide("string")).toBe(false);
    expect(validateStyleGuide(42)).toBe(false);
  });

  it("returns false when any required array is missing", () => {
    expect(validateStyleGuide({ colors: [], typography: [], spacing: [] })).toBe(
      false
    );
    expect(
      validateStyleGuide({ colors: [], typography: [], components: [] })
    ).toBe(false);
  });

  it("returns false when a field is not an array", () => {
    expect(
      validateStyleGuide({
        colors: "not-array",
        typography: [],
        spacing: [],
        components: [],
      })
    ).toBe(false);
  });
});

describe("rule creators", () => {
  describe("createColorRule", () => {
    it("uppercases the value", () => {
      const rule = createColorRule("Primary", "#3b82f6", "buttons");
      expect(rule.value).toBe("#3B82F6");
    });

    it("sets name and usage", () => {
      const rule = createColorRule("Accent", "#f00", "highlights");
      expect(rule.name).toBe("Accent");
      expect(rule.usage).toBe("highlights");
    });

    it("defaults usage to empty string", () => {
      const rule = createColorRule("Neutral", "#999");
      expect(rule.usage).toBe("");
    });
  });

  describe("createTypographyRule", () => {
    it("creates rule with element and optional props", () => {
      const rule = createTypographyRule("h1", {
        fontSize: "2rem",
        fontWeight: "700",
      });
      expect(rule.element).toBe("h1");
      expect(rule.fontSize).toBe("2rem");
      expect(rule.fontWeight).toBe("700");
    });

    it("creates minimal rule with element only", () => {
      const rule = createTypographyRule("p");
      expect(rule.element).toBe("p");
      expect(rule.fontSize).toBeUndefined();
    });
  });

  describe("createSpacingRule", () => {
    it("creates spacing rule with name and value", () => {
      const rule = createSpacingRule("gap-sm", "8px");
      expect(rule.name).toBe("gap-sm");
      expect(rule.value).toBe("8px");
    });
  });

  describe("createComponentRule", () => {
    it("creates component rule with name and styles array", () => {
      const rule = createComponentRule("Button", ["bg-blue-500", "rounded"]);
      expect(rule.name).toBe("Button");
      expect(rule.styles).toEqual(["bg-blue-500", "rounded"]);
    });
  });
});

describe("mergeStyleGuides", () => {
  const empty = createEmptyStyleGuide();

  it("merges two empty guides into empty", () => {
    const result = mergeStyleGuides(empty, {});
    expect(result).toEqual(empty);
  });

  it("adds new colors from detected into existing", () => {
    const existing: StyleGuide = {
      ...empty,
      colors: [{ name: "Primary", value: "#3B82F6", usage: "" }],
    };
    const detected: Partial<StyleGuide> = {
      colors: [{ name: "Secondary", value: "#10B981", usage: "" }],
    };

    const result = mergeStyleGuides(existing, detected);

    expect(result.colors).toHaveLength(2);
    expect(result.colors[1].name).toBe("Secondary");
  });

  it("deduplicates colors by name", () => {
    const existing: StyleGuide = {
      ...empty,
      colors: [{ name: "Primary", value: "#3B82F6", usage: "" }],
    };
    const detected: Partial<StyleGuide> = {
      colors: [{ name: "Primary", value: "#2563EB", usage: "updated" }],
    };

    const result = mergeStyleGuides(existing, detected);

    // Should not add duplicate - keeps existing
    expect(result.colors).toHaveLength(1);
    expect(result.colors[0].value).toBe("#3B82F6");
  });

  it("deduplicates colors by value", () => {
    const existing: StyleGuide = {
      ...empty,
      colors: [{ name: "Blue", value: "#3B82F6", usage: "" }],
    };
    const detected: Partial<StyleGuide> = {
      colors: [{ name: "Primary", value: "#3B82F6", usage: "" }],
    };

    const result = mergeStyleGuides(existing, detected);
    expect(result.colors).toHaveLength(1);
  });

  it("deduplicates typography by element", () => {
    const existing: StyleGuide = {
      ...empty,
      typography: [{ element: "h1", fontSize: "2rem" }],
    };
    const detected: Partial<StyleGuide> = {
      typography: [{ element: "h1", fontSize: "3rem" }],
    };

    const result = mergeStyleGuides(existing, detected);
    expect(result.typography).toHaveLength(1);
    expect(result.typography[0].fontSize).toBe("2rem"); // keeps existing
  });

  it("adds new typography elements", () => {
    const existing: StyleGuide = {
      ...empty,
      typography: [{ element: "h1", fontSize: "2rem" }],
    };
    const detected: Partial<StyleGuide> = {
      typography: [{ element: "h2", fontSize: "1.5rem" }],
    };

    const result = mergeStyleGuides(existing, detected);
    expect(result.typography).toHaveLength(2);
  });

  it("deduplicates spacing by name or value", () => {
    const existing: StyleGuide = {
      ...empty,
      spacing: [{ name: "sm", value: "8px" }],
    };
    const detected: Partial<StyleGuide> = {
      spacing: [
        { name: "sm", value: "4px" }, // same name
        { name: "tiny", value: "8px" }, // same value
        { name: "md", value: "16px" }, // new
      ],
    };

    const result = mergeStyleGuides(existing, detected);
    expect(result.spacing).toHaveLength(2); // existing sm + new md
  });

  it("deduplicates components by name", () => {
    const existing: StyleGuide = {
      ...empty,
      components: [{ name: "Button", styles: ["bg-blue-500"] }],
    };
    const detected: Partial<StyleGuide> = {
      components: [
        { name: "Button", styles: ["bg-red-500"] }, // duplicate
        { name: "Card", styles: ["shadow-md"] }, // new
      ],
    };

    const result = mergeStyleGuides(existing, detected);
    expect(result.components).toHaveLength(2);
    expect(result.components[0].styles).toEqual(["bg-blue-500"]); // keeps existing
    expect(result.components[1].name).toBe("Card");
  });

  it("does not mutate the original guides", () => {
    const existing: StyleGuide = {
      colors: [{ name: "A", value: "#000", usage: "" }],
      typography: [],
      spacing: [],
      components: [],
    };
    const detected: Partial<StyleGuide> = {
      colors: [{ name: "B", value: "#FFF", usage: "" }],
    };

    const colorsRef = existing.colors;
    mergeStyleGuides(existing, detected);

    expect(existing.colors).toHaveLength(1); // not mutated
    expect(existing.colors).toBe(colorsRef);
  });
});
