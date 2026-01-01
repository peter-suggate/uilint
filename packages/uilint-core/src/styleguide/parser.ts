/**
 * Parse Markdown style guides into structured data
 */

import type {
  StyleGuide,
  ColorRule,
  TypographyRule,
  SpacingRule,
  ComponentRule,
  ExtractedStyleValues,
} from "../types.js";
import { createEmptyStyleGuide } from "./schema.js";

/**
 * Parses a Markdown style guide into a structured object
 */
export function parseStyleGuide(markdown: string): StyleGuide {
  const guide = createEmptyStyleGuide();
  const sections = splitIntoSections(markdown);

  sections.forEach(({ title, content }) => {
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes("color")) {
      guide.colors = parseColorSection(content);
    } else if (
      lowerTitle.includes("typography") ||
      lowerTitle.includes("font")
    ) {
      guide.typography = parseTypographySection(content);
    } else if (lowerTitle.includes("spacing")) {
      guide.spacing = parseSpacingSection(content);
    } else if (lowerTitle.includes("component")) {
      guide.components = parseComponentSection(content);
    }
  });

  return guide;
}

interface Section {
  title: string;
  content: string;
}

function splitIntoSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const lines = markdown.split("\n");

  let currentTitle = "";
  let currentContent: string[] = [];

  lines.forEach((line) => {
    const headerMatch = line.match(/^##\s+(.+)$/);

    if (headerMatch) {
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          content: currentContent.join("\n"),
        });
      }
      currentTitle = headerMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  });

  if (currentTitle) {
    sections.push({
      title: currentTitle,
      content: currentContent.join("\n"),
    });
  }

  return sections;
}

function parseColorSection(content: string): ColorRule[] {
  const colors: ColorRule[] = [];
  const lines = content.split("\n");

  lines.forEach((line) => {
    // Match patterns like: - **Primary**: #3B82F6 (used in buttons)
    const match = line.match(
      /[-*]\s*\*?\*?([^*:]+)\*?\*?:\s*(#[A-Fa-f0-9]{6})\s*(?:\(([^)]+)\))?/
    );

    if (match) {
      colors.push({
        name: match[1].trim(),
        value: match[2].toUpperCase(),
        usage: match[3] || "",
      });
    }
  });

  return colors;
}

function parseTypographySection(content: string): TypographyRule[] {
  const typography: TypographyRule[] = [];
  const lines = content.split("\n");

  lines.forEach((line) => {
    // Match patterns like: - **Headings**: font-family: "Inter", font-size: 24px
    const elementMatch = line.match(/[-*]\s*\*?\*?([^*:]+)\*?\*?:\s*(.+)/);

    if (elementMatch) {
      const rule: TypographyRule = {
        element: elementMatch[1].trim(),
      };

      const props = elementMatch[2];

      const fontFamilyMatch = props.match(/font-family:\s*"?([^",]+)"?/);
      if (fontFamilyMatch) rule.fontFamily = fontFamilyMatch[1].trim();

      const fontSizeMatch = props.match(/font-size:\s*(\d+px)/);
      if (fontSizeMatch) rule.fontSize = fontSizeMatch[1];

      const fontWeightMatch = props.match(/font-weight:\s*(\d+)/);
      if (fontWeightMatch) rule.fontWeight = fontWeightMatch[1];

      const lineHeightMatch = props.match(/line-height:\s*([\d.]+)/);
      if (lineHeightMatch) rule.lineHeight = lineHeightMatch[1];

      typography.push(rule);
    }
  });

  return typography;
}

function parseSpacingSection(content: string): SpacingRule[] {
  const spacing: SpacingRule[] = [];
  const lines = content.split("\n");

  lines.forEach((line) => {
    // Match patterns like: - **Base unit**: 4px
    const match = line.match(/[-*]\s*\*?\*?([^*:]+)\*?\*?:\s*(.+)/);

    if (match) {
      spacing.push({
        name: match[1].trim(),
        value: match[2].trim(),
      });
    }
  });

  return spacing;
}

function parseComponentSection(content: string): ComponentRule[] {
  const components: ComponentRule[] = [];
  const lines = content.split("\n");

  lines.forEach((line) => {
    // Match patterns like: - **Buttons**: rounded-lg, px-4 py-2
    const match = line.match(/[-*]\s*\*?\*?([^*:]+)\*?\*?:\s*(.+)/);

    if (match) {
      components.push({
        name: match[1].trim(),
        styles: match[2].split(",").map((s) => s.trim()),
      });
    }
  });

  return components;
}

/**
 * Parses sections from a Markdown style guide (simpler format)
 */
export function parseStyleGuideSections(
  content: string
): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = content.split("\n");

  let currentSection = "intro";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)$/);

    if (headerMatch) {
      if (currentContent.length > 0) {
        sections[currentSection.toLowerCase()] = currentContent
          .join("\n")
          .trim();
      }

      currentSection = headerMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    sections[currentSection.toLowerCase()] = currentContent.join("\n").trim();
  }

  return sections;
}

/**
 * Extracts specific values from the style guide
 */
export function extractStyleValues(content: string): ExtractedStyleValues {
  const result: ExtractedStyleValues = {
    colors: [],
    fontSizes: [],
    fontFamilies: [],
    spacing: [],
    borderRadius: [],
  };

  // Extract hex colors
  const colorMatches = content.matchAll(/#[A-Fa-f0-9]{6}\b/g);
  for (const match of colorMatches) {
    if (!result.colors.includes(match[0].toUpperCase())) {
      result.colors.push(match[0].toUpperCase());
    }
  }

  // Extract font sizes (e.g., 16px, 1.5rem)
  const fontSizeMatches = content.matchAll(/\b(\d+(?:\.\d+)?(?:px|rem|em))\b/g);
  for (const match of fontSizeMatches) {
    if (!result.fontSizes.includes(match[1])) {
      result.fontSizes.push(match[1]);
    }
  }

  // Extract font families (quoted strings in font context)
  const fontFamilyMatches = content.matchAll(
    /font-family:\s*["']?([^"',\n]+)/gi
  );
  for (const match of fontFamilyMatches) {
    const family = match[1].trim();
    if (!result.fontFamilies.includes(family)) {
      result.fontFamilies.push(family);
    }
  }

  return result;
}
