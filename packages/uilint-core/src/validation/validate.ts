/**
 * Code validation against style guide
 */

import type {
  ValidationResult,
  ValidationIssue,
  LintResult,
  LintIssue,
} from "../types.js";
import {
  extractStyleValues,
  extractTailwindAllowlist,
} from "../styleguide/parser.js";

/**
 * Validates code against the style guide
 */
export function validateCode(
  code: string,
  styleGuide: string | null
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!styleGuide) {
    return {
      valid: true,
      issues: [
        {
          type: "warning",
          message:
            "No style guide found. Create .uilint/styleguide.md to enable validation.",
        },
      ],
    };
  }

  const styleValues = extractStyleValues(styleGuide);
  const tailwindAllowlist = /\n##\s+Tailwind\b/i.test(styleGuide)
    ? extractTailwindAllowlist(styleGuide)
    : null;

  // Check for color violations
  const codeColors = extractColorsFromCode(code);
  const allowedColorSet = new Set(
    styleValues.colors.map((c) =>
      c.toLowerCase().startsWith("tailwind:")
        ? c.toLowerCase()
        : c.toUpperCase()
    )
  );
  for (const color of codeColors) {
    const normalized = color.toLowerCase().startsWith("tailwind:")
      ? color.toLowerCase()
      : color.toUpperCase();

    if (
      tailwindAllowlist?.allowAnyColor &&
      normalized.startsWith("tailwind:")
    ) {
      continue;
    }

    if (!allowedColorSet.has(normalized)) {
      // Check if it's similar to an allowed color
      const similar = normalized.startsWith("tailwind:")
        ? null
        : findSimilarColor(color, styleValues.colors);
      issues.push({
        type: "warning",
        message: `Color ${color} is not in the style guide`,
        suggestion: similar
          ? `Consider using ${similar} instead`
          : normalized.startsWith("tailwind:")
          ? `Add ${color} to the style guide Tailwind section (or allow any Tailwind colors)`
          : `Add ${color} to the style guide if intentional`,
      });
    }
  }

  // Tailwind / utility-class allowlist validation (warn on unknown)
  if (tailwindAllowlist) {
    const tokens = extractClassTokensFromCode(code);
    const warned = new Set<string>();

    for (const rawToken of tokens) {
      const base = normalizeUtilityBase(stripVariants(rawToken));
      if (!base) continue;
      if (!looksTailwindUtility(base)) continue;

      if (tailwindAllowlist.allowedUtilities.has(base)) continue;
      if (isAllowedByThemeTokens(base, tailwindAllowlist)) continue;

      // Avoid repeating the same warning many times.
      if (warned.has(base)) continue;
      warned.add(base);

      issues.push({
        type: "warning",
        message: `Tailwind utility "${base}" is not allowed by the style guide`,
        suggestion:
          "Use an allowed utility, or add it to the style guide's Tailwind section (then re-run init/update).",
      });
    }
  }

  // Check for hardcoded pixel values (potential spacing violations)
  const hardcodedPixels = code.matchAll(
    /(?:margin|padding|gap)[-:].*?(\d+)px/gi
  );
  for (const match of hardcodedPixels) {
    const value = parseInt(match[1]);
    // Check if it follows a 4px grid
    if (value % 4 !== 0) {
      issues.push({
        type: "warning",
        message: `Spacing value ${value}px doesn't follow the 4px grid`,
        suggestion: `Use ${Math.round(value / 4) * 4}px instead`,
      });
    }
  }

  // Check for inline styles (often a code smell)
  if (code.includes("style={{") || code.includes("style={")) {
    const inlineStyleCount = (code.match(/style=\{/g) || []).length;
    if (inlineStyleCount > 2) {
      issues.push({
        type: "warning",
        message: `Found ${inlineStyleCount} inline styles. Consider using CSS classes for consistency.`,
      });
    }
  }

  return {
    valid: issues.filter((i) => i.type === "error").length === 0,
    issues,
  };
}

/**
 * Lints a code snippet against the style guide
 */
export function lintSnippet(
  code: string,
  styleGuide: string | null
): LintResult {
  const issues: LintIssue[] = [];

  // Basic linting even without style guide
  issues.push(...lintBasicPatterns(code));

  // Style guide-based linting
  if (styleGuide) {
    issues.push(...lintAgainstStyleGuide(code, styleGuide));
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    issues,
    summary:
      issues.length === 0
        ? "No issues found"
        : `Found ${errorCount} errors and ${warningCount} warnings`,
  };
}

function lintBasicPatterns(code: string): LintIssue[] {
  const issues: LintIssue[] = [];

  // Check for magic numbers in styling
  const magicNumbers = code.matchAll(
    /(?:width|height|size):\s*(\d+)(?!px|rem|em|%)/g
  );
  for (const match of magicNumbers) {
    issues.push({
      severity: "warning",
      type: "spacing",
      message: `Magic number ${match[1]} found without unit`,
      code: match[0],
      suggestion: `Add a unit like ${match[1]}px or use a design token`,
    });
  }

  // Check for hardcoded colors in className strings
  const hardcodedTailwindColors = code.matchAll(
    /className=["'][^"']*(?:bg|text|border)-\[#[A-Fa-f0-9]+\][^"']*/g
  );
  for (const match of hardcodedTailwindColors) {
    issues.push({
      severity: "warning",
      type: "color",
      message: "Hardcoded color in Tailwind arbitrary value",
      code: match[0],
      suggestion: "Use a color from your Tailwind config or style guide",
    });
  }

  // Check for accessibility issues
  if (code.includes("<img") && !code.includes("alt=")) {
    issues.push({
      severity: "error",
      type: "accessibility",
      message: "Image without alt attribute",
      suggestion: 'Add alt="" for decorative images or descriptive alt text',
    });
  }

  if (
    code.includes("<button") &&
    !code.match(/<button[^>]*>.*\S.*<\/button>/s)
  ) {
    issues.push({
      severity: "warning",
      type: "accessibility",
      message: "Button may be missing accessible text",
      suggestion: "Ensure button has visible text or aria-label",
    });
  }

  // Check for inconsistent quote styles
  const singleQuotes = (code.match(/className='/g) || []).length;
  const doubleQuotes = (code.match(/className="/g) || []).length;
  if (singleQuotes > 0 && doubleQuotes > 0) {
    issues.push({
      severity: "info",
      type: "component",
      message: "Mixed quote styles in className attributes",
      suggestion: "Use consistent quote style throughout",
    });
  }

  return issues;
}

function lintAgainstStyleGuide(code: string, styleGuide: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const values = extractStyleValues(styleGuide);

  // Check colors
  const codeColors = code.matchAll(/#[A-Fa-f0-9]{6}\b/g);
  for (const match of codeColors) {
    const color = match[0].toUpperCase();
    if (!values.colors.includes(color)) {
      issues.push({
        severity: "warning",
        type: "color",
        message: `Color ${color} not in style guide`,
        code: match[0],
        suggestion: `Allowed colors: ${values.colors.slice(0, 5).join(", ")}${
          values.colors.length > 5 ? "..." : ""
        }`,
      });
    }
  }

  // Check for non-standard spacing (not on 4px grid)
  const spacingValues = code.matchAll(/(?:p|m|gap)-(\d+)/g);
  for (const match of spacingValues) {
    const value = parseInt(match[1]);
    // Tailwind uses 4px base (1 = 4px, 2 = 8px, etc.)
    // Non-standard would be values like 5, 7, 9, etc. in the 1-12 range
    if (value > 12 && value % 4 !== 0) {
      issues.push({
        severity: "info",
        type: "spacing",
        message: `Spacing value ${match[0]} might not align with design system`,
        suggestion:
          "Consider using standard Tailwind spacing values (1-12, 16, 20, 24...)",
      });
    }
  }

  return issues;
}

function extractColorsFromCode(code: string): string[] {
  const colors: string[] = [];

  // Match hex colors
  const hexMatches = code.matchAll(/#[A-Fa-f0-9]{6}\b/g);
  for (const match of hexMatches) {
    colors.push(match[0].toUpperCase());
  }

  // Match Tailwind color classes
  const tailwindMatches = code.matchAll(/(?:bg|text|border)-(\w+)-(\d+)/g);
  for (const match of tailwindMatches) {
    // Convert Tailwind colors to a normalized form
    colors.push(`tailwind:${match[1]}-${match[2]}`);
  }

  return [...new Set(colors)];
}

function extractClassTokensFromCode(code: string): string[] {
  const classStrings: string[] = [];

  // className="..."
  for (const m of code.matchAll(/\bclassName\s*=\s*["']([^"']+)["']/g)) {
    classStrings.push(m[1]);
  }
  // className={"..."} / className={'...'}
  for (const m of code.matchAll(
    /\bclassName\s*=\s*\{\s*["']([^"']+)["']\s*\}/g
  )) {
    classStrings.push(m[1]);
  }
  // class="..." (HTML snippets)
  for (const m of code.matchAll(/\bclass\s*=\s*["']([^"']+)["']/g)) {
    classStrings.push(m[1]);
  }

  // cn(...), clsx(...), classnames(...)
  for (const call of code.matchAll(
    /\b(?:cn|clsx|classnames)\s*\(([\s\S]*?)\)/g
  )) {
    const inner = call[1] || "";
    for (const s of inner.matchAll(/["']([^"']+)["']/g)) {
      classStrings.push(s[1]);
    }
  }

  const tokens: string[] = [];
  for (const s of classStrings) {
    s.split(/\s+/g)
      .filter(Boolean)
      .forEach((t) => tokens.push(t));
  }
  return tokens;
}

function normalizeUtilityBase(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  return t.startsWith("!") ? t.slice(1) : t;
}

// Bracket-aware variant stripping (sm:hover:bg-[color:var(--x)] -> bg-[color:var(--x)])
function stripVariants(token: string): string {
  let bracketDepth = 0;
  let lastSplit = -1;

  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === "[") bracketDepth++;
    if (ch === "]" && bracketDepth > 0) bracketDepth--;
    if (ch === ":" && bracketDepth === 0) lastSplit = i;
  }

  return lastSplit >= 0 ? token.slice(lastSplit + 1) : token;
}

const KNOWN_BARE_TW = new Set([
  "flex",
  "grid",
  "block",
  "inline",
  "inline-block",
  "hidden",
  "relative",
  "absolute",
  "fixed",
  "sticky",
  "container",
  "group",
  "peer",
  "truncate",
  "sr-only",
  "not-sr-only",
]);

function looksTailwindUtility(token: string): boolean {
  if (!token) return false;
  if (token.includes("[")) return true; // arbitrary values strongly suggest Tailwind
  if (KNOWN_BARE_TW.has(token)) return true;

  // Common Tailwind prefixes
  return (
    /^(bg|text|border|ring|outline|shadow|fill|stroke|from|to|via)-/.test(
      token
    ) ||
    /^(p[trblxy]?|m[trblxy]?|gap|space-[xy])-(.+)$/.test(token) ||
    /^rounded(?:-[trbl]{1,2})?-/.test(token) ||
    /^(w|h|min-w|min-h|max-w|max-h)-/.test(token) ||
    /^(items|justify|content|self|place|overflow|cursor|select|pointer-events)-/.test(
      token
    ) ||
    /^(font|leading|tracking)-/.test(token) ||
    /^(transition|duration|ease|animate)-/.test(token)
  );
}

const STANDARD_SPACING_KEYS = new Set([
  "0",
  "0.5",
  "1",
  "1.5",
  "2",
  "2.5",
  "3",
  "3.5",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "14",
  "16",
  "20",
  "24",
  "28",
  "32",
  "36",
  "40",
  "44",
  "48",
  "52",
  "56",
  "60",
  "64",
  "72",
  "80",
  "96",
]);

const STANDARD_RADIUS_KEYS = new Set([
  "none",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "full",
]);

const STANDARD_TEXT_SIZE_KEYS = new Set([
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
]);

const FONT_WEIGHT_KEYS = new Set([
  "thin",
  "extralight",
  "light",
  "normal",
  "medium",
  "semibold",
  "bold",
  "extrabold",
  "black",
]);

function isAllowedByThemeTokens(
  token: string,
  allow: ReturnType<typeof extractTailwindAllowlist>
): boolean {
  // Color utilities (bg/text/border) – allow if colors are allowed.
  const colorMatch = token.match(/^(bg|text|border)-([a-zA-Z]+)-(\d{2,3})$/);
  if (colorMatch) {
    if (allow.allowAnyColor) return true;
    const tw = `tailwind:${colorMatch[2].toLowerCase()}-${colorMatch[3]}`;
    return allow.allowedTailwindColors.has(tw);
  }

  // Spacing utilities: p-4, px-2.5, gap-6, space-x-4
  const spacingMatch = token.match(
    /^(p[trblxy]?|m[trblxy]?|gap|space-[xy])-(.+)$/
  );
  if (spacingMatch) {
    const key = spacingMatch[2];
    if (key.includes("[")) return false; // arbitrary spacing
    if (allow.allowedSpacingKeys.has(key)) return true;
    if (allow.allowStandardSpacing && STANDARD_SPACING_KEYS.has(key))
      return true;
    return false;
  }

  // Border radius: rounded-md, rounded-t-lg
  const roundedMatch = token.match(/^rounded(?:-[trbl]{1,2})?-(.+)$/);
  if (roundedMatch) {
    const key = roundedMatch[1];
    if (key.includes("[")) return false;
    if (allow.allowedBorderRadiusKeys.has(key)) return true;
    if (
      allow.allowedBorderRadiusKeys.size === 0 &&
      STANDARD_RADIUS_KEYS.has(key)
    )
      return true;
    return false;
  }

  // Font sizes: text-sm (but avoid text-color which has 3-part form handled above)
  const textSizeMatch = token.match(/^text-([a-zA-Z0-9]+)$/);
  if (textSizeMatch) {
    const key = textSizeMatch[1];
    if (allow.allowedFontSizeKeys.has(key)) return true;
    if (
      allow.allowedFontSizeKeys.size === 0 &&
      STANDARD_TEXT_SIZE_KEYS.has(key)
    )
      return true;
    return false;
  }

  // Font family: font-sans / font-mono (avoid font weights)
  const fontMatch = token.match(/^font-([a-zA-Z0-9-]+)$/);
  if (fontMatch) {
    const key = fontMatch[1];
    if (FONT_WEIGHT_KEYS.has(key)) return false;
    if (allow.allowedFontFamilyKeys.has(key)) return true;
    // If no font families specified, don't try to validate here.
    return allow.allowedFontFamilyKeys.size === 0;
  }

  return false;
}

function findSimilarColor(
  color: string,
  allowedColors: string[]
): string | null {
  // Simple hex color distance check
  const colorRgb = hexToRgb(color);
  if (!colorRgb) return null;

  let closest: string | null = null;
  let closestDistance = Infinity;

  for (const allowed of allowedColors) {
    const allowedRgb = hexToRgb(allowed);
    if (!allowedRgb) continue;

    const distance = Math.sqrt(
      Math.pow(colorRgb.r - allowedRgb.r, 2) +
        Math.pow(colorRgb.g - allowedRgb.g, 2) +
        Math.pow(colorRgb.b - allowedRgb.b, 2)
    );

    if (distance < closestDistance && distance < 50) {
      closestDistance = distance;
      closest = allowed;
    }
  }

  return closest;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return null;

  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}
