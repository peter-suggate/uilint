/**
 * Code validation against style guide
 */

import type {
  ValidationResult,
  ValidationIssue,
  LintResult,
  LintIssue,
} from "../types.js";
import { extractStyleValues } from "../styleguide/parser.js";

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

  // Check for color violations
  const codeColors = extractColorsFromCode(code);
  for (const color of codeColors) {
    if (!styleValues.colors.includes(color.toUpperCase())) {
      // Check if it's similar to an allowed color
      const similar = findSimilarColor(color, styleValues.colors);
      issues.push({
        type: "warning",
        message: `Color ${color} is not in the style guide`,
        suggestion: similar
          ? `Consider using ${similar} instead`
          : `Add ${color} to the style guide if intentional`,
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
