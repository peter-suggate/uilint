/**
 * CLI manifest for the uilint-vision plugin.
 *
 * Describes the CLI flag, help text, and registration entry point so the
 * core CLI can discover and wire up this plugin without hardcoded knowledge.
 */
export const cliManifest = {
  packageName: "uilint-vision",
  cliFlag: "vision",
  cliDescription: "Install vision analysis rules (non-interactive)",
  registerSpecifier: "uilint-vision/eslint-rules/register",
  displayName: "Vision Analysis",
  displayDescription: "AI-powered visual consistency analysis using screenshots",
  displayIcon: "👁️",
} as const;
