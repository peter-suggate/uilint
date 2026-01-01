/**
 * Tailwind config reader (Node-only).
 *
 * Goals:
 * - Locate a Tailwind config file near a project directory.
 * - Load it (supports .ts via jiti).
 * - Produce compact token sets for styleguide + validation.
 *
 * Note: We intentionally extract tokens primarily from user-defined theme / extend
 * to avoid dumping Tailwind's full default palette into the style guide.
 */

import { existsSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import jiti from "jiti";
import type { TailwindThemeTokens } from "../types.js";

const CONFIG_CANDIDATES = [
  "tailwind.config.ts",
  "tailwind.config.mts",
  "tailwind.config.cts",
  "tailwind.config.js",
  "tailwind.config.mjs",
  "tailwind.config.cjs",
];

export function findTailwindConfigPath(startDir: string): string | null {
  let dir = startDir;
  for (;;) {
    for (const name of CONFIG_CANDIDATES) {
      const full = join(dir, name);
      if (existsSync(full)) return full;
    }

    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function readTailwindThemeTokens(projectDir: string): TailwindThemeTokens | null {
  const configPath = findTailwindConfigPath(projectDir);
  if (!configPath) return null;

  const loader = jiti(import.meta.url, { interopDefault: true });
  const loaded = loader(configPath) as any;
  const config = (loaded?.default ?? loaded) as any;
  if (!config || typeof config !== "object") return null;

  // Best-effort: run resolveConfig to ensure config is valid/normalized.
  // We don’t use the resolved theme for token enumeration (to avoid defaults),
  // but we do want to surface loader/shape problems early for debugging.
  try {
    const require = createRequire(import.meta.url);
    const maybe = require("tailwindcss/resolveConfig");
    const resolveConfig = (maybe?.default ?? maybe) as ((cfg: any) => any) | undefined;
    if (typeof resolveConfig === "function") resolveConfig(config);
  } catch {
    // If resolve fails, still attempt to extract from raw object.
  }

  const theme = (config.theme && typeof config.theme === "object") ? config.theme : {};
  const extend =
    theme.extend && typeof theme.extend === "object" ? theme.extend : {};

  const colors = new Set<string>();
  const spacingKeys = new Set<string>();
  const borderRadiusKeys = new Set<string>();
  const fontFamilyKeys = new Set<string>();
  const fontSizeKeys = new Set<string>();

  // Merge base + extend per category.
  addColorTokens(colors, theme.colors);
  addColorTokens(colors, extend.colors);

  addKeys(spacingKeys, theme.spacing);
  addKeys(spacingKeys, extend.spacing);

  addKeys(borderRadiusKeys, theme.borderRadius);
  addKeys(borderRadiusKeys, extend.borderRadius);

  addKeys(fontFamilyKeys, theme.fontFamily);
  addKeys(fontFamilyKeys, extend.fontFamily);

  addKeys(fontSizeKeys, theme.fontSize);
  addKeys(fontSizeKeys, extend.fontSize);

  // If user config didn’t specify tokens, we still return an object to signal
  // "tailwind detected", but with empty sets (downstream can choose defaults).
  return {
    configPath,
    colors: [...colors],
    spacingKeys: [...spacingKeys],
    borderRadiusKeys: [...borderRadiusKeys],
    fontFamilyKeys: [...fontFamilyKeys],
    fontSizeKeys: [...fontSizeKeys],
  };
}

function addKeys(out: Set<string>, obj: unknown): void {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (!key) continue;
    out.add(key);
  }
}

function addColorTokens(out: Set<string>, colors: unknown): void {
  if (!colors || typeof colors !== "object") return;

  for (const [name, value] of Object.entries(colors as Record<string, unknown>)) {
    if (!name) continue;

    if (typeof value === "string") {
      out.add(`tailwind:${name}`);
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const shade of Object.keys(value as Record<string, unknown>)) {
        if (!shade) continue;
        out.add(`tailwind:${name}-${shade}`);
      }
      continue;
    }

    // Arrays / functions etc are ignored for token enumeration.
  }
}
