/**
 * Rule creation helper using @typescript-eslint/utils
 */

import { ESLintUtils } from "@typescript-eslint/utils";

export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/peter-suggate/uilint/blob/main/packages/uilint-eslint/docs/rules/${name}.md`
);

/**
 * Schema for prompting user to configure a rule option in the CLI
 */
export interface OptionFieldSchema {
  /** Field name in the options object */
  key: string;
  /** Display label for the prompt */
  label: string;
  /** Prompt type */
  type: "text" | "number" | "boolean" | "select" | "multiselect";
  /** Default value */
  defaultValue: unknown;
  /** Placeholder text (for text/number inputs) */
  placeholder?: string;
  /** Options for select/multiselect */
  options?: Array<{ value: string | number; label: string }>;
  /** Description/hint for the field */
  description?: string;
}

/**
 * Schema describing how to prompt for rule options during installation
 */
export interface RuleOptionSchema {
  /** Fields that can be configured for this rule */
  fields: OptionFieldSchema[];
}

/**
 * Colocated rule metadata - exported alongside each rule
 *
 * This structure keeps all rule metadata in the same file as the rule implementation,
 * making it easy to maintain and extend as new rules are added.
 */
export interface RuleMeta {
  /** Rule identifier (e.g., "no-arbitrary-tailwind") - must match filename */
  id: string;

  /** Display name for CLI (e.g., "No Arbitrary Tailwind") */
  name: string;

  /** Short description for CLI selection prompts (one line) */
  description: string;

  /** Default severity level */
  defaultSeverity: "error" | "warn" | "off";

  /** Category for grouping in CLI */
  category: "static" | "semantic";

  /** Whether this rule requires a styleguide file */
  requiresStyleguide?: boolean;

  /** Default options for the rule (passed as second element in ESLint config) */
  defaultOptions?: unknown[];

  /** Schema for prompting user to configure options during install */
  optionSchema?: RuleOptionSchema;

  /**
   * Detailed documentation in markdown format.
   * Should include:
   * - What the rule does
   * - Why it's useful
   * - Examples of incorrect and correct code
   * - Configuration options explained
   */
  docs: string;
}

/**
 * Helper to define rule metadata with type safety
 */
export function defineRuleMeta(meta: RuleMeta): RuleMeta {
  return meta;
}
