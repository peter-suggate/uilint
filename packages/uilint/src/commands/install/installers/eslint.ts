/**
 * ESLint installer - UILint ESLint plugin configuration
 *
 * Provides interactive rule selection and severity configuration during install.
 */

import { join } from "path";
import { ruleRegistry, getRulesByCategory, getRuleDocs } from "uilint-eslint";
import type {
  Installer,
  InstallTarget,
  InstallerConfig,
  ProgressEvent,
  UpgradeInfo,
} from "./types.js";
import type {
  ProjectState,
  InstallAction,
  DependencyInstall,
} from "../types.js";
import type { RuleMeta } from "uilint-eslint";
import * as prompts from "../../../utils/prompts.js";
import { detectPackageManager } from "../../../utils/package-manager.js";

/**
 * Calculate upgrade info for a package that already has uilint rules configured
 */
function getUpgradeInfo(configuredRuleIds: string[]): UpgradeInfo | undefined {
  const configuredSet = new Set(configuredRuleIds);
  const allRuleIds = ruleRegistry.map((r) => r.id);

  // Find rules that are available but not configured
  const missingRules = allRuleIds.filter((id) => !configuredSet.has(id));

  if (missingRules.length === 0) {
    return undefined;
  }

  const summary =
    missingRules.length === 1
      ? "1 new rule available"
      : `${missingRules.length} new rules available`;

  return {
    missingRules,
    summary,
  };
}

function toInstallSpecifier(pkgName: string): string {
  return pkgName;
}

/**
 * Configured rule with user-selected severity
 */
export interface ConfiguredRule {
  /** Rule metadata */
  rule: RuleMeta;
  /** User-selected severity */
  severity: "error" | "warn" | "off";
  /** Custom options (if user configured them) */
  options?: unknown[];
}

export interface ESLintInstallerConfig extends InstallerConfig {
  /** Selected rules with their configurations */
  configuredRules: ConfiguredRule[];
}

/**
 * Format rule for display in multiselect
 */
function formatRuleOption(rule: RuleMeta): {
  value: string;
  label: string;
  hint: string;
} {
  const severityBadge =
    rule.defaultSeverity === "error"
      ? prompts.pc.red("error")
      : prompts.pc.yellow("warn");
  return {
    value: rule.id,
    label: `${rule.name}`,
    hint: `${rule.description} [${severityBadge}]`,
  };
}

/**
 * Display rule documentation in a nice format
 */
function showRuleDoc(rule: RuleMeta): void {
  prompts.note(
    rule.docs.trim().slice(0, 500) + (rule.docs.length > 500 ? "..." : ""),
    `📖 ${rule.name}`
  );
}

export const eslintInstaller: Installer = {
  id: "eslint",
  name: "ESLint plugin",
  description: "Lint UI consistency with ESLint rules",
  icon: "🔍",

  isApplicable(project: ProjectState): boolean {
    return project.packages.some((pkg) => pkg.eslintConfigPath !== null);
  },

  getTargets(project: ProjectState): InstallTarget[] {
    return project.packages
      .filter((pkg) => pkg.eslintConfigPath !== null)
      .map((pkg) => {
        const upgradeInfo = pkg.hasUilintRules
          ? getUpgradeInfo(pkg.configuredRuleIds)
          : undefined;

        // Build hint showing config file and upgrade status
        let hint = pkg.eslintConfigFilename || "ESLint config detected";
        if (upgradeInfo?.summary) {
          hint = `${hint} · ${upgradeInfo.summary}`;
        }

        return {
          id: `eslint-${pkg.name}`,
          label: pkg.name,
          path: pkg.path,
          hint,
          isInstalled: pkg.hasUilintRules,
          canUpgrade: upgradeInfo !== undefined,
          upgradeInfo,
        };
      });
  },

  async configure(
    targets: InstallTarget[],
    project: ProjectState
  ): Promise<ESLintInstallerConfig> {
    const staticRules = getRulesByCategory("static");
    const semanticRules = getRulesByCategory("semantic");

    // Step 1: Ask about installation mode
    const installMode = await prompts.select({
      message: "How would you like to configure UILint ESLint rules?",
      options: [
        {
          value: "recommended",
          label: "Recommended (static rules only)",
          hint: "Best for most projects - fast and reliable",
        },
        {
          value: "strict",
          label: "Strict (all rules including semantic)",
          hint: "Includes LLM-powered analysis - requires Ollama",
        },
        {
          value: "custom",
          label: "Custom selection",
          hint: "Choose individual rules and configure severity",
        },
      ],
    });

    let selectedRuleIds: string[];
    let configuredRules: ConfiguredRule[];

    if (installMode === "recommended") {
      // Use all static rules with default severity
      configuredRules = staticRules.map((rule) => ({
        rule,
        severity: rule.defaultSeverity as "error" | "warn",
        options: rule.defaultOptions,
      }));
    } else if (installMode === "strict") {
      // Use all rules with default severity
      configuredRules = ruleRegistry.map((rule) => ({
        rule,
        severity: rule.defaultSeverity as "error" | "warn",
        options: rule.defaultOptions,
      }));
    } else {
      // Custom selection flow
      prompts.log(prompts.pc.dim("\n📋 Static rules (pattern-based, fast):"));

      // Select static rules
      const selectedStaticIds = await prompts.multiselect({
        message: "Select static rules to enable:",
        options: staticRules.map(formatRuleOption),
        initialValues: staticRules.map((r) => r.id),
      });

      // Ask about semantic rules
      const includeSemanticRules = await prompts.confirm({
        message: `Include semantic rules? ${prompts.pc.dim(
          "(requires Ollama for LLM analysis)"
        )}`,
        initialValue: false,
      });

      let selectedSemanticIds: string[] = [];
      if (includeSemanticRules) {
        prompts.log(
          prompts.pc.dim("\n🧠 Semantic rules (LLM-powered, slower):")
        );
        selectedSemanticIds = await prompts.multiselect({
          message: "Select semantic rules:",
          options: semanticRules.map(formatRuleOption),
          initialValues: semanticRules.map((r) => r.id),
        });
      }

      selectedRuleIds = [...selectedStaticIds, ...selectedSemanticIds];

      // Step 2: Configure severity for each selected rule
      const configureSeverity = await prompts.confirm({
        message: "Would you like to customize severity levels?",
        initialValue: false,
      });

      configuredRules = [];

      for (const ruleId of selectedRuleIds) {
        const rule = ruleRegistry.find((r) => r.id === ruleId)!;

        if (configureSeverity) {
          const severity = await prompts.select({
            message: `${rule.name} - severity:`,
            options: [
              {
                value: rule.defaultSeverity,
                label: `${rule.defaultSeverity} (default)`,
              },
              ...(rule.defaultSeverity !== "error"
                ? [{ value: "error" as const, label: "error" }]
                : []),
              ...(rule.defaultSeverity !== "warn"
                ? [{ value: "warn" as const, label: "warn" }]
                : []),
            ],
            initialValue: rule.defaultSeverity,
          });

          configuredRules.push({
            rule,
            severity: severity as "error" | "warn",
            options: rule.defaultOptions,
          });
        } else {
          configuredRules.push({
            rule,
            severity: rule.defaultSeverity as "error" | "warn",
            options: rule.defaultOptions,
          });
        }
      }
    }

    // Summary
    const errorCount = configuredRules.filter(
      (r) => r.severity === "error"
    ).length;
    const warnCount = configuredRules.filter(
      (r) => r.severity === "warn"
    ).length;

    prompts.log("");
    prompts.note(
      configuredRules
        .map(
          (cr) =>
            `${cr.severity === "error" ? "🔴" : "🟡"} ${cr.rule.name} (${
              cr.severity
            })`
        )
        .join("\n"),
      `Selected ${configuredRules.length} rules (${errorCount} errors, ${warnCount} warnings)`
    );

    return { configuredRules };
  },

  plan(
    targets: InstallTarget[],
    config: InstallerConfig,
    project: ProjectState
  ): {
    actions: InstallAction[];
    dependencies: DependencyInstall[];
  } {
    const actions: InstallAction[] = [];
    const dependencies: DependencyInstall[] = [];
    const eslintConfig = config as ESLintInstallerConfig;
    const { configuredRules } = eslintConfig;

    // Convert configuredRules to the format expected by inject_eslint
    const rulesWithSeverity = configuredRules.map((cr) => ({
      ...cr.rule,
      defaultSeverity: cr.severity,
      defaultOptions: cr.options,
    }));

    for (const target of targets) {
      const pkgInfo = project.packages.find((p) => p.path === target.path);
      if (!pkgInfo || !pkgInfo.eslintConfigPath) continue;

      // Create .uilint/rules directory
      const rulesDir = join(target.path, ".uilint", "rules");
      actions.push({
        type: "create_directory",
        path: rulesDir,
      });

      // Install dependencies using the package manager for this specific target
      dependencies.push({
        packagePath: target.path,
        packageManager: detectPackageManager(target.path),
        packages: [toInstallSpecifier("uilint-eslint"), "typescript-eslint"],
      });

      // Inject ESLint rules
      actions.push({
        type: "inject_eslint",
        packagePath: target.path,
        configPath: pkgInfo.eslintConfigPath,
        rules: rulesWithSeverity,
        hasExistingRules: pkgInfo.hasUilintRules,
      });
    }

    // Add .uilint/.cache to .gitignore
    const gitignorePath = join(project.workspaceRoot, ".gitignore");
    actions.push({
      type: "append_to_file",
      path: gitignorePath,
      content: "\n# UILint cache\n.uilint/.cache\n",
      ifNotContains: ".uilint/.cache",
    });

    return { actions, dependencies };
  },

  async *execute(
    targets: InstallTarget[],
    config: InstallerConfig,
    project: ProjectState
  ): AsyncGenerator<ProgressEvent> {
    const eslintConfig = config as ESLintInstallerConfig;

    yield {
      type: "start",
      message: "Installing ESLint plugin",
    };

    for (const target of targets) {
      yield {
        type: "progress",
        message: `Configuring ESLint in ${target.label}`,
        detail: "→ Adding uilint-eslint to dependencies",
      };

      yield {
        type: "progress",
        message: `Injecting ${eslintConfig.configuredRules.length} rules`,
        detail: `→ ${target.hint}`,
      };
    }

    yield {
      type: "complete",
      message: `ESLint plugin installed in ${targets.length} package(s)`,
    };
  },

  planUninstall(
    targets: InstallTarget[],
    project: ProjectState
  ): {
    actions: InstallAction[];
  } {
    const actions: InstallAction[] = [];

    for (const target of targets) {
      const pkgInfo = project.packages.find((p) => p.path === target.path);
      if (!pkgInfo || !pkgInfo.eslintConfigPath) continue;

      // Remove ESLint rules from config
      actions.push({
        type: "remove_eslint",
        packagePath: target.path,
        configPath: pkgInfo.eslintConfigPath,
      });

      // Remove .uilint/rules directory
      const rulesDir = join(target.path, ".uilint", "rules");
      actions.push({
        type: "remove_directory",
        path: rulesDir,
      });
    }

    return { actions };
  },
};
