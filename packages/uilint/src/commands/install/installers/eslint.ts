/**
 * ESLint installer - UILint ESLint plugin configuration
 */

import { join } from "path";
import { ruleRegistry } from "uilint-eslint";
import type { Installer, InstallTarget, InstallerConfig, ProgressEvent } from "./types.js";
import type { ProjectState, InstallAction, DependencyInstall, EslintPackageInfo } from "../types.js";
import type { RuleMetadata } from "uilint-eslint";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

function toInstallSpecifier(pkgName: string): string {
  // Simplified - just return package name for now
  return pkgName;
}

export interface ESLintInstallerConfig extends InstallerConfig {
  /** Selected rules to install */
  selectedRules: RuleMetadata[];
}

export const eslintInstaller: Installer = {
  id: "eslint",
  name: "ESLint plugin",
  description: "Lint UI consistency with ESLint rules",
  icon: "🔍",

  isApplicable(project: ProjectState): boolean {
    // Applicable if there's at least one package with ESLint config
    return project.packages.some((pkg) => pkg.eslintConfigPath !== null);
  },

  getTargets(project: ProjectState): InstallTarget[] {
    return project.packages
      .filter((pkg) => pkg.eslintConfigPath !== null)
      .map((pkg) => ({
        id: `eslint-${pkg.name}`,
        label: pkg.name,
        path: pkg.path,
        hint: pkg.eslintConfigFilename || "ESLint config detected",
        isInstalled: pkg.hasUilintRules,
      }));
  },

  async configure(
    targets: InstallTarget[],
    project: ProjectState
  ): Promise<ESLintInstallerConfig> {
    // For now, just select all rules by default
    // TODO: Add interactive rule selection via @clack/prompts
    const selectedRules = ruleRegistry;

    return {
      selectedRules,
    };
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
    const { selectedRules } = eslintConfig;

    for (const target of targets) {
      const pkgInfo = project.packages.find((p) => p.path === target.path);
      if (!pkgInfo || !pkgInfo.eslintConfigPath) continue;

      // Create .uilint/rules directory
      const rulesDir = join(target.path, ".uilint", "rules");
      actions.push({
        type: "create_directory",
        path: rulesDir,
      });

      // Install dependencies
      dependencies.push({
        packagePath: target.path,
        packageManager: project.packageManager,
        packages: [toInstallSpecifier("uilint-eslint"), "typescript-eslint"],
      });

      // Inject ESLint rules
      actions.push({
        type: "inject_eslint",
        packagePath: target.path,
        configPath: pkgInfo.eslintConfigPath,
        rules: selectedRules,
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
        message: `Injecting ${eslintConfig.selectedRules.length} rules`,
        detail: `→ ${target.hint}`,
      };
    }

    yield {
      type: "complete",
      message: `ESLint plugin installed in ${targets.length} package(s)`,
    };
  },
};
