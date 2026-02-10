/**
 * CLI manifest for the uilint-coverage plugin.
 */
export const cliManifest = {
  packageName: "uilint-coverage",
  cliFlag: "coverage",
  cliDescription: "Install test coverage rules (non-interactive)",
  registerSpecifier: "uilint-coverage/eslint-rules/register",
  displayName: "Test Coverage",
  displayDescription: "Enforce test coverage thresholds for source files",
  displayIcon: "🧪",
} as const;
