/**
 * Dynamic plugin loader for the CLI.
 *
 * Probes known plugin package names for a `cli-manifest` subpath export.
 * Each manifest describes the CLI flag, help text, and registration entry
 * point, keeping the core CLI free of plugin-specific knowledge.
 */

import { createRequire } from "module";
import { join } from "path";
import { logInfo } from "./prompts.js";

/**
 * Metadata a plugin exposes via its `<pkg>/cli-manifest` subpath export.
 * Plugins define a plain object matching this shape — no shared type import needed.
 */
export interface PluginCLIManifest {
  /** npm package name, e.g. "uilint-vision" */
  packageName: string;
  /** CLI flag name (without --), e.g. "vision" */
  cliFlag: string;
  /** Description shown in --help */
  cliDescription: string;
  /** Import specifier for the register module, e.g. "uilint-vision/eslint-rules/register" */
  registerSpecifier: string;
}

/** Package names to probe for CLI manifests */
const KNOWN_PLUGIN_PACKAGES = ["uilint-vision", "uilint-semantic"];

/**
 * Discover available plugin manifests by probing `<pkg>/cli-manifest`.
 *
 * @param resolveFrom - Optional project path to resolve plugins from.
 *   When provided, uses createRequire anchored to the project's package.json
 *   so plugins installed in the project's node_modules can be found.
 * @returns Array of discovered plugin manifests
 */
export async function discoverPlugins(
  resolveFrom?: string,
): Promise<PluginCLIManifest[]> {
  const manifests: PluginCLIManifest[] = [];

  for (const pkg of KNOWN_PLUGIN_PACKAGES) {
    const specifier = `${pkg}/cli-manifest`;
    try {
      let mod: { cliManifest?: PluginCLIManifest };
      if (resolveFrom) {
        const req = createRequire(join(resolveFrom, "package.json"));
        const resolved = req.resolve(specifier);
        mod = (await import(resolved)) as typeof mod;
      } else {
        mod = (await import(specifier)) as typeof mod;
      }
      if (mod.cliManifest) {
        manifests.push(mod.cliManifest);
      }
    } catch {
      // Plugin not installed — skip silently
    }
  }

  return manifests;
}

/**
 * Load ESLint rules from discovered plugins by importing their register modules.
 *
 * @param manifests - Plugin manifests (from discoverPlugins)
 * @param resolveFrom - Optional project path to resolve plugins from.
 * @returns Array of loaded plugin package names
 */
export async function loadPluginESLintRules(
  manifests: PluginCLIManifest[],
  resolveFrom?: string,
): Promise<string[]> {
  const loaded: string[] = [];

  for (const manifest of manifests) {
    try {
      if (resolveFrom) {
        const req = createRequire(join(resolveFrom, "package.json"));
        const resolved = req.resolve(manifest.registerSpecifier);
        await import(resolved);
      } else {
        await import(manifest.registerSpecifier);
      }
      loaded.push(manifest.packageName);
    } catch {
      // Plugin register module not available — skip silently
    }
  }

  if (loaded.length > 0) {
    logInfo(`Loaded plugin rules: ${loaded.join(", ")}`);
  }

  return loaded;
}
