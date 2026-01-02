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

export interface TailwindAllowlist {
  allowAnyColor: boolean;
  allowStandardSpacing: boolean;
  allowedTailwindColors: Set<string>;
  allowedUtilities: Set<string>;
  allowedSpacingKeys: Set<string>;
  allowedBorderRadiusKeys: Set<string>;
  allowedFontSizeKeys: Set<string>;
  allowedFontFamilyKeys: Set<string>;
}

/**
 * Extract Tailwind / utility-class allowlist configuration from a style guide.
 *
 * Expected formats:
 * - A JSON code block inside a "## Tailwind" section (preferred; produced by UILint)
 * - Fallback: inline backticked utilities within the Tailwind section
 */
export function extractTailwindAllowlist(content: string): TailwindAllowlist {
  const empty: TailwindAllowlist = {
    allowAnyColor: false,
    allowStandardSpacing: false,
    allowedTailwindColors: new Set(),
    allowedUtilities: new Set(),
    allowedSpacingKeys: new Set(),
    allowedBorderRadiusKeys: new Set(),
    allowedFontSizeKeys: new Set(),
    allowedFontFamilyKeys: new Set(),
  };

  // Only look for allowlist details in the Tailwind section.
  const sections = parseStyleGuideSections(content);
  const tailwindSection =
    sections["tailwind"] ??
    // defensive: some styleguides use different casing/spacing
    sections["tailwind utilities"] ??
    "";

  if (!tailwindSection) return empty;

  const parsed = tryParseFirstJsonCodeBlock(tailwindSection);
  if (parsed && typeof parsed === "object") {
    const allowAnyColor = Boolean((parsed as any).allowAnyColor);
    const allowStandardSpacing = Boolean((parsed as any).allowStandardSpacing);

    const allowedUtilitiesArr = Array.isArray((parsed as any).allowedUtilities)
      ? ((parsed as any).allowedUtilities as unknown[]).filter(
          (u): u is string => typeof u === "string"
        )
      : [];

    const themeTokens = (parsed as any).themeTokens ?? {};
    const themeColors = Array.isArray(themeTokens.colors)
      ? (themeTokens.colors as unknown[]).filter(
          (c): c is string => typeof c === "string"
        )
      : [];
    const spacingKeys = Array.isArray(themeTokens.spacingKeys)
      ? (themeTokens.spacingKeys as unknown[]).filter(
          (k): k is string => typeof k === "string"
        )
      : [];
    const borderRadiusKeys = Array.isArray(themeTokens.borderRadiusKeys)
      ? (themeTokens.borderRadiusKeys as unknown[]).filter(
          (k): k is string => typeof k === "string"
        )
      : [];
    const fontFamilyKeys = Array.isArray(themeTokens.fontFamilyKeys)
      ? (themeTokens.fontFamilyKeys as unknown[]).filter(
          (k): k is string => typeof k === "string"
        )
      : [];
    const fontSizeKeys = Array.isArray(themeTokens.fontSizeKeys)
      ? (themeTokens.fontSizeKeys as unknown[]).filter(
          (k): k is string => typeof k === "string"
        )
      : [];

    const allowedTailwindColors = new Set<string>();
    for (const c of themeColors) {
      const raw = c.trim();
      if (!raw) continue;
      if (raw.toLowerCase().startsWith("tailwind:")) {
        allowedTailwindColors.add(raw.toLowerCase());
        continue;
      }
      const m = raw.match(/^([a-zA-Z]+)-(\d{2,3})$/);
      if (m) {
        allowedTailwindColors.add(`tailwind:${m[1].toLowerCase()}-${m[2]}`);
      }
    }

    return {
      allowAnyColor,
      allowStandardSpacing,
      allowedTailwindColors,
      allowedUtilities: new Set(
        allowedUtilitiesArr.map((s) => s.trim()).filter(Boolean)
      ),
      allowedSpacingKeys: new Set(
        spacingKeys.map((s) => s.trim()).filter(Boolean)
      ),
      allowedBorderRadiusKeys: new Set(
        borderRadiusKeys.map((s) => s.trim()).filter(Boolean)
      ),
      allowedFontSizeKeys: new Set(
        fontSizeKeys.map((s) => s.trim()).filter(Boolean)
      ),
      allowedFontFamilyKeys: new Set(
        fontFamilyKeys.map((s) => s.trim()).filter(Boolean)
      ),
    };
  }

  // Fallback: harvest backticked utilities from markdown.
  const backticked: string[] = [];
  for (const m of tailwindSection.matchAll(/`([^`]+)`/g)) {
    backticked.push(m[1]);
  }

  return {
    ...empty,
    allowedUtilities: new Set(
      backticked
        .flatMap((s) => s.split(/[,\s]+/g))
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  };
}

function tryParseFirstJsonCodeBlock(section: string): unknown | null {
  // Prefer ```json fenced blocks, but fall back to any fenced block.
  const jsonBlocks = [...section.matchAll(/```json\s*([\s\S]*?)```/gi)];
  const anyBlocks = [...section.matchAll(/```\s*([\s\S]*?)```/g)];

  const candidates = (jsonBlocks.length ? jsonBlocks : anyBlocks).map(
    (m) => m[1]
  );
  for (const raw of candidates) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      return JSON.parse(trimmed);
    } catch {
      continue;
    }
  }
  return null;
}
