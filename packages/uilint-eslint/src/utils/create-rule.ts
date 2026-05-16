/**
 * Rule creation helper using @typescript-eslint/utils
 */

import { ESLintUtils } from "@typescript-eslint/utils";
import type { TSESLint } from "@typescript-eslint/utils";
import {
  recordRuleListener,
  recordRuleReport,
  recordRuleSetup,
  registerRuleProfilerFlush,
  shouldProfileRule,
} from "./rule-profiler.js";

const baseCreateRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/peter-suggate/uilint/blob/main/packages/uilint-eslint/docs/rules/${name}.md`
);

type RuleContext<MessageIds extends string, Options extends readonly unknown[]> =
  Readonly<TSESLint.RuleContext<MessageIds, Options>>;

type ReportTarget = {
  report: (descriptor: unknown) => void;
};

function getContextFilename<
  MessageIds extends string,
  Options extends readonly unknown[],
>(context: RuleContext<MessageIds, Options>): string {
  return context.filename || context.getFilename?.() || "<unknown>";
}

function wrapRuleContext<
  MessageIds extends string,
  Options extends readonly unknown[],
>(
  context: RuleContext<MessageIds, Options>,
  ruleId: string,
  filePath: string
): RuleContext<MessageIds, Options> {
  const reportTarget = context as unknown as ReportTarget;
  const originalReport = reportTarget.report.bind(context);
  const profiledContext = Object.create(context) as ReportTarget;
  Object.defineProperty(profiledContext, "report", {
    value: (descriptor: unknown) => {
      recordRuleReport(ruleId, filePath);
      return originalReport(descriptor);
    },
    enumerable: true,
    configurable: true,
  });

  return profiledContext as RuleContext<MessageIds, Options>;
}

function wrapRuleListener(
  listener: TSESLint.RuleListener,
  ruleId: string,
  filePath: string
): TSESLint.RuleListener {
  const wrapped: Record<string, unknown> = {};

  for (const [selector, handler] of Object.entries(listener)) {
    if (typeof handler !== "function") {
      wrapped[selector] = handler;
      continue;
    }

    const originalHandler = handler as (...args: unknown[]) => unknown;
    wrapped[selector] = function timedRuleListener(
      this: unknown,
      ...args: unknown[]
    ): unknown {
      const startedAt = process.hrtime.bigint();
      try {
        return originalHandler.apply(this, args);
      } finally {
        recordRuleListener(
          ruleId,
          filePath,
          selector,
          process.hrtime.bigint() - startedAt
        );
      }
    };
  }

  return wrapped as TSESLint.RuleListener;
}

export const createRule = (<
  Options extends readonly unknown[],
  MessageIds extends string,
>(
  config: Parameters<typeof baseCreateRule<Options, MessageIds>>[0]
) => {
  if (!shouldProfileRule(config.name)) {
    return baseCreateRule(config);
  }

  registerRuleProfilerFlush();

  return baseCreateRule({
    ...config,
    create(context, optionsWithDefault) {
      const filePath = getContextFilename(context);
      const profiledContext = wrapRuleContext(context, config.name, filePath);
      const startedAt = process.hrtime.bigint();

      try {
        const listener = config.create(profiledContext, optionsWithDefault);
        recordRuleSetup(
          config.name,
          filePath,
          process.hrtime.bigint() - startedAt
        );
        return wrapRuleListener(listener, config.name, filePath);
      } catch (error) {
        recordRuleSetup(
          config.name,
          filePath,
          process.hrtime.bigint() - startedAt
        );
        throw error;
      }
    },
  });
}) as typeof baseCreateRule;

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
  /** Requirement type for programmatic checks. Plugins define their own types. */
  type: string;
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
  category: string;

  /** Icon for display in CLI/UI (emoji or icon name) */
  icon?: string;

  /** Short hint about the rule type/requirements */
  hint?: string;

  /** Whether rule is enabled by default during install */
  defaultEnabled?: boolean;

  /** External requirements the rule needs */
  requirements?: RuleRequirement[];

  /**
   * NPM packages that must be installed for this rule to work.
   * These will be added to the target project's dependencies during installation.
   *
   * Example: ["xxhash-wasm"] for rules using the xxhash library
   */
  npmDependencies?: string[];

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
   * Plugins define their own identifiers.
   */
  plugin?: string;

  /**
   * ESLint import specifier for external plugin rules.
   *
   * When set, `uilint init` will generate an import from this specifier
   * instead of looking for the rule in `.uilint/rules/`. The import should
   * be a default export of the ESLint rule implementation.
   *
   * Example: `"uilint-vision/eslint-rules/semantic-vision"`
   *
   * The generated ESLint config will include:
   * ```js
   * import SemanticVisionRule from "uilint-vision/eslint-rules/semantic-vision";
   * ```
   */
  eslintImport?: string;

  /**
   * Custom inspector panel ID to use for this rule's issues.
   * If not specified, uses the plugin's default issue inspector.
   * Plugins define their own panel IDs.
   */
  customInspector?: string;

  /**
   * Custom heatmap color for this rule's issues.
   * CSS color value (hex, rgb, hsl, or named color).
   * If not specified, uses severity-based coloring.
   */
  heatmapColor?: string;

  /**
   * ESLint messageIds that represent internal/sentinel errors.
   *
   * Issues reported with these messageIds are not user-facing lint issues
   * but internal error signals (e.g., "analysis backend failed" or
   * "styleguide not found"). The serve command will log these to the
   * dashboard and filter them from client results automatically.
   *
   * This allows rules with fallible backends (LLM calls, external services)
   * to signal errors through ESLint's reporting mechanism without those
   * errors being shown to end users as lint issues.
   *
   * Example: `["analysisError", "styleguideNotFound"]`
   */
  sentinelMessageIds?: string[];
}

/**
 * Helper to define rule metadata with type safety
 */
export function defineRuleMeta(meta: RuleMeta): RuleMeta {
  return meta;
}
