import { describe, it, expect } from "vitest";
import {
  serializeStyles,
  deserializeStyles,
  createStyleSummary,
  truncateHTML,
} from "../../src/scanner/style-extractor.js";
import type { ExtractedStyles, SerializedStyles } from "../../src/types.js";

function makeStyles(overrides: Partial<ExtractedStyles> = {}): ExtractedStyles {
  return {
    colors: new Map(),
    fontSizes: new Map(),
    fontFamilies: new Map(),
    fontWeights: new Map(),
    spacing: new Map(),
    borderRadius: new Map(),
    ...overrides,
  };
}

describe("serializeStyles", () => {
  it("converts Maps to plain objects", () => {
    const styles = makeStyles({
      colors: new Map([["#FF0000", 3], ["#00FF00", 1]]),
      fontSizes: new Map([["16px", 5]]),
    });

    const serialized = serializeStyles(styles);

    expect(serialized.colors).toEqual({ "#FF0000": 3, "#00FF00": 1 });
    expect(serialized.fontSizes).toEqual({ "16px": 5 });
    expect(serialized.fontFamilies).toEqual({});
  });
});

describe("deserializeStyles", () => {
  it("converts plain objects back to Maps", () => {
    const serialized: SerializedStyles = {
      colors: { "#FF0000": 3 },
      fontSizes: { "16px": 5 },
      fontFamilies: { "Inter": 10 },
      fontWeights: { "400": 8 },
      spacing: { "8px": 4 },
      borderRadius: { "4px": 2 },
    };

    const result = deserializeStyles(serialized);

    expect(result.colors).toBeInstanceOf(Map);
    expect(result.colors.get("#FF0000")).toBe(3);
    expect(result.fontSizes.get("16px")).toBe(5);
    expect(result.fontFamilies.get("Inter")).toBe(10);
  });

  it("roundtrips with serializeStyles", () => {
    const original = makeStyles({
      colors: new Map([["#ABC", 1]]),
      spacing: new Map([["12px", 3]]),
    });

    const roundTripped = deserializeStyles(serializeStyles(original));

    expect(roundTripped.colors.get("#ABC")).toBe(1);
    expect(roundTripped.spacing.get("12px")).toBe(3);
  });
});

describe("truncateHTML", () => {
  it("returns HTML unchanged when within limit", () => {
    const html = "<div>Hello</div>";
    expect(truncateHTML(html)).toBe(html);
  });

  it("truncates and appends comment when exceeding limit", () => {
    const html = "x".repeat(200);
    const result = truncateHTML(html, 100);

    expect(result.length).toBe(100 + "<!-- truncated -->".length);
    expect(result).toContain("<!-- truncated -->");
  });

  it("defaults to 50000 character limit", () => {
    const html = "x".repeat(50001);
    const result = truncateHTML(html);

    expect(result.length).toBe(50000 + "<!-- truncated -->".length);
  });
});

describe("createStyleSummary", () => {
  it("includes all style sections", () => {
    const styles = makeStyles();
    const summary = createStyleSummary(styles);

    expect(summary).toContain("## Detected Styles Summary");
    expect(summary).toContain("### Colors");
    expect(summary).toContain("### Font Sizes");
    expect(summary).toContain("### Font Families");
    expect(summary).toContain("### Font Weights");
    expect(summary).toContain("### Spacing Values");
    expect(summary).toContain("### Border Radius");
  });

  it("lists styles with occurrence counts, sorted by frequency", () => {
    const styles = makeStyles({
      colors: new Map([
        ["#FF0000", 5],
        ["#00FF00", 10],
      ]),
    });

    const summary = createStyleSummary(styles);

    // #00FF00 should appear first (higher count)
    const greenIdx = summary.indexOf("#00FF00");
    const redIdx = summary.indexOf("#FF0000");
    expect(greenIdx).toBeLessThan(redIdx);
    expect(summary).toContain("#00FF00: 10 occurrences");
    expect(summary).toContain("#FF0000: 5 occurrences");
  });

  it("limits colors to top 20", () => {
    const colors = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      colors.set(`#${i.toString().padStart(6, "0")}`, 30 - i);
    }
    const styles = makeStyles({ colors });
    const summary = createStyleSummary(styles);

    // Count how many color lines appear
    const colorMatches = summary.match(/- #\d{6}: \d+ occurrences/g);
    expect(colorMatches?.length).toBe(20);
  });

  it("includes utility classes when html option provided", () => {
    const styles = makeStyles();
    const html = '<div class="p-4 bg-blue-500 text-white">Hello</div>';
    const summary = createStyleSummary(styles, { html });

    expect(summary).toContain("### Utility Classes (from markup)");
    expect(summary).toContain("p-4");
    expect(summary).toContain("bg-blue-500");
  });

  it("shows (none detected) when html has no classes", () => {
    const styles = makeStyles();
    const summary = createStyleSummary(styles, { html: "<div>No classes</div>" });

    expect(summary).toContain("(none detected)");
  });

  it("includes tailwind theme tokens when provided", () => {
    const styles = makeStyles();
    const summary = createStyleSummary(styles, {
      tailwindTheme: {
        configPath: "tailwind.config.ts",
        colors: ["blue-500", "red-500"],
        spacingKeys: ["1", "2", "4"],
        borderRadiusKeys: ["sm", "md"],
        fontFamilyKeys: ["sans"],
        fontSizeKeys: ["sm", "base", "lg"],
      },
    });

    expect(summary).toContain("### Tailwind Theme Tokens (from config)");
    expect(summary).toContain("configPath: tailwind.config.ts");
    expect(summary).toContain("colors: 2");
    expect(summary).toContain("spacingKeys: 3");
  });

  it("includes variant classes section when html has variants", () => {
    const styles = makeStyles();
    const html = '<div class="sm:p-4 hover:bg-blue-500 lg:text-xl">test</div>';
    const summary = createStyleSummary(styles, { html });

    expect(summary).toContain("### Common Variants");
    expect(summary).toContain("sm");
    expect(summary).toContain("hover");
  });
});
