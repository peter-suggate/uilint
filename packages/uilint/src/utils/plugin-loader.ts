/**
 * Dynamic plugin loader for the CLI.
 *
 * Probes known plugin package names for a `cli-manifest` subpath export.
 * Each manifest describes the CLI flag, help text, and registration entry
 * point, keeping the core CLI free of plugin-specific knowledge.
 *
 * The list of known plugins comes from `uilint-core/KNOWN_PLUGINS` —
 * a single source of truth shared by the CLI, React loader, and plugins.
 */

import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
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
  /** Display name shown in the interactive install UI, e.g. "Vision Analysis" */
  displayName: string;
  /** Description shown in the interactive install UI */
  displayDescription: string;
  /** Emoji icon for the interactive install UI, e.g. "👁️" */
  displayIcon: string;
}

/**
 * Resolve and import a package subpath specifier from a given project directory.
 *
 * First tries CJS `createRequire().resolve()`, which works for packages with
 * a `"require"` export condition. If that fails (e.g. the package only defines
 * `"import"`), falls back to manually reading the package's `exports` map and
 * constructing a file URL.
 */
async function importFromProject(
  specifier: string,
  projectPath: string,
): Promise<unknown> {
  // Try CJS resolution first (fast path)
  try {
    const req = createRequire(join(projectPath, "package.json"));
    const resolved = req.resolve(specifier);
    return await import(resolved);
  } catch {
    // CJS resolution failed — try ESM-only export resolution
  }

  // Parse "pkg/subpath" → ["pkg", "./subpath"]
  const slashIdx = specifier.indexOf("/");
  if (slashIdx === -1) return undefined;
  const pkgName = specifier.slice(0, slashIdx);
  const subpath = `./${specifier.slice(slashIdx + 1)}`;

  const pkgDir = join(projectPath, "node_modules", pkgName);
  const pkgJsonPath = join(pkgDir, "package.json");
  if (!existsSync(pkgJsonPath)) return undefined;

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  const exportEntry = pkgJson.exports?.[subpath];
  if (!exportEntry) return undefined;

  const importPath =
    typeof exportEntry === "string"
      ? exportEntry
      : exportEntry.import ?? exportEntry.default;
  if (!importPath) return undefined;

  const fullPath = join(pkgDir, importPath);
  if (!existsSync(fullPath)) return undefined;

  return await import(pathToFileURL(fullPath).href);
}

/**
 * Discover available plugin manifests by probing `<pkg>/cli-manifest`.
 *
 * Uses `KNOWN_PLUGINS` from uilint-core as the single source of truth
 * for which packages to probe.
 *
 * @param resolveFrom - Optional project path to resolve plugins from.
 *   When provided, resolves plugins from the project's node_modules
 *   so plugins installed in the project can be found.
 * @returns Array of discovered plugin manifests
 */
export async function discoverPlugins(
  resolveFrom?: string,
): Promise<PluginCLIManifest[]> {
  // Dynamic import — avoids a static named-export binding on uilint-core which
  // tsup auto-externalizes.  Gracefully degrades if the installed uilint-core
  // version doesn't yet export KNOWN_PLUGINS (e.g. preview deploys).
  const core = await import("uilint-core");
  const KNOWN_PLUGINS: ReadonlyArray<{ packageName: string; manifestSpecifier: string }> =
    core.KNOWN_PLUGINS ?? [];

  const manifests: PluginCLIManifest[] = [];

  for (const known of KNOWN_PLUGINS) {
    try {
      let mod: { cliManifest?: PluginCLIManifest } | undefined;
      if (resolveFrom) {
        mod = (await importFromProject(known.manifestSpecifier, resolveFrom)) as typeof mod;
      } else {
        mod = (await import(known.manifestSpecifier)) as typeof mod;
      }
      if (mod?.cliManifest) {
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
 * The register modules call `registerRuleMeta()` from `uilint-eslint`, which
 * mutates the shared `ruleRegistry` array.  To avoid the dual-package problem
 * (project-resolved plugin getting a different `uilint-eslint` instance), we
 * always try a bare `import()` first — this resolves from the CLI's own
 * context so both the CLI and the plugin share the same `ruleRegistry`.
 * Only falls back to project-scoped resolution when the bare import fails
 * (e.g. when running via `npx` where plugins aren't alongside the CLI).
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
      // Prefer bare import so the register module shares the CLI's uilint-eslint
      await import(manifest.registerSpecifier);
      loaded.push(manifest.packageName);
    } catch {
      // Bare import failed — try from consumer project if a path was provided
      if (resolveFrom) {
        try {
          await importFromProject(manifest.registerSpecifier, resolveFrom);
          loaded.push(manifest.packageName);
        } catch {
          // Plugin register module not available — skip silently
        }
      }
    }
  }

  if (loaded.length > 0) {
    logInfo(`Loaded plugin rules: ${loaded.join(", ")}`);
  }

  return loaded;
}
