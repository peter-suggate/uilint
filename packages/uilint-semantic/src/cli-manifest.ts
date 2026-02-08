/**
 * CLI manifest for the uilint-semantic plugin (styleguide checking).
 *
 * Describes the CLI flag, help text, and registration entry point so the
 * core CLI can discover and wire up this plugin without hardcoded knowledge.
 */
export const cliManifest = {
  packageName: "uilint-semantic",
  cliFlag: "semantic",
  cliDescription: "Install styleguide checking rules (non-interactive)",
  registerSpecifier: "uilint-semantic/eslint-rules/register",
} as const;
