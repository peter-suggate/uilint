/**
 * Known Plugin Packages
 *
 * Single source of truth for all known uilint plugin package specifiers.
 * Both the CLI and UI loader import this list instead of maintaining
 * their own hardcoded lists.
 *
 * When adding a new plugin, add an entry here and the CLI + UI will
 * automatically discover it.
 */

export interface KnownPlugin {
  /** npm package name, e.g. "uilint-vision" */
  packageName: string;
  /** Subpath export for the CLI manifest, e.g. "uilint-vision/cli-manifest" */
  manifestSpecifier: string;
  /** Subpath export for the plugin definition, e.g. "uilint-vision/plugin" */
  pluginSpecifier: string;
}

/**
 * All known uilint plugin packages.
 *
 * This is the ONE place to update when adding a new plugin.
 * The CLI reads `manifestSpecifier` to discover CLI flags and ESLint rules.
 * The UI reads `pluginSpecifier` to auto-discover and load plugins.
 */
export const KNOWN_PLUGINS: readonly KnownPlugin[] = [
  {
    packageName: "uilint-vision",
    manifestSpecifier: "uilint-vision/cli-manifest",
    pluginSpecifier: "uilint-vision/plugin",
  },
  {
    packageName: "uilint-semantic",
    manifestSpecifier: "uilint-semantic/cli-manifest",
    pluginSpecifier: "uilint-semantic/plugin",
  },
  {
    packageName: "uilint-duplicates",
    manifestSpecifier: "uilint-duplicates/cli-manifest",
    pluginSpecifier: "uilint-duplicates/plugin",
  },
  {
    packageName: "uilint-coverage",
    manifestSpecifier: "uilint-coverage/cli-manifest",
    pluginSpecifier: "uilint-coverage/plugin",
  },
] as const;
