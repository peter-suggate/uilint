/**
 * Generate Markdown style guides from extracted styles
 */

import type {
  ExtractedStyles,
  StyleGuide,
  TailwindThemeTokens,
} from "../types.js";

/**
 * Generates a Markdown style guide from extracted styles
 */
export interface GenerateStyleGuideOptions {
  /**
   * Optional HTML/TSX-ish string used to extract utility classes (Tailwind etc).
   */
  html?: string;
  /**
   * Optional Tailwind theme tokens (typically from tailwind.config.*).
   */
  tailwindTheme?: TailwindThemeTokens | null;
}

export function generateStyleGuideFromStyles(
  styles: ExtractedStyles,
  options: GenerateStyleGuideOptions = {}
): string {
  // NOTE: Style guide auto-generation has been removed.
  // UILint now requires an explicit, user-owned style guide file (typically
  // `.uilint/styleguide.md`) to avoid silently producing/overwriting rules.
  void styles;
  void options;
  throw new Error(
    'Style guide auto-generation has been removed. Create ".uilint/styleguide.md" at your workspace root (recommended: run "/genstyleguide" in Cursor).'
  );
}

/**
 * Converts a StyleGuide object back to Markdown
 */
export function styleGuideToMarkdown(guide: StyleGuide): string {
  const lines: string[] = [];

  lines.push("# UI Style Guide");
  lines.push("");

  // Colors
  lines.push("## Colors");
  guide.colors.forEach((color) => {
    const usage = color.usage ? ` (${color.usage})` : "";
    lines.push(`- **${color.name}**: ${color.value}${usage}`);
  });
  lines.push("");

  // Typography
  lines.push("## Typography");
  guide.typography.forEach((typo) => {
    const props: string[] = [];
    if (typo.fontFamily) props.push(`font-family: "${typo.fontFamily}"`);
    if (typo.fontSize) props.push(`font-size: ${typo.fontSize}`);
    if (typo.fontWeight) props.push(`font-weight: ${typo.fontWeight}`);
    if (typo.lineHeight) props.push(`line-height: ${typo.lineHeight}`);
    lines.push(`- **${typo.element}**: ${props.join(", ")}`);
  });
  lines.push("");

  // Spacing
  lines.push("## Spacing");
  guide.spacing.forEach((space) => {
    lines.push(`- **${space.name}**: ${space.value}`);
  });
  lines.push("");

  // Components
  lines.push("## Components");
  guide.components.forEach((comp) => {
    lines.push(`- **${comp.name}**: ${comp.styles.join(", ")}`);
  });

  return lines.join("\n");
}
