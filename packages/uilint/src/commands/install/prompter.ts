/**
 * Prompter interface and CLI implementation
 *
 * The Prompter interface abstracts all interactive prompts, allowing
 * tests to provide canned responses instead of real user input.
 */

import type { RuleMetadata, OptionFieldSchema } from "uilint-eslint";
import { ruleRegistry } from "uilint-eslint";
import { confirm, select, multiselect, text, pc } from "../../utils/prompts.js";
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
   * Select severity to apply to selected ESLint rules
   *
   * - "warn": configure all selected rules as warnings
   * - "error": configure all selected rules as errors
   * - "defaults": keep each rule's defaultSeverity from the registry
   */
  selectEslintRuleSeverity(): Promise<"warn" | "error" | "defaults">;

  /**
   * Ask whether to customize individual rule options
   */
  confirmCustomizeRuleOptions(): Promise<boolean>;

  /**
   * Configure a single rule's options based on its schema
   * Returns the configured options object
   */
  configureRuleOptions(
    rule: RuleMetadata
  ): Promise<Record<string, unknown> | undefined>;
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

    // Pre-select first frontend packages
    const initialValues = packages
      .filter((p) => p.isFrontend)
      .map((p) => p.path)
      .slice(0, 1);

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

  async selectEslintRuleSeverity(): Promise<"warn" | "error" | "defaults"> {
    return select<"warn" | "error" | "defaults">({
      message: "How strict should the selected ESLint rules be?",
      options: [
        {
          value: "warn",
          label: "Warn (recommended)",
          hint: "Safer default while you dial in your styleguide + rules",
        },
        {
          value: "error",
          label: "Error (strict)",
          hint: "Make selected rules fail CI",
        },
        {
          value: "defaults",
          label: "Use rule defaults",
          hint: "Some rules are warn, some are error (as defined by uilint-eslint)",
        },
      ],
      initialValue: "warn",
    });
  },

  async confirmCustomizeRuleOptions(): Promise<boolean> {
    return confirm({
      message:
        "Customize individual rule options? (spacing scale, thresholds, etc.)",
      initialValue: false,
    });
  },

  async configureRuleOptions(
    rule: RuleMetadata
  ): Promise<Record<string, unknown> | undefined> {
    if (!rule.optionSchema || rule.optionSchema.fields.length === 0) {
      return undefined;
    }

    const options: Record<string, unknown> = {};

    for (const field of rule.optionSchema.fields) {
      const value = await promptForField(field, rule.name);
      if (value !== undefined) {
        options[field.key] = value;
      }
    }

    return Object.keys(options).length > 0 ? options : undefined;
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Prompt for a single option field based on its schema
 */
async function promptForField(
  field: OptionFieldSchema,
  ruleName: string
): Promise<unknown> {
  const message = `${pc.cyan(ruleName)} - ${field.label}`;

  switch (field.type) {
    case "text": {
      const result = await text({
        message,
        placeholder: field.placeholder,
        defaultValue:
          typeof field.defaultValue === "string"
            ? field.defaultValue
            : Array.isArray(field.defaultValue)
            ? field.defaultValue.join(", ")
            : String(field.defaultValue),
      });
      // Special handling for comma-separated arrays (like spacing scale)
      if (field.key === "scale" && typeof result === "string") {
        const scale = result
          .split(",")
          .map((s) => parseFloat(s.trim()))
          .filter((n) => !isNaN(n));
        return scale.length > 0 ? scale : field.defaultValue;
      }
      return result || field.defaultValue;
    }

    case "number": {
      const result = await text({
        message,
        placeholder: field.placeholder || String(field.defaultValue),
        defaultValue: String(field.defaultValue),
      });
      const num = parseFloat(result);
      return isNaN(num) ? field.defaultValue : num;
    }

    case "boolean": {
      return await confirm({
        message,
        initialValue: Boolean(field.defaultValue),
      });
    }

    case "select": {
      if (!field.options) {
        return field.defaultValue;
      }
      // Convert all values to strings for select
      const stringOptions = field.options.map(
        (opt: { value: string | number; label: string }) => ({
          value: String(opt.value),
          label: opt.label,
        })
      );
      const result = await select<string>({
        message,
        options: stringOptions,
        initialValue: String(field.defaultValue),
      });
      // Convert back to original type if needed
      const originalOpt = field.options.find(
        (opt: { value: string | number; label: string }) =>
          String(opt.value) === result
      );
      return originalOpt?.value ?? result;
    }

    case "multiselect": {
      if (!field.options) {
        return field.defaultValue;
      }
      // Convert all values to strings for multiselect
      const stringOptions = field.options.map(
        (opt: { value: string | number; label: string }) => ({
          value: String(opt.value),
          label: opt.label,
        })
      );
      const result = await multiselect<string>({
        message,
        options: stringOptions,
        initialValues: Array.isArray(field.defaultValue)
          ? (field.defaultValue as unknown[]).map((v) => String(v))
          : [String(field.defaultValue)],
      });
      // Convert back to original types
      return result.map((selected) => {
        const originalOpt = field.options!.find(
          (opt: { value: string | number; label: string }) =>
            String(opt.value) === selected
        );
        return originalOpt?.value ?? selected;
      });
    }

    default:
      return field.defaultValue;
  }
}

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
    mcpMerge,
    hooksMerge,
    next: nextChoices,
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
