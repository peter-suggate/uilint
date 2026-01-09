/**
 * Prompter interface and CLI implementation
 *
 * The Prompter interface abstracts all interactive prompts, allowing
 * tests to provide canned responses instead of real user input.
 */

import type { RuleMetadata } from "uilint-eslint";
import { ruleRegistry } from "uilint-eslint";
import { confirm, select, multiselect, pc } from "../../utils/prompts.js";
import { formatPackageOption } from "../../utils/package-detect.js";
import type {
  InstallItem,
  NextAppInfo,
  EslintPackageInfo,
  UserChoices,
  EslintChoices,
  NextChoices,
  ProjectState,
  InstallOptions,
} from "./types.js";

// ============================================================================
// Prompter Interface
// ============================================================================

export interface Prompter {
  /**
   * Select which items to install
   */
  selectInstallItems(): Promise<InstallItem[]>;

  /**
   * Confirm whether to merge with existing MCP config
   */
  confirmMcpMerge(): Promise<boolean>;

  /**
   * Confirm whether to merge with existing hooks config
   */
  confirmHooksMerge(): Promise<boolean>;

  /**
   * Select which Next.js app to install into (when multiple found)
   */
  selectNextApp(apps: NextAppInfo[]): Promise<NextAppInfo>;

  /**
   * Select which packages to install ESLint plugin into
   */
  selectEslintPackages(packages: EslintPackageInfo[]): Promise<string[]>;

  /**
   * Select which ESLint rules to enable
   */
  selectEslintRules(): Promise<RuleMetadata[]>;

  /**
   * Ask whether to set a preferred component library
   */
  confirmSetPreferredLibrary(): Promise<boolean>;

  /**
   * Select preferred component library
   */
  selectPreferredLibrary(): Promise<"shadcn" | "mui">;
}

// ============================================================================
// CLI Prompter Implementation (uses @clack/prompts)
// ============================================================================

export const cliPrompter: Prompter = {
  async selectInstallItems(): Promise<InstallItem[]> {
    return multiselect<InstallItem>({
      message: "What would you like to install?",
      options: [
        {
          value: "eslint",
          label: "ESLint plugin",
          hint: "Installs uilint-eslint and configures eslint.config.js",
        },
        {
          value: "next",
          label: "UI overlay",
          hint: "Installs routes + UILintProvider (Alt+Click to inspect)",
        },
        {
          value: "genstyleguide",
          label: "/genstyleguide command",
          hint: "Adds .cursor/commands/genstyleguide.md",
        },
        {
          value: "mcp",
          label: "MCP Server",
          hint: "Recommended - works with any MCP-compatible agent",
        },
        {
          value: "hooks",
          label: "Cursor Hooks",
          hint: "Auto-validates UI files when the agent stops",
        },
        {
          value: "genrules",
          label: "/genrules command",
          hint: "Adds .cursor/commands/genrules.md for ESLint rule generation",
        },
      ],
      required: true,
      initialValues: ["eslint", "next", "genstyleguide"],
    });
  },

  async confirmMcpMerge(): Promise<boolean> {
    return confirm({
      message: `${pc.dim(
        ".cursor/mcp.json"
      )} already exists. Merge UILint config?`,
      initialValue: true,
    });
  },

  async confirmHooksMerge(): Promise<boolean> {
    return confirm({
      message: `${pc.dim(
        ".cursor/hooks.json"
      )} already exists. Merge UILint hooks?`,
      initialValue: true,
    });
  },

  async selectNextApp(apps: NextAppInfo[]): Promise<NextAppInfo> {
    const chosen = await select<string>({
      message: "Which Next.js App Router project should UILint install into?",
      options: apps.map((app) => ({
        value: app.projectPath,
        label: app.projectPath,
      })),
      initialValue: apps[0].projectPath,
    });

    return apps.find((a) => a.projectPath === chosen) || apps[0];
  },

  async selectEslintPackages(packages: EslintPackageInfo[]): Promise<string[]> {
    if (packages.length === 1) {
      const confirmed = await confirm({
        message: `Install ESLint plugin in ${pc.cyan(
          packages[0].displayPath
        )}?`,
        initialValue: true,
      });
      return confirmed ? [packages[0].path] : [];
    }

    // Pre-select frontend packages
    const initialValues = packages
      .filter((p) => p.isFrontend)
      .map((p) => p.path);

    return multiselect<string>({
      message: "Which packages should have ESLint plugin installed?",
      options: packages.map(formatPackageOption),
      required: false,
      initialValues:
        initialValues.length > 0 ? initialValues : [packages[0].path],
    });
  },

  async selectEslintRules(): Promise<RuleMetadata[]> {
    const selectedRuleIds = await multiselect<string>({
      message: "Which rules would you like to enable?",
      options: ruleRegistry.map((rule: RuleMetadata) => ({
        value: rule.id,
        label: rule.name,
        hint: rule.description,
      })),
      required: false,
      initialValues: ruleRegistry
        .filter(
          (r: RuleMetadata) => r.category === "static" || !r.requiresStyleguide
        )
        .map((r: RuleMetadata) => r.id),
    });

    return ruleRegistry.filter((r: RuleMetadata) =>
      selectedRuleIds.includes(r.id)
    );
  },

  async confirmSetPreferredLibrary(): Promise<boolean> {
    return confirm({
      message:
        "Set a preferred component library? (If set, the rule will warn when non-preferred libraries are used)",
      initialValue: false,
    });
  },

  async selectPreferredLibrary(): Promise<"shadcn" | "mui"> {
    return select<"shadcn" | "mui">({
      message: "Which library should be preferred?",
      options: [
        { value: "shadcn", label: "shadcn/ui" },
        { value: "mui", label: "MUI (Material-UI)" },
      ],
    });
  },
};

// ============================================================================
// Choice Gathering Logic
// ============================================================================

/**
 * Gather all user choices using the prompter or CLI flags
 */
export async function gatherChoices(
  state: ProjectState,
  options: InstallOptions,
  prompter: Prompter
): Promise<UserChoices> {
  // Determine items from flags or prompts
  let items: InstallItem[];

  const hasExplicitFlags =
    options.mcp !== undefined ||
    options.hooks !== undefined ||
    options.genstyleguide !== undefined ||
    options.genrules !== undefined ||
    options.routes !== undefined ||
    options.react !== undefined;

  if (hasExplicitFlags || options.eslint) {
    items = [];
    if (options.mcp) items.push("mcp");
    if (options.hooks) items.push("hooks");
    if (options.genstyleguide) items.push("genstyleguide");
    if (options.genrules) items.push("genrules");
    if (options.routes || options.react) items.push("next");
    if (options.eslint) items.push("eslint");
  } else if (options.mode) {
    items = [];
    if (options.mode === "mcp" || options.mode === "both") items.push("mcp");
    if (options.mode === "hooks" || options.mode === "both")
      items.push("hooks");
    items.push("genstyleguide"); // Default when using mode
  } else {
    items = await prompter.selectInstallItems();
  }

  // MCP merge decision
  let mcpMerge = true;
  if (items.includes("mcp") && state.mcp.exists && !options.force) {
    mcpMerge = await prompter.confirmMcpMerge();
  }

  // Hooks merge decision
  let hooksMerge = true;
  if (items.includes("hooks") && state.hooks.exists && !options.force) {
    hooksMerge = await prompter.confirmHooksMerge();
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

  // ESLint choices
  let eslintChoices: EslintChoices | undefined;
  if (items.includes("eslint")) {
    // Filter to packages with ESLint config
    const packagesWithEslint = state.packages.filter(
      (p) => p.eslintConfigPath !== null
    );

    if (packagesWithEslint.length === 0) {
      throw new Error(
        "No packages with eslint.config.{mjs,js,cjs} found. Create an ESLint config first."
      );
    }

    const packagePaths = await prompter.selectEslintPackages(
      packagesWithEslint
    );

    if (packagePaths.length > 0) {
      let selectedRules = await prompter.selectEslintRules();

      // Handle no-mixed-component-libraries preferred library
      const hasMixedLibrariesRule = selectedRules.some(
        (r) => r.id === "no-mixed-component-libraries"
      );
      if (hasMixedLibrariesRule) {
        const setPreferred = await prompter.confirmSetPreferredLibrary();
        if (setPreferred) {
          const preferredLib = await prompter.selectPreferredLibrary();
          selectedRules = selectedRules.map((rule) => {
            if (rule.id === "no-mixed-component-libraries") {
              return {
                ...rule,
                defaultOptions: [
                  {
                    libraries: ["shadcn", "mui"],
                    preferred: preferredLib,
                  },
                ],
              };
            }
            return rule;
          });
        }
      }

      eslintChoices = { packagePaths, selectedRules };
    }
  }

  return {
    items,
    mcpMerge,
    hooksMerge,
    next: nextChoices,
    eslint: eslintChoices,
  };
}
