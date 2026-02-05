/**
 * Discovers available semantic colors from project config files.
 *
 * Scans:
 * - CSS files (globals.css, index.css) for @theme blocks with --color-* variables
 * - Tailwind config files for theme.extend.colors
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { dirname, join } from "path";

/**
 * Common CSS file names that typically contain theme definitions
 */
const CSS_FILE_PATTERNS = [
  "globals.css",
  "global.css",
  "index.css",
  "app.css",
  "styles.css",
  "theme.css",
];

/**
 * Common directories where CSS files might live
 */
const CSS_DIRECTORIES = [
  "src/styles",
  "src/css",
  "src",
  "styles",
  "css",
  "app",
  "src/app",
];

/**
 * Tailwind config file patterns
 */
const TAILWIND_CONFIG_PATTERNS = [
  "tailwind.config.ts",
  "tailwind.config.js",
  "tailwind.config.mjs",
  "tailwind.config.cjs",
];

export interface SemanticColorDiscoveryResult {
  colors: string[];
  configHash: string;
  sources: string[];
}

/**
 * Simple hash function for cache invalidation
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Find project root by looking for package.json
 */
export function findProjectRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

/**
 * Find CSS files that might contain theme definitions
 */
function findCssFiles(projectRoot: string): string[] {
  const found: string[] = [];

  for (const dir of CSS_DIRECTORIES) {
    const fullDir = join(projectRoot, dir);
    if (!existsSync(fullDir)) continue;

    try {
      const stat = statSync(fullDir);
      if (!stat.isDirectory()) continue;

      const files = readdirSync(fullDir);
      for (const file of files) {
        if (CSS_FILE_PATTERNS.includes(file.toLowerCase())) {
          found.push(join(fullDir, file));
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  // Also check root-level CSS files
  for (const pattern of CSS_FILE_PATTERNS) {
    const rootFile = join(projectRoot, pattern);
    if (existsSync(rootFile) && !found.includes(rootFile)) {
      found.push(rootFile);
    }
  }

  return found;
}

/**
 * Find tailwind config file
 */
function findTailwindConfig(projectRoot: string): string | null {
  for (const pattern of TAILWIND_CONFIG_PATTERNS) {
    const configPath = join(projectRoot, pattern);
    if (existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

/**
 * Parse CSS file for @theme blocks with --color-* variables
 *
 * Looks for patterns like:
 * @theme inline {
 *   --color-primary: var(--some-value);
 *   --color-destructive: ...;
 * }
 *
 * Also looks for CSS custom properties in :root
 */
function parseSemanticColorsFromCss(cssContent: string): string[] {
  const colors = new Set<string>();

  // Match --color-* in @theme blocks
  // Pattern: --color-NAME (captures NAME)
  const themeColorRegex = /--color-([a-zA-Z][a-zA-Z0-9-]*)/g;
  let match;
  while ((match = themeColorRegex.exec(cssContent)) !== null) {
    colors.add(match[1]);
  }

  return Array.from(colors);
}

/**
 * Parse tailwind config for extended colors
 *
 * This is a simplified parser that looks for color names in the config.
 * It handles common patterns but may miss complex dynamic configurations.
 */
function parseSemanticColorsFromTailwindConfig(
  configContent: string
): string[] {
  const colors = new Set<string>();

  // Look for color definitions in theme.extend.colors or theme.colors
  // Pattern matches: colorName: "value" or 'colorName': ... or colorName: {
  const colorKeyRegex =
    /(?:colors|backgroundColor|textColor|borderColor)\s*:\s*\{([^}]+)\}/gs;
  const keyMatch = colorKeyRegex.exec(configContent);

  if (keyMatch) {
    const colorsBlock = keyMatch[1];
    // Extract color names (keys before : in the object)
    const keyRegex = /['"]?([a-zA-Z][a-zA-Z0-9-]*)['"]?\s*:/g;
    let match;
    while ((match = keyRegex.exec(colorsBlock)) !== null) {
      const colorName = match[1];
      // Skip common non-semantic patterns
      if (
        !colorName.match(
          /^(DEFAULT|50|100|200|300|400|500|600|700|800|900|950)$/
        )
      ) {
        colors.add(colorName);
      }
    }
  }

  return Array.from(colors);
}

/**
 * Discover semantic colors available in the project
 */
export function discoverSemanticColors(
  startDir: string
): SemanticColorDiscoveryResult {
  const projectRoot = findProjectRoot(startDir);
  const allColors = new Set<string>();
  const sources: string[] = [];
  let combinedContent = "";

  // Find and parse CSS files
  const cssFiles = findCssFiles(projectRoot);
  for (const cssFile of cssFiles) {
    try {
      const content = readFileSync(cssFile, "utf-8");
      combinedContent += content;
      const colors = parseSemanticColorsFromCss(content);
      if (colors.length > 0) {
        sources.push(cssFile);
        colors.forEach((c) => allColors.add(c));
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Find and parse tailwind config
  const tailwindConfig = findTailwindConfig(projectRoot);
  if (tailwindConfig) {
    try {
      const content = readFileSync(tailwindConfig, "utf-8");
      combinedContent += content;
      const colors = parseSemanticColorsFromTailwindConfig(content);
      if (colors.length > 0) {
        sources.push(tailwindConfig);
        colors.forEach((c) => allColors.add(c));
      }
    } catch {
      // Skip unreadable config
    }
  }

  // Add common shadcn/ui semantic colors as fallback
  const commonSemanticColors = [
    "background",
    "foreground",
    "primary",
    "primary-foreground",
    "secondary",
    "secondary-foreground",
    "muted",
    "muted-foreground",
    "accent",
    "accent-foreground",
    "destructive",
    "destructive-foreground",
    "card",
    "card-foreground",
    "popover",
    "popover-foreground",
    "border",
    "input",
    "ring",
  ];

  // If no colors found, use common semantic colors
  if (allColors.size === 0) {
    commonSemanticColors.forEach((c) => allColors.add(c));
  }

  return {
    colors: Array.from(allColors).sort(),
    configHash: simpleHash(combinedContent || "default"),
    sources,
  };
}
