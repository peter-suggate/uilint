/**
 * CLI manifest for the uilint-vision plugin.
 *
 * This is the single source of truth for CLI-specific metadata.
 * The plugin definition imports and embeds this via its `cli` field,
 * so there is no duplication between the CLI manifest and plugin definition.
 *
 * Display metadata (displayName, displayDescription, displayIcon) is
 * kept here for backward compatibility with the CLI loader, but the
 * canonical name/description lives on the plugin definition itself.
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
