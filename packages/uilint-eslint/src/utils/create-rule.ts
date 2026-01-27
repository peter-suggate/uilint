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
 * External requirement that a rule needs to function
 */
export interface RuleRequirement {
  /** Requirement type for programmatic checks */
  type: "ollama" | "git" | "coverage" | "semantic-index" | "styleguide";
  /** Human-readable description */
  description: string;
  /** Optional: how to satisfy the requirement */
  setupHint?: string;
}

/**
 * Rule migration definition for updating rule options between versions
 */
export interface RuleMigration {
  /** Source version (semver) */
  from: string;
  /** Target version (semver) */
  to: string;
  /** Human-readable description of what changed */
  description: string;
  /** Function to migrate options from old format to new format */
  migrate: (oldOptions: unknown[]) => unknown[];
  /** Whether this migration contains breaking changes */
  breaking?: boolean;
}

/**
 * Colocated rule metadata - exported alongside each rule
 *
 * This structure keeps all rule metadata in the same file as the rule implementation,
 * making it easy to maintain and extend as new rules are added.
 */
export interface RuleMeta {
  /** Rule identifier (e.g., "consistent-dark-mode") - must match filename */
  id: string;

  /** Semantic version of the rule (e.g., "1.0.0") */
  version: string;

  /** Display name for CLI (e.g., "No Arbitrary Tailwind") */
  name: string;

  /** Short description for CLI selection prompts (one line) */
  description: string;

  /** Default severity level */
  defaultSeverity: "error" | "warn" | "off";

  /** Category for grouping in CLI */
  category: "static" | "semantic";

  /** Icon for display in CLI/UI (emoji or icon name) */
  icon?: string;

  /** Short hint about the rule type/requirements */
  hint?: string;

  /** Whether rule is enabled by default during install */
  defaultEnabled?: boolean;

  /** External requirements the rule needs */
  requirements?: RuleRequirement[];

  /** Instructions to show after installation */
  postInstallInstructions?: string;

  /** Framework compatibility */
  frameworks?: ("next" | "vite" | "cra" | "remix")[];

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

  /**
   * Internal utility dependencies that this rule requires.
   * When the rule is copied to a target project, these utilities
   * will be transformed to import from "uilint-eslint" instead
   * of relative paths.
   *
   * Example: ["coverage-aggregator", "dependency-graph"]
   */
  internalDependencies?: string[];

  /**
   * Whether this rule is directory-based (has lib/ folder with utilities).
   * Directory-based rules are installed as folders with index.ts and lib/ subdirectory.
   * Single-file rules are installed as single .ts files.
   *
   * When true, ESLint config imports will use:
   *   ./.uilint/rules/rule-id/index.js
   * When false (default):
   *   ./.uilint/rules/rule-id.js
   */
  isDirectoryBased?: boolean;

  /**
   * Migrations for updating rule options between versions.
   * Migrations are applied in order to transform options from older versions.
   */
  migrations?: RuleMigration[];

  /**
   * Which UI plugin should handle this rule.
   * Defaults based on category:
   * - "static" category → "eslint" plugin
   * - "semantic" category → "semantic" plugin
   *
   * Special cases:
   * - "vision" for semantic-vision rule
   */
  plugin?: "eslint" | "vision" | "semantic";

  /**
   * Custom inspector panel ID to use for this rule's issues.
   * If not specified, uses the plugin's default issue inspector.
   *
   * Examples:
   * - "vision-issue" for VisionIssueInspector
   * - "duplicates" for DuplicatesInspector
   * - "semantic-issue" for SemanticIssueInspector
   */
  customInspector?: string;

  /**
   * Custom heatmap color for this rule's issues.
   * CSS color value (hex, rgb, hsl, or named color).
   * If not specified, uses severity-based coloring.
   */
  heatmapColor?: string;
}

/**
 * Helper to define rule metadata with type safety
 */
export function defineRuleMeta(meta: RuleMeta): RuleMeta {
  return meta;
}
