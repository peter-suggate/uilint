import { describe, it, expect } from "vitest";
import {
  generateStyleGuideFromStyles,
  styleGuideToMarkdown,
} from "../../src/styleguide/generator.js";
import type { StyleGuide, ExtractedStyles } from "../../src/types.js";

describe("generateStyleGuideFromStyles", () => {
  it("throws error indicating auto-generation has been removed", () => {
    const styles: ExtractedStyles = {
      colors: new Map(),
      fontSizes: new Map(),
      fontFamilies: new Map(),
      fontWeights: new Map(),
      spacing: new Map(),
      borderRadius: new Map(),
    };

    expect(() => generateStyleGuideFromStyles(styles)).toThrow(
      "Style guide auto-generation has been removed"
    );
  });
});

describe("styleGuideToMarkdown", () => {
  it("renders empty guide with section headers only", () => {
    const guide: StyleGuide = {
      colors: [],
      typography: [],
      spacing: [],
      components: [],
    };

    const md = styleGuideToMarkdown(guide);

    expect(md).toContain("# UI Style Guide");
    expect(md).toContain("## Colors");
    expect(md).toContain("## Typography");
    expect(md).toContain("## Spacing");
    expect(md).toContain("## Components");
  });

  it("renders color rules with name, value and optional usage", () => {
    const guide: StyleGuide = {
      colors: [
        { name: "Primary", value: "#3B82F6", usage: "buttons, links" },
        { name: "Background", value: "#FFFFFF", usage: "" },
      ],
      typography: [],
      spacing: [],
      components: [],
    };

    const md = styleGuideToMarkdown(guide);

    expect(md).toContain("- **Primary**: #3B82F6 (buttons, links)");
    expect(md).toContain("- **Background**: #FFFFFF");
    // No usage suffix when usage is empty
    expect(md).not.toContain("Background**: #FFFFFF (");
  });

  it("renders typography rules with all optional fields", () => {
    const guide: StyleGuide = {
      colors: [],
      typography: [
        {
          element: "h1",
          fontFamily: "Inter",
          fontSize: "2rem",
          fontWeight: "700",
          lineHeight: "1.2",
        },
        {
          element: "body",
          fontSize: "16px",
        },
      ],
      spacing: [],
      components: [],
    };

    const md = styleGuideToMarkdown(guide);

    expect(md).toContain(
      '- **h1**: font-family: "Inter", font-size: 2rem, font-weight: 700, line-height: 1.2'
    );
    expect(md).toContain("- **body**: font-size: 16px");
  });

  it("renders spacing rules", () => {
    const guide: StyleGuide = {
      colors: [],
      typography: [],
      spacing: [
        { name: "sm", value: "8px" },
        { name: "md", value: "16px" },
      ],
      components: [],
    };

    const md = styleGuideToMarkdown(guide);

    expect(md).toContain("- **sm**: 8px");
    expect(md).toContain("- **md**: 16px");
  });

  it("renders component rules with styles joined", () => {
    const guide: StyleGuide = {
      colors: [],
      typography: [],
      spacing: [],
      components: [
        { name: "Button", styles: ["bg-blue-500", "text-white", "rounded"] },
      ],
    };

    const md = styleGuideToMarkdown(guide);

    expect(md).toContain(
      "- **Button**: bg-blue-500, text-white, rounded"
    );
  });

  it("produces valid markdown with all sections populated", () => {
    const guide: StyleGuide = {
      colors: [{ name: "Red", value: "#FF0000", usage: "errors" }],
      typography: [{ element: "p", fontSize: "14px" }],
      spacing: [{ name: "gap", value: "12px" }],
      components: [{ name: "Card", styles: ["shadow-md", "rounded-lg"] }],
    };

    const md = styleGuideToMarkdown(guide);
    const lines = md.split("\n");

    // Verify sections appear in correct order
    const headingIndices = lines
      .map((line, i) => (line.startsWith("#") ? i : -1))
      .filter((i) => i >= 0);

    expect(headingIndices.length).toBe(5); // Title + 4 sections
    // Each section should come after the previous
    for (let i = 1; i < headingIndices.length; i++) {
      expect(headingIndices[i]).toBeGreaterThan(headingIndices[i - 1]);
    }
  });
});
