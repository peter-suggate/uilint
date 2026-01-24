/**
 * Test helpers for the install command
 *
 * These helpers provide backward compatibility with existing tests
 * by bridging between the old Prompter-based API and the new installer system.
 */

import type { RuleMetadata } from "uilint-eslint";
import type {
  InstallItem,
  NextAppInfo,
  ViteAppInfo,
  EslintPackageInfo,
  UserChoices,
  NextChoices,
  ViteChoices,
  EslintChoices,
  InstallOptions,
  ProjectState,
} from "./types.js";

// ============================================================================
// Prompter Interface (for backward compatibility with tests)
// ============================================================================

export interface Prompter {
  selectInstallItems(): Promise<InstallItem[]>;
  selectNextApp(apps: NextAppInfo[]): Promise<NextAppInfo>;
  selectViteApp(apps: ViteAppInfo[]): Promise<ViteAppInfo>;
  selectEslintPackages(packages: EslintPackageInfo[]): Promise<string[]>;
  selectEslintRules(): Promise<RuleMetadata[]>;
  selectEslintRuleSeverity(): Promise<"warn" | "error" | "defaults">;
  confirmCustomizeRuleOptions(): Promise<boolean>;
  configureRuleOptions(
    rule: RuleMetadata
  ): Promise<Record<string, unknown> | undefined>;
}

// ============================================================================
// Choice Gathering Logic (for backward compatibility with tests)
// ============================================================================

/**
 * Gather all user choices using the prompter or CLI flags
 *
 * This function provides backward compatibility with existing tests.
 */
export async function gatherChoices(
  state: ProjectState,
  options: InstallOptions,
  prompter: Prompter
): Promise<UserChoices> {
  // Determine items from flags or prompts
  let items: InstallItem[];

  const hasExplicitFlags =
    options.genstyleguide !== undefined ||
    options.skill !== undefined ||
    options.routes !== undefined ||
    options.react !== undefined;

  if (hasExplicitFlags || options.eslint) {
    items = [];
    if (options.genstyleguide) items.push("genstyleguide");
    if (options.skill) items.push("skill");
    if (options.routes || options.react) items.push("next");
    if (options.eslint) items.push("eslint");
  } else {
    items = await prompter.selectInstallItems();
  }

  // Next.js app selection
  let nextChoices: NextChoices | undefined;
  if (items.includes("next")) {
    if (state.nextApps.length === 0) {
      throw new Error(
        "Could not find a Next.js App Router app root (expected app/ or src/app/). Run this from your Next.js project root."
      );
    } else if (state.nextApps.length === 1) {
      nextChoices = {
        projectPath: state.nextApps[0].projectPath,
        detection: state.nextApps[0].detection,
      };
    } else {
      const selected = await prompter.selectNextApp(state.nextApps);
      nextChoices = {
        projectPath: selected.projectPath,
        detection: selected.detection,
      };
    }
  }

  // Vite app selection
  let viteChoices: ViteChoices | undefined;
  if (items.includes("vite")) {
    if (state.viteApps.length === 0) {
      throw new Error(
        "Could not find a Vite + React project (expected vite.config.* + react deps). Run this from your Vite project root."
      );
    } else if (state.viteApps.length === 1) {
      viteChoices = {
        projectPath: state.viteApps[0].projectPath,
        detection: state.viteApps[0].detection,
      };
    } else {
      const selected = await prompter.selectViteApp(state.viteApps);
      viteChoices = {
        projectPath: selected.projectPath,
        detection: selected.detection,
      };
    }
  }

  // ESLint choices
  let eslintChoices: EslintChoices | undefined;
  if (items.includes("eslint")) {
    // Filter to packages with ESLint config
    const packagesWithEslint = state.packages.filter(
      (p) => p.eslintConfigPath !== null
    );

    if (packagesWithEslint.length === 0) {
      throw new Error(
        "No packages with eslint.config.{ts,mjs,js,cjs} found. Create an ESLint config first."
      );
    }

    const packagePaths = await prompter.selectEslintPackages(
      packagesWithEslint
    );

    if (packagePaths.length > 0) {
      let selectedRules = await prompter.selectEslintRules();

      // Apply a global severity choice (default: warn)
      const severity = await prompter.selectEslintRuleSeverity();
      if (severity !== "defaults") {
        selectedRules = selectedRules.map((rule) => ({
          ...rule,
          defaultSeverity: severity,
        }));
      }

      // Ask if user wants to customize individual rule options
      const hasConfigurableRules = selectedRules.some(
        (r) => r.optionSchema && r.optionSchema.fields.length > 0
      );

      if (hasConfigurableRules) {
        const customizeOptions = await prompter.confirmCustomizeRuleOptions();

        if (customizeOptions) {
          selectedRules = await configureRuleOptions(selectedRules, prompter);
        }
      }

      eslintChoices = { packagePaths, selectedRules };
    }
  }

  return {
    items,
    next: nextChoices,
    vite: viteChoices,
    eslint: eslintChoices,
  };
}

/**
 * Configure options for individual rules based on their schemas
 */
async function configureRuleOptions(
  rules: RuleMetadata[],
  prompter: Prompter
): Promise<RuleMetadata[]> {
  const configured: RuleMetadata[] = [];

  for (const rule of rules) {
    if (rule.optionSchema && rule.optionSchema.fields.length > 0) {
      const options = await prompter.configureRuleOptions(rule);
      if (options) {
        // Merge with existing defaultOptions structure
        const existingOptions =
          rule.defaultOptions && rule.defaultOptions.length > 0
            ? (rule.defaultOptions[0] as Record<string, unknown>)
            : ({} as Record<string, unknown>);
        configured.push({
          ...rule,
          defaultOptions: [{ ...existingOptions, ...options }],
        });
      } else {
        configured.push(rule);
      }
    } else {
      // No configuration needed for this rule
      configured.push(rule);
    }
  }

  return configured;
}
