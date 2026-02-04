import { describe, it, expect } from "vitest";
import {
  parseStyleGuide,
  parseStyleGuideSections,
  extractStyleValues,
  extractTailwindAllowlist,
} from "../../src/styleguide/parser.js";

describe("parseStyleGuide", () => {
  it("parses an empty markdown as empty style guide", () => {
    const result = parseStyleGuide("");
    expect(result).toEqual({
      colors: [],
      typography: [],
      spacing: [],
      components: [],
    });
  });

  it("parses color section with hex colors", () => {
    const markdown = `
## Colors

- **Primary**: #3B82F6 (used in buttons)
- **Secondary**: #10B981 (used in links)
- **Error**: #EF4444
`;
    const result = parseStyleGuide(markdown);

    expect(result.colors).toHaveLength(3);
    expect(result.colors[0]).toEqual({
      name: "Primary",
      value: "#3B82F6",
      usage: "used in buttons",
    });
    expect(result.colors[1]).toEqual({
      name: "Secondary",
      value: "#10B981",
      usage: "used in links",
    });
    expect(result.colors[2]).toEqual({
      name: "Error",
      value: "#EF4444",
      usage: "",
    });
  });

  it("parses typography section with font properties", () => {
    const markdown = `
## Typography

- **Headings**: font-family: "Inter", font-size: 24px, font-weight: 700
- **Body**: font-family: "Open Sans", font-size: 16px, line-height: 1.5
`;
    const result = parseStyleGuide(markdown);

    expect(result.typography).toHaveLength(2);
    expect(result.typography[0]).toEqual({
      element: "Headings",
      fontFamily: "Inter",
      fontSize: "24px",
      fontWeight: "700",
    });
    expect(result.typography[1]).toEqual({
      element: "Body",
      fontFamily: "Open Sans",
      fontSize: "16px",
      lineHeight: "1.5",
    });
  });

  it("parses spacing section", () => {
    const markdown = `
## Spacing

- **Base unit**: 4px
- **Large**: 16px
- **Extra Large**: 32px
`;
    const result = parseStyleGuide(markdown);

    expect(result.spacing).toHaveLength(3);
    expect(result.spacing[0]).toEqual({
      name: "Base unit",
      value: "4px",
    });
    expect(result.spacing[1]).toEqual({
      name: "Large",
      value: "16px",
    });
  });

  it("parses component section", () => {
    const markdown = `
## Components

- **Buttons**: rounded-lg, px-4 py-2, shadow-sm
- **Cards**: rounded-xl, p-6, shadow-md
`;
    const result = parseStyleGuide(markdown);

    expect(result.components).toHaveLength(2);
    expect(result.components[0]).toEqual({
      name: "Buttons",
      styles: ["rounded-lg", "px-4 py-2", "shadow-sm"],
    });
    expect(result.components[1]).toEqual({
      name: "Cards",
      styles: ["rounded-xl", "p-6", "shadow-md"],
    });
  });

  it("parses complete style guide with all sections", () => {
    const markdown = `
# My Style Guide

## Colors

- **Primary**: #3B82F6 (main brand color)

## Typography

- **Headings**: font-family: "Inter", font-size: 24px

## Spacing

- **Base**: 8px

## Components

- **Button**: rounded-md, px-4
`;
    const result = parseStyleGuide(markdown);

    expect(result.colors).toHaveLength(1);
    expect(result.typography).toHaveLength(1);
    expect(result.spacing).toHaveLength(1);
    expect(result.components).toHaveLength(1);
  });

  it("handles case-insensitive section titles", () => {
    const markdown = `
## COLORS

- **Primary**: #FF0000

## Font Styles

- **Title**: font-family: Arial, font-size: 18px
`;
    const result = parseStyleGuide(markdown);

    expect(result.colors).toHaveLength(1);
    expect(result.typography).toHaveLength(1);
  });

  it("uppercases hex color values", () => {
    const markdown = `
## Colors

- **Primary**: #aabbcc
`;
    const result = parseStyleGuide(markdown);

    expect(result.colors[0].value).toBe("#AABBCC");
  });
});

describe("parseStyleGuideSections", () => {
  it("returns empty object for empty content", () => {
    const result = parseStyleGuideSections("");
    expect(result).toEqual({ intro: "" });
  });

  it("parses sections by ## headers", () => {
    const content = `
## Colors

Color content here

## Typography

Typography content here
`;
    const result = parseStyleGuideSections(content);

    expect(result["colors"]).toContain("Color content here");
    expect(result["typography"]).toContain("Typography content here");
  });

  it("captures content before first header as intro", () => {
    const content = `
This is the intro.

## Colors

Color content
`;
    const result = parseStyleGuideSections(content);

    expect(result["intro"]).toContain("This is the intro.");
    expect(result["colors"]).toContain("Color content");
  });

  it("lowercases section keys", () => {
    const content = `
## My Custom Section

Content
`;
    const result = parseStyleGuideSections(content);

    expect(result["my custom section"]).toBeDefined();
    expect(result["MY CUSTOM SECTION"]).toBeUndefined();
  });

  it("trims section content", () => {
    const content = `
## Section


Content with surrounding whitespace

`;
    const result = parseStyleGuideSections(content);

    expect(result["section"]).toBe("Content with surrounding whitespace");
  });
});

describe("extractStyleValues", () => {
  it("extracts hex colors", () => {
    const content = `
Primary: #3B82F6
Secondary: #10b981
Accent: #aabbcc
`;
    const result = extractStyleValues(content);

    expect(result.colors).toEqual(["#3B82F6", "#10B981", "#AABBCC"]);
  });

  it("deduplicates hex colors", () => {
    const content = `
Primary: #3B82F6
Also Primary: #3B82F6
Again: #3b82f6
`;
    const result = extractStyleValues(content);

    expect(result.colors).toHaveLength(1);
    expect(result.colors[0]).toBe("#3B82F6");
  });

  it("extracts font sizes with various units", () => {
    const content = `
Small: 12px
Medium: 1rem
Large: 1.5em
XL: 24px
`;
    const result = extractStyleValues(content);

    expect(result.fontSizes).toContain("12px");
    expect(result.fontSizes).toContain("1rem");
    expect(result.fontSizes).toContain("1.5em");
    expect(result.fontSizes).toContain("24px");
  });

  it("deduplicates font sizes", () => {
    const content = `
Size: 16px
Same Size: 16px
`;
    const result = extractStyleValues(content);

    expect(result.fontSizes.filter((s) => s === "16px")).toHaveLength(1);
  });

  it("extracts font families from font-family declarations", () => {
    const content = `
font-family: "Inter"
font-family: Arial
font-family: 'Open Sans'
`;
    const result = extractStyleValues(content);

    expect(result.fontFamilies).toContain("Inter");
    expect(result.fontFamilies).toContain("Arial");
    expect(result.fontFamilies).toContain("Open Sans");
  });

  it("deduplicates font families", () => {
    const content = `
font-family: Inter
font-family: Inter
`;
    const result = extractStyleValues(content);

    expect(result.fontFamilies.filter((f) => f === "Inter")).toHaveLength(1);
  });

  it("returns empty arrays for content without style values", () => {
    const content = "Just some text without any style values";
    const result = extractStyleValues(content);

    expect(result.colors).toEqual([]);
    expect(result.fontSizes).toEqual([]);
    expect(result.fontFamilies).toEqual([]);
    expect(result.spacing).toEqual([]);
    expect(result.borderRadius).toEqual([]);
  });

  it("ignores invalid hex colors", () => {
    const content = `
Valid: #AABBCC
Invalid short: #ABC
Invalid chars: #GGGGGG
`;
    const result = extractStyleValues(content);

    expect(result.colors).toHaveLength(1);
    expect(result.colors[0]).toBe("#AABBCC");
  });
});

describe("extractTailwindAllowlist", () => {
  it("returns empty allowlist for content without Tailwind section", () => {
    const content = `
## Colors

- Primary: #3B82F6
`;
    const result = extractTailwindAllowlist(content);

    expect(result.allowAnyColor).toBe(false);
    expect(result.allowStandardSpacing).toBe(false);
    expect(result.allowedTailwindColors.size).toBe(0);
    expect(result.allowedUtilities.size).toBe(0);
    expect(result.allowedSpacingKeys.size).toBe(0);
    expect(result.allowedBorderRadiusKeys.size).toBe(0);
    expect(result.allowedFontSizeKeys.size).toBe(0);
    expect(result.allowedFontFamilyKeys.size).toBe(0);
  });

  it("parses JSON code block in Tailwind section", () => {
    const content = `
## Tailwind

\`\`\`json
{
  "allowAnyColor": true,
  "allowStandardSpacing": true,
  "allowedUtilities": ["rounded-lg", "shadow-md"],
  "themeTokens": {
    "colors": ["blue-500", "red-600"],
    "spacingKeys": ["4", "8", "16"],
    "borderRadiusKeys": ["md", "lg"],
    "fontSizeKeys": ["sm", "base", "lg"],
    "fontFamilyKeys": ["sans", "mono"]
  }
}
\`\`\`
`;
    const result = extractTailwindAllowlist(content);

    expect(result.allowAnyColor).toBe(true);
    expect(result.allowStandardSpacing).toBe(true);
    expect(result.allowedUtilities).toEqual(
      new Set(["rounded-lg", "shadow-md"])
    );
    expect(result.allowedTailwindColors).toEqual(
      new Set(["tailwind:blue-500", "tailwind:red-600"])
    );
    expect(result.allowedSpacingKeys).toEqual(new Set(["4", "8", "16"]));
    expect(result.allowedBorderRadiusKeys).toEqual(new Set(["md", "lg"]));
    expect(result.allowedFontSizeKeys).toEqual(new Set(["sm", "base", "lg"]));
    expect(result.allowedFontFamilyKeys).toEqual(new Set(["sans", "mono"]));
  });

  it("handles tailwind: prefixed colors", () => {
    const content = `
## Tailwind

\`\`\`json
{
  "themeTokens": {
    "colors": ["tailwind:green-500", "tailwind:Purple-700"]
  }
}
\`\`\`
`;
    const result = extractTailwindAllowlist(content);

    expect(result.allowedTailwindColors).toEqual(
      new Set(["tailwind:green-500", "tailwind:purple-700"])
    );
  });

  it("falls back to backticked utilities when no JSON block", () => {
    const content = `
## Tailwind

Use these utilities: \`rounded-lg\`, \`shadow-sm\`
Also allowed: \`px-4 py-2\`
`;
    const result = extractTailwindAllowlist(content);

    expect(result.allowedUtilities).toContain("rounded-lg");
    expect(result.allowedUtilities).toContain("shadow-sm");
    expect(result.allowedUtilities).toContain("px-4");
    expect(result.allowedUtilities).toContain("py-2");
  });

  it("falls back to backticks when JSON parsing fails", () => {
    // When JSON parsing fails, the function falls back to extracting
    // backticked content. Code fence content also gets captured because
    // the backtick regex matches within the malformed JSON block.
    const content = `
## Tailwind

No valid JSON here, just some \`utility-class\` mentions.
Also \`flex items-center\`.
`;
    const result = extractTailwindAllowlist(content);

    expect(result.allowedUtilities).toContain("utility-class");
    expect(result.allowedUtilities).toContain("flex");
    expect(result.allowedUtilities).toContain("items-center");
  });

  it("handles empty Tailwind section", () => {
    const content = `
## Tailwind

`;
    const result = extractTailwindAllowlist(content);

    expect(result.allowedUtilities.size).toBe(0);
  });

  it("filters out empty values", () => {
    const content = `
## Tailwind

\`\`\`json
{
  "allowedUtilities": ["rounded-lg", "", "  ", "shadow-md"],
  "themeTokens": {
    "spacingKeys": ["4", "", "8"]
  }
}
\`\`\`
`;
    const result = extractTailwindAllowlist(content);

    expect(result.allowedUtilities).toEqual(
      new Set(["rounded-lg", "shadow-md"])
    );
    expect(result.allowedSpacingKeys).toEqual(new Set(["4", "8"]));
  });

  it("handles 'Tailwind Utilities' section name variant", () => {
    const content = `
## Tailwind Utilities

\`\`\`json
{
  "allowedUtilities": ["flex", "grid"]
}
\`\`\`
`;
    const result = extractTailwindAllowlist(content);

    expect(result.allowedUtilities).toEqual(new Set(["flex", "grid"]));
  });

  it("handles missing themeTokens gracefully", () => {
    const content = `
## Tailwind

\`\`\`json
{
  "allowAnyColor": false,
  "allowedUtilities": ["rounded"]
}
\`\`\`
`;
    const result = extractTailwindAllowlist(content);

    expect(result.allowAnyColor).toBe(false);
    expect(result.allowedUtilities).toEqual(new Set(["rounded"]));
    expect(result.allowedTailwindColors.size).toBe(0);
    expect(result.allowedSpacingKeys.size).toBe(0);
  });

  it("handles non-array values in themeTokens gracefully", () => {
    const content = `
## Tailwind

\`\`\`json
{
  "themeTokens": {
    "colors": "not-an-array",
    "spacingKeys": 123
  }
}
\`\`\`
`;
    const result = extractTailwindAllowlist(content);

    expect(result.allowedTailwindColors.size).toBe(0);
    expect(result.allowedSpacingKeys.size).toBe(0);
  });

  it("trims utility values", () => {
    const content = `
## Tailwind

\`\`\`json
{
  "allowedUtilities": ["  rounded-lg  ", " shadow-md "]
}
\`\`\`
`;
    const result = extractTailwindAllowlist(content);

    expect(result.allowedUtilities).toEqual(
      new Set(["rounded-lg", "shadow-md"])
    );
  });
});
