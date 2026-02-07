/**
 * Dynamic plugin loader for the CLI.
 *
 * Attempts to import known plugin packages that provide ESLint rules.
 * Each plugin has a `/eslint-rules/register` subpath export that
 * auto-registers its rules with uilint-eslint's registries on import.
 *
 * This keeps uilint-eslint free of any plugin-specific knowledge.
 */

import { logInfo } from "./prompts.js";

/** Known plugin packages that may provide ESLint rules */
const KNOWN_PLUGINS = [
  { name: "uilint-vision", specifier: "uilint-vision/eslint-rules/register" },
  { name: "uilint-semantic", specifier: "uilint-semantic/eslint-rules/register" },
];

/**
 * Dynamically load plugin packages that provide ESLint rules.
 *
 * @returns Array of loaded plugin names
 */
export async function loadPluginESLintRules(): Promise<string[]> {
  const loaded: string[] = [];

  for (const { name, specifier } of KNOWN_PLUGINS) {
    try {
      await import(specifier);
      loaded.push(name);
    } catch {
      // Plugin not installed — skip silently
    }
  }

  if (loaded.length > 0) {
    logInfo(`Loaded plugin rules: ${loaded.join(", ")}`);
  }

  return loaded;
}
