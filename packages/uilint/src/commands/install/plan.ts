/**
 * Plan phase - pure function generating InstallPlan from state + choices
 *
 * This function has NO I/O whatsoever. It takes the analyzed ProjectState,
 * user choices, and options, then returns an InstallPlan describing exactly
 * what actions to take.
 */

import { join } from "path";
import { createRequire } from "module";
import type { RuleMetadata } from "uilint-eslint";
import type {
  ProjectState,
  UserChoices,
  InstallPlan,
  InstallAction,
  DependencyInstall,
  PlanOptions,
} from "./types.js";
import {
  GENSTYLEGUIDE_COMMAND_MD,
} from "./constants.js";
import { loadSkill } from "../../utils/skill-loader.js";
import { loadSelectedRules } from "../../utils/rule-loader.js";
import { detectPackageManager } from "../../utils/package-manager.js";

const require = createRequire(import.meta.url);

/**
 * Get the version range for a dependency from uilint's package.json
 */
function getSelfDependencyVersionRange(pkgName: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const pkgJson = require("uilint/package.json") as Record<string, unknown>;
    const deps = pkgJson?.dependencies as Record<string, string> | undefined;
    const optDeps = pkgJson?.optionalDependencies as
      | Record<string, string>
      | undefined;
    const peerDeps = pkgJson?.peerDependencies as
      | Record<string, string>
      | undefined;
    const v = deps?.[pkgName] ?? optDeps?.[pkgName] ?? peerDeps?.[pkgName];
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Convert package name to install specifier with version
 */
function toInstallSpecifier(pkgName: string): string {
  const range = getSelfDependencyVersionRange(pkgName);
  if (!range) return pkgName;
  if (range.startsWith("workspace:")) return pkgName;
  if (range.startsWith("file:")) return pkgName;
  if (range.startsWith("link:")) return pkgName;
  return `${pkgName}@${range}`;
}

/**
 * Create the install plan from project state and user choices
 *
 * @param state - The analyzed project state
 * @param choices - User's installation choices
 * @param options - Planning options (force, etc.)
 * @returns InstallPlan with all actions and dependencies
 */
export function createPlan(
  state: ProjectState,
  choices: UserChoices,
  options: PlanOptions = {}
): InstallPlan {
  const actions: InstallAction[] = [];
  const dependencies: DependencyInstall[] = [];

  const { force = false } = options;
  const { items } = choices;

  // Ensure .cursor directory exists if needed
  const needsCursorDir =
    items.includes("genstyleguide") ||
    items.includes("skill");

  if (needsCursorDir && !state.cursorDir.exists) {
    actions.push({
      type: "create_directory",
      path: state.cursorDir.path,
    });
  }

  // =========================================================================
  // Genstyleguide Command
  // =========================================================================
  if (items.includes("genstyleguide")) {
    const commandsDir = join(state.cursorDir.path, "commands");

    actions.push({
      type: "create_directory",
      path: commandsDir,
    });

    actions.push({
      type: "create_file",
      path: join(commandsDir, "genstyleguide.md"),
      content: GENSTYLEGUIDE_COMMAND_MD,
    });
  }

  // =========================================================================
  // Agent Skill Installation
  // =========================================================================
  if (items.includes("skill")) {
    const skillsDir = join(state.cursorDir.path, "skills");

    // Create skills directory
    actions.push({
      type: "create_directory",
      path: skillsDir,
    });

    // Load and install the ui-consistency-enforcer skill
    try {
      const skill = loadSkill("ui-consistency-enforcer");
      const skillDir = join(skillsDir, skill.name);

      // Create skill directory
      actions.push({
        type: "create_directory",
        path: skillDir,
      });

      // Create all skill files
      for (const file of skill.files) {
        const filePath = join(skillDir, file.relativePath);

        // Ensure subdirectories exist (e.g., references/)
        const fileDir = join(
          skillDir,
          file.relativePath.split("/").slice(0, -1).join("/")
        );
        if (fileDir !== skillDir && file.relativePath.includes("/")) {
          actions.push({
            type: "create_directory",
            path: fileDir,
          });
        }

        actions.push({
          type: "create_file",
          path: filePath,
          content: file.content,
        });
      }
    } catch {
      // Skill not found - skip silently (shouldn't happen in normal install)
    }
  }

  // =========================================================================
  // Next.js Overlay Installation
  // =========================================================================
  if (items.includes("next") && choices.next) {
    const { projectPath, detection } = choices.next;

    // Install Next.js routes
    actions.push({
      type: "install_next_routes",
      projectPath,
      appRoot: detection.appRoot,
    });

    // Install React overlay dependencies using the package manager for this specific target
    dependencies.push({
      packagePath: projectPath,
      packageManager: detectPackageManager(projectPath),
      packages: ["uilint-react", "uilint-core", "jsx-loc-plugin"],
    });

    // Inject <uilint-devtools /> web component into React
    actions.push({
      type: "inject_react",
      projectPath,
      appRoot: detection.appRoot,
    });

    // Inject jsx-loc-plugin into next.config
    actions.push({
      type: "inject_next_config",
      projectPath,
    });
  }

  // =========================================================================
  // Vite Overlay Installation
  // =========================================================================
  if (items.includes("vite") && choices.vite) {
    const { projectPath, detection } = choices.vite;

    // Install React overlay dependencies using the package manager for this specific target
    dependencies.push({
      packagePath: projectPath,
      packageManager: detectPackageManager(projectPath),
      packages: ["uilint-react", "uilint-core", "jsx-loc-plugin"],
    });

    // Inject <uilint-devtools /> web component into React entry
    actions.push({
      type: "inject_react",
      projectPath,
      appRoot: detection.entryRoot,
      mode: "vite",
    });

    // Inject jsx-loc-plugin into vite.config
    actions.push({
      type: "inject_vite_config",
      projectPath,
    });
  }

  // =========================================================================
  // ESLint Plugin Installation
  // =========================================================================
  if (items.includes("eslint") && choices.eslint) {
    const { packagePaths, selectedRules } = choices.eslint;

    for (const pkgPath of packagePaths) {
      const pkgInfo = state.packages.find((p) => p.path === pkgPath);

      // Create .uilint/rules directory alongside the target app (not at workspace root)
      const rulesDir = join(pkgPath, ".uilint", "rules");
      actions.push({
        type: "create_directory",
        path: rulesDir,
      });

      // Load and copy rule files into this target package
      // Use TypeScript rule files if the ESLint config is TypeScript (.ts)
      // This ensures the imports match the actual rule files being copied
      const isTypeScriptConfig = pkgInfo?.eslintConfigPath?.endsWith(".ts") ?? false;
      const ruleFiles = loadSelectedRules(
        selectedRules.map((r) => r.id),
        {
          typescript: isTypeScriptConfig,
        }
      );
      for (const ruleFile of ruleFiles) {
        // Copy implementation file
        actions.push({
          type: "create_file",
          path: join(rulesDir, ruleFile.implementation.relativePath),
          content: ruleFile.implementation.content,
        });

        // Copy test file if it exists (only for TypeScript configs)
        if (ruleFile.test && isTypeScriptConfig) {
          actions.push({
            type: "create_file",
            path: join(rulesDir, ruleFile.test.relativePath),
            content: ruleFile.test.content,
          });
        }
      }

      // Install dependencies using the package manager for this specific target
      dependencies.push({
        packagePath: pkgPath,
        packageManager: detectPackageManager(pkgPath),
        packages: [toInstallSpecifier("uilint-eslint"), "typescript-eslint"],
      });

      // Inject ESLint rules (will reference local .uilint/rules/ files)
      if (pkgInfo?.eslintConfigPath) {
        actions.push({
          type: "inject_eslint",
          packagePath: pkgPath,
          configPath: pkgInfo.eslintConfigPath,
          rules: selectedRules,
          hasExistingRules: pkgInfo.hasUilintRules,
        });
      }
    }

    // Add .uilint/.cache to .gitignore at workspace root
    const gitignorePath = join(state.workspaceRoot, ".gitignore");
    actions.push({
      type: "append_to_file",
      path: gitignorePath,
      content: "\n# UILint cache\n.uilint/.cache\n",
      ifNotContains: ".uilint/.cache",
    });
  }

  return { actions, dependencies };
}

/**
 * Get the list of rules that are missing from a package's ESLint config
 */
export function getMissingRules(
  configuredRuleIds: string[],
  selectedRules: RuleMetadata[]
): RuleMetadata[] {
  const configuredSet = new Set(configuredRuleIds);
  return selectedRules.filter((rule) => !configuredSet.has(rule.id));
}
