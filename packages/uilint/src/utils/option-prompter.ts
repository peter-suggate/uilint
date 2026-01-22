/**
 * Option Prompter
 *
 * Dynamically generates CLI prompts from rule optionSchema.
 * Keeps users in the install flow while allowing customization.
 *
 * Prior art: ESLint --init, Vite create, Angular CLI schematics
 */

import * as prompts from "./prompts.js";
import type { RuleMeta, OptionFieldSchema } from "uilint-eslint";

/**
 * Prompt for a single option field based on its schema
 */
async function promptForField(
  field: OptionFieldSchema,
  ruleName: string
): Promise<unknown> {
  const hint = field.description ? ` (${field.description})` : "";

  switch (field.type) {
    case "boolean":
      return prompts.confirm({
        message: `${field.label}?`,
        initialValue: field.defaultValue as boolean,
      });

    case "number":
      const numResult = await prompts.text({
        message: field.label + hint,
        placeholder: field.placeholder || String(field.defaultValue),
        defaultValue: String(field.defaultValue),
        validate: (value) => {
          const num = Number(value);
          if (isNaN(num)) return "Please enter a valid number";
          return undefined;
        },
      });
      return Number(numResult);

    case "text":
      return prompts.text({
        message: field.label + hint,
        placeholder: field.placeholder || String(field.defaultValue ?? ""),
        defaultValue: String(field.defaultValue ?? ""),
      });

    case "select":
      if (!field.options?.length) {
        return field.defaultValue;
      }
      return prompts.select({
        message: field.label + hint,
        options: field.options.map((opt) => ({
          value: String(opt.value),
          label: opt.label,
        })),
        initialValue: String(field.defaultValue),
      });

    case "multiselect":
      if (!field.options?.length) {
        return field.defaultValue;
      }
      return prompts.multiselect({
        message: field.label + hint,
        options: field.options.map((opt) => ({
          value: String(opt.value),
          label: opt.label,
        })),
        initialValues: Array.isArray(field.defaultValue)
          ? field.defaultValue.map(String)
          : [],
      });

    default:
      return field.defaultValue;
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
 * Prompt for all options of a single rule
 */
export async function promptForRuleOptions(
  rule: RuleMeta
): Promise<unknown[] | undefined> {
  if (!rule.optionSchema?.fields?.length) {
    return rule.defaultOptions;
  }

  prompts.log(`\n${prompts.pc.bold(prompts.pc.cyan(rule.name))}`);
  prompts.log(prompts.pc.dim(rule.description));

  // Build options object from defaults
  const baseOptions = rule.defaultOptions?.[0] ?? {};
  const options: Record<string, unknown> = { ...baseOptions as Record<string, unknown> };

  for (const field of rule.optionSchema.fields) {
    const defaultValue = (baseOptions as Record<string, unknown>)[field.key] ?? field.defaultValue;
    const value = await promptForField(field, rule.name);
    options[field.key] = convertFieldValue(value, field, defaultValue);
  }

  return [options];
}

/**
 * Configuration result for a rule
 */
export interface ConfiguredRuleOptions {
  ruleId: string;
  options: unknown[];
}

/**
 * Prompt for options on multiple rules that have configurable options
 *
 * Flow:
 * 1. Filter to rules with optionSchema
 * 2. Ask if user wants to customize (defaults work for most)
 * 3. For each rule, prompt for its options
 * 4. Return map of ruleId → options
 */
export async function promptForAllRuleOptions(
  enabledRules: RuleMeta[]
): Promise<Map<string, unknown[]>> {
  const result = new Map<string, unknown[]>();

  // Find rules with configurable options
  const configurableRules = enabledRules.filter(
    (rule) => rule.optionSchema?.fields?.length
  );

  // If no configurable rules, return defaults
  if (configurableRules.length === 0) {
    for (const rule of enabledRules) {
      if (rule.defaultOptions) {
        result.set(rule.id, rule.defaultOptions);
      }
    }
    return result;
  }

  // List what's configurable
  prompts.log("");
  prompts.logInfo(
    `${configurableRules.length} rule${configurableRules.length > 1 ? "s have" : " has"} configurable options:`
  );
  for (const rule of configurableRules) {
    const fieldCount = rule.optionSchema!.fields.length;
    prompts.log(
      `  ${prompts.pc.cyan("•")} ${rule.name} (${fieldCount} option${fieldCount > 1 ? "s" : ""})`
    );
  }

  // Ask if they want to customize
  const customize = await prompts.confirm({
    message: "Would you like to customize these options?",
    initialValue: false, // Defaults work well for most
  });

  if (!customize) {
    // Use defaults for all
    for (const rule of enabledRules) {
      if (rule.defaultOptions) {
        result.set(rule.id, rule.defaultOptions);
      }
    }
    return result;
  }

  // Prompt for each configurable rule
  for (const rule of configurableRules) {
    const options = await promptForRuleOptions(rule);
    if (options) {
      result.set(rule.id, options);
    }
  }

  // Add defaults for non-configurable rules
  for (const rule of enabledRules) {
    if (!result.has(rule.id) && rule.defaultOptions) {
      result.set(rule.id, rule.defaultOptions);
    }
  }

  return result;
}

/**
 * Quick helper to check if any rules have configurable options
 */
export function hasConfigurableOptions(rules: RuleMeta[]): boolean {
  return rules.some((rule) => rule.optionSchema?.fields?.length);
}
