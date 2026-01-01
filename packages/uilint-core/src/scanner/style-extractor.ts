/**
 * Style extraction from DOM elements
 */

import type {
  ExtractedStyles,
  SerializedStyles,
  TailwindThemeTokens,
} from "../types.js";
import {
  extractClassTokensFromHtml,
  topEntries,
} from "../tailwind/class-tokens.js";

/**
 * Extracts all computed styles from elements in the document
 * Works in both browser and JSDOM environments
 */
export function extractStyles(
  root: Element | Document,
  getComputedStyle: (el: Element) => CSSStyleDeclaration
): ExtractedStyles {
  const styles: ExtractedStyles = {
    colors: new Map(),
    fontSizes: new Map(),
    fontFamilies: new Map(),
    fontWeights: new Map(),
    spacing: new Map(),
    borderRadius: new Map(),
  };

  const elements = root.querySelectorAll("*");

  elements.forEach((element) => {
    // nodeType === 1 means Element node (works in both browser and JSDOM)
    if (element.nodeType !== 1) return;

    const computed = getComputedStyle(element);

    // Extract colors
    extractColor(computed.color, styles.colors);
    extractColor(computed.backgroundColor, styles.colors);
    extractColor(computed.borderColor, styles.colors);

    // Extract typography
    incrementMap(styles.fontSizes, computed.fontSize);
    incrementMap(styles.fontFamilies, normalizeFontFamily(computed.fontFamily));
    incrementMap(styles.fontWeights, computed.fontWeight);

    // Extract spacing
    extractSpacing(computed.margin, styles.spacing);
    extractSpacing(computed.padding, styles.spacing);
    incrementMap(styles.spacing, computed.gap);

    // Extract border radius
    incrementMap(styles.borderRadius, computed.borderRadius);
  });

  return styles;
}

/**
 * Extracts styles from browser DOM (uses window.getComputedStyle)
 */
export function extractStylesFromDOM(
  root?: Element | Document
): ExtractedStyles {
  const targetRoot = root || document.body;
  return extractStyles(targetRoot, (el) => window.getComputedStyle(el));
}

function extractColor(color: string, map: Map<string, number>): void {
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return;

  // Normalize to hex
  const hex = rgbToHex(color);
  if (hex) {
    incrementMap(map, hex);
  }
}

function extractSpacing(value: string, map: Map<string, number>): void {
  if (!value || value === "0px") return;

  // Split compound values (e.g., "10px 20px 10px 20px")
  const values = value.split(" ").filter((v) => v && v !== "0px");
  values.forEach((v) => incrementMap(map, v));
}

function incrementMap(map: Map<string, number>, value: string): void {
  if (!value || value === "normal" || value === "auto") return;
  map.set(value, (map.get(value) || 0) + 1);
}

function normalizeFontFamily(fontFamily: string): string {
  // Get the primary font (first in the stack)
  const primary = fontFamily.split(",")[0].trim();
  return primary.replace(/['"]/g, "");
}

function rgbToHex(rgb: string): string | null {
  // Handle hex values
  if (rgb.startsWith("#")) return rgb.toUpperCase();

  // Handle rgb/rgba values
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;

  const [, r, g, b] = match;
  const toHex = (n: string) => parseInt(n).toString(16).padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Converts ExtractedStyles maps to plain objects for serialization
 */
export function serializeStyles(styles: ExtractedStyles): SerializedStyles {
  return {
    colors: Object.fromEntries(styles.colors),
    fontSizes: Object.fromEntries(styles.fontSizes),
    fontFamilies: Object.fromEntries(styles.fontFamilies),
    fontWeights: Object.fromEntries(styles.fontWeights),
    spacing: Object.fromEntries(styles.spacing),
    borderRadius: Object.fromEntries(styles.borderRadius),
  };
}

/**
 * Converts SerializedStyles back to ExtractedStyles
 */
export function deserializeStyles(
  serialized: SerializedStyles
): ExtractedStyles {
  return {
    colors: new Map(Object.entries(serialized.colors)),
    fontSizes: new Map(Object.entries(serialized.fontSizes)),
    fontFamilies: new Map(Object.entries(serialized.fontFamilies)),
    fontWeights: new Map(Object.entries(serialized.fontWeights)),
    spacing: new Map(Object.entries(serialized.spacing)),
    borderRadius: new Map(Object.entries(serialized.borderRadius)),
  };
}

/**
 * Creates a summary of extracted styles for LLM analysis
 */
export function createStyleSummary(
  styles: ExtractedStyles,
  options: CreateStyleSummaryOptions = {}
): string {
  return createStyleSummaryWithOptions(styles, options);
}

export interface CreateStyleSummaryOptions {
  /**
   * Optional HTML/TSX-ish string used to extract utility classes (Tailwind etc).
   */
  html?: string;
  /**
   * Optional Tailwind theme tokens (typically from tailwind.config.*).
   */
  tailwindTheme?: TailwindThemeTokens | null;
}

/**
 * Creates a summary of extracted styles for LLM analysis.
 * Accepts optional Tailwind context to make Tailwind-heavy projects analyzable
 * even when computed styles are sparse (e.g., JSDOM without loaded CSS).
 */
export function createStyleSummaryWithOptions(
  styles: ExtractedStyles,
  options: CreateStyleSummaryOptions = {}
): string {
  const lines: string[] = [];

  lines.push("## Detected Styles Summary\n");

  // Colors
  lines.push("### Colors");
  const sortedColors = [...styles.colors.entries()].sort((a, b) => b[1] - a[1]);
  sortedColors.slice(0, 20).forEach(([color, count]) => {
    lines.push(`- ${color}: ${count} occurrences`);
  });
  lines.push("");

  // Font sizes
  lines.push("### Font Sizes");
  const sortedFontSizes = [...styles.fontSizes.entries()].sort(
    (a, b) => b[1] - a[1]
  );
  sortedFontSizes.forEach(([size, count]) => {
    lines.push(`- ${size}: ${count} occurrences`);
  });
  lines.push("");

  // Font families
  lines.push("### Font Families");
  const sortedFontFamilies = [...styles.fontFamilies.entries()].sort(
    (a, b) => b[1] - a[1]
  );
  sortedFontFamilies.forEach(([family, count]) => {
    lines.push(`- ${family}: ${count} occurrences`);
  });
  lines.push("");

  // Font weights
  lines.push("### Font Weights");
  const sortedFontWeights = [...styles.fontWeights.entries()].sort(
    (a, b) => b[1] - a[1]
  );
  sortedFontWeights.forEach(([weight, count]) => {
    lines.push(`- ${weight}: ${count} occurrences`);
  });
  lines.push("");

  // Spacing
  lines.push("### Spacing Values");
  const sortedSpacing = [...styles.spacing.entries()].sort(
    (a, b) => b[1] - a[1]
  );
  sortedSpacing.slice(0, 15).forEach(([value, count]) => {
    lines.push(`- ${value}: ${count} occurrences`);
  });
  lines.push("");

  // Border radius
  lines.push("### Border Radius");
  const sortedBorderRadius = [...styles.borderRadius.entries()].sort(
    (a, b) => b[1] - a[1]
  );
  sortedBorderRadius.forEach(([value, count]) => {
    lines.push(`- ${value}: ${count} occurrences`);
  });

  // Tailwind / utility classes (optional)
  if (options.html) {
    const tokens = extractClassTokensFromHtml(options.html);
    const topUtilities = topEntries(tokens.utilities, 40);
    const topVariants = topEntries(tokens.variants, 15);

    lines.push("");
    lines.push("### Utility Classes (from markup)");
    if (topUtilities.length === 0) {
      lines.push("- (none detected)");
    } else {
      topUtilities.forEach(({ token, count }) => {
        lines.push(`- ${token}: ${count} occurrences`);
      });
    }

    if (topVariants.length > 0) {
      lines.push("");
      lines.push("### Common Variants");
      topVariants.forEach(({ token, count }) => {
        lines.push(`- ${token}: ${count} occurrences`);
      });
    }
  }

  // Tailwind theme tokens (optional)
  if (options.tailwindTheme) {
    const tt = options.tailwindTheme;
    lines.push("");
    lines.push("### Tailwind Theme Tokens (from config)");
    lines.push(`- configPath: ${tt.configPath}`);
    lines.push(`- colors: ${tt.colors.length}`);
    lines.push(`- spacingKeys: ${tt.spacingKeys.length}`);
    lines.push(`- borderRadiusKeys: ${tt.borderRadiusKeys.length}`);
    lines.push(`- fontFamilyKeys: ${tt.fontFamilyKeys.length}`);
    lines.push(`- fontSizeKeys: ${tt.fontSizeKeys.length}`);
  }

  return lines.join("\n");
}

/**
 * Truncates HTML to a maximum length
 */
export function truncateHTML(html: string, maxLength: number = 50000): string {
  if (html.length <= maxLength) return html;
  return html.slice(0, maxLength) + "<!-- truncated -->";
}
