/**
 * CLI manifest for the uilint-duplicates plugin.
 *
 * Describes the CLI flag, help text, and registration entry point so the
 * core CLI can discover and wire up this plugin without hardcoded knowledge.
 */
export const cliManifest = {
  packageName: "uilint-duplicates",
  cliFlag: "duplicates",
  cliDescription: "Install duplicate detection rules (non-interactive)",
  registerSpecifier: "uilint-duplicates/eslint-rules/register",
  displayName: "Duplicate Detection",
  displayDescription: "Detect and flag duplicate UI components and patterns",
  displayIcon: "🔄",
} as const;
