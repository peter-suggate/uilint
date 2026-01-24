/**
 * CLI Prompter Implementation
 *
 * Implements the Prompter interface using @clack/prompts for interactive CLI.
 * This provides a real implementation for the install flow.
 */

import * as prompts from "../../utils/prompts.js";
import type { RuleMetadata, OptionFieldSchema } from "uilint-eslint";
import { getRulesByCategory, getCategoryMeta } from "uilint-eslint";
import type {
  InstallItem,
  NextAppInfo,
  ViteAppInfo,
  EslintPackageInfo,
} from "./types.js";
import type { Prompter } from "./test-helpers.js";

/**
 * Prompt for a single option field based on its schema
 */
async function promptForField(
  field: OptionFieldSchema,
  currentValue: unknown
): Promise<unknown> {
  const hint = field.description ? prompts.pc.dim(` ${field.description}`) : "";

  switch (field.type) {
    case "boolean":
      return prompts.confirm({
        message: field.label,
        initialValue: (currentValue as boolean) ?? (field.defaultValue as boolean) ?? false,
      });

    case "number": {
      const numResult = await prompts.text({
        message: field.label + hint,
        placeholder: field.placeholder || String(currentValue ?? field.defaultValue ?? ""),
        defaultValue: String(currentValue ?? field.defaultValue ?? ""),
        validate: (value) => {
          const num = Number(value);
          if (isNaN(num)) return "Please enter a valid number";
          return undefined;
        },
      });
      return Number(numResult);
    }

    case "text": {
      const defaultVal = currentValue ?? field.defaultValue ?? "";
      // If default is an array, join it for display
      const displayDefault = Array.isArray(defaultVal)
        ? defaultVal.join(", ")
        : String(defaultVal);

      return prompts.text({
        message: field.label + hint,
        placeholder: field.placeholder || displayDefault,
        defaultValue: displayDefault,
      });
    }

    case "select":
      if (!field.options?.length) {
        return currentValue ?? field.defaultValue;
      }
      return prompts.select({
        message: field.label + hint,
        options: field.options.map((opt) => ({
          value: String(opt.value),
          label: opt.label,
        })),
        initialValue: String(currentValue ?? field.defaultValue),
      });

    case "multiselect":
      if (!field.options?.length) {
        return currentValue ?? field.defaultValue;
      }
      return prompts.multiselect({
        message: field.label + hint,
        options: field.options.map((opt) => ({
          value: String(opt.value),
          label: opt.label,
        })),
        initialValues: Array.isArray(currentValue)
          ? currentValue.map(String)
          : Array.isArray(field.defaultValue)
            ? (field.defaultValue as string[]).map(String)
            : [],
      });

    default:
      return currentValue ?? field.defaultValue;
  }
}

/**
 * Convert field value to the expected type for the rule options
 * Handles comma-separated text → array conversion
 */
function convertFieldValue(
  value: unknown,
  field: OptionFieldSchema,
  defaultValue: unknown
): unknown {
  // If defaultValue is an array but field type is text, parse comma-separated
  if (Array.isArray(defaultValue) && field.type === "text" && typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return value;
}

/**
 * CLI implementation of the Prompter interface
 */
export class CLIPrompter implements Prompter {
  async selectInstallItems(): Promise<InstallItem[]> {
    const result = await prompts.multiselect<InstallItem>({
      message: "What would you like to install?",
      options: [
        { value: "eslint", label: "ESLint Rules", hint: "Add UILint rules to your ESLint config" },
        { value: "next", label: "React DevTool", hint: "Visual overlay for Next.js/React" },
        { value: "genstyleguide", label: "Generate Styleguide", hint: "Create AI-powered styleguide" },
        { value: "skill", label: "Claude Skill", hint: "Add UILint skill to Claude Code" },
      ],
      required: true,
      initialValues: ["eslint"],
    });
    return result;
  }

  async selectNextApp(apps: NextAppInfo[]): Promise<NextAppInfo> {
    const name = await prompts.select({
      message: "Multiple Next.js apps found. Which one?",
      options: apps.map((app) => ({
        value: app.projectPath,
        label: app.projectPath,
        hint: String(app.detection),
      })),
    });
    return apps.find((a) => a.projectPath === name)!;
  }

  async selectViteApp(apps: ViteAppInfo[]): Promise<ViteAppInfo> {
    const name = await prompts.select({
      message: "Multiple Vite apps found. Which one?",
      options: apps.map((app) => ({
        value: app.projectPath,
        label: app.projectPath,
        hint: String(app.detection),
      })),
    });
    return apps.find((a) => a.projectPath === name)!;
  }

  async selectEslintPackages(packages: EslintPackageInfo[]): Promise<string[]> {
    if (packages.length === 1) {
      return [packages[0].path];
    }

    const result = await prompts.multiselect({
      message: "Which packages should get UILint rules?",
      options: packages.map((pkg) => ({
        value: pkg.path,
        label: pkg.path,
        hint: pkg.eslintConfigPath || undefined,
      })),
      required: true,
      initialValues: packages.map((p) => p.path),
    });
    return result;
  }

  async selectEslintRules(): Promise<RuleMetadata[]> {
    const staticRules = getRulesByCategory("static");
    const semanticRules = getRulesByCategory("semantic");
    const staticCat = getCategoryMeta("static");
    const semanticCat = getCategoryMeta("semantic");

    // Helper to get default enabled rules for a category
    const getDefaultEnabled = (rules: RuleMetadata[], categoryDefaultEnabled: boolean) =>
      rules
        .filter((r) => r.defaultEnabled ?? categoryDefaultEnabled)
        .map((r) => r.id);

    // Static rules section
    prompts.log("");
    prompts.log(
      prompts.pc.bold(`${staticCat?.icon ?? "📋"} ${staticCat?.name ?? "Static Rules"}`) +
      prompts.pc.dim(` (${staticCat?.description ?? "Pattern-based, fast analysis"})`)
    );

    const selectedStatic = await prompts.multiselect({
      message: "Select static rules",
      options: staticRules.map((rule) => ({
        value: rule.id,
        label: `${rule.icon ?? ""} ${rule.name}`.trim(),
        hint: rule.hint ?? rule.description,
      })),
      initialValues: getDefaultEnabled(staticRules, staticCat?.defaultEnabled ?? true),
    });

    // Semantic rules section
    prompts.log("");
    prompts.log(
      prompts.pc.bold(`${semanticCat?.icon ?? "🧠"} ${semanticCat?.name ?? "Semantic Rules"}`) +
      prompts.pc.dim(` (${semanticCat?.description ?? "LLM-powered analysis"})`)
    );

    const selectedSemantic = await prompts.multiselect({
      message: "Select semantic rules",
      options: semanticRules.map((rule) => ({
        value: rule.id,
        label: `${rule.icon ?? ""} ${rule.name}`.trim(),
        hint: rule.hint ?? rule.description,
      })),
      initialValues: getDefaultEnabled(semanticRules, semanticCat?.defaultEnabled ?? false),
    });

    const allRules = [...staticRules, ...semanticRules];
    const selectedIds = new Set([...selectedStatic, ...selectedSemantic]);

    return allRules.filter((r) => selectedIds.has(r.id)) as RuleMetadata[];
  }

  async selectEslintRuleSeverity(): Promise<"warn" | "error" | "defaults"> {
    return prompts.select({
      message: "Default severity for all rules?",
      options: [
        { value: "defaults", label: "Use rule defaults", hint: "Each rule uses its recommended severity" },
        { value: "warn", label: "Warn", hint: "All rules report as warnings" },
        { value: "error", label: "Error", hint: "All rules report as errors" },
      ],
      initialValue: "defaults",
    });
  }

  async confirmCustomizeRuleOptions(): Promise<boolean> {
    return prompts.confirm({
      message: "Customize individual rule options?",
      initialValue: false, // Defaults work well for most projects
    });
  }

  async configureRuleOptions(
    rule: RuleMetadata
  ): Promise<Record<string, unknown> | undefined> {
    if (!rule.optionSchema?.fields?.length) {
      return undefined;
    }

    prompts.log("");
    prompts.log(
      prompts.pc.bold(prompts.pc.cyan(`${rule.icon ?? "⚙️"}  ${rule.name}`)) +
      prompts.pc.dim(` - ${rule.description}`)
    );

    const baseOptions = rule.defaultOptions?.[0] ?? {};
    const options: Record<string, unknown> = {};

    for (const field of rule.optionSchema.fields) {
      const currentValue = (baseOptions as Record<string, unknown>)[field.key];
      const defaultValue = currentValue ?? field.defaultValue;

      const value = await promptForField(field, currentValue);
      options[field.key] = convertFieldValue(value, field, defaultValue);
    }

    return options;
  }
}

/**
 * Create a CLI prompter instance
 */
export function createCLIPrompter(): Prompter {
  return new CLIPrompter();
}
