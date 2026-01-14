/**
 * Type definitions for the install command
 *
 * The install process is split into three phases:
 * 1. Analyze - scan project, return ProjectState
 * 2. Plan - pure function generating InstallPlan from state + choices
 * 3. Execute - perform side effects, support dryRun
 */

import type { RuleMetadata } from "uilint-eslint";
import type { NextAppRouterDetection } from "../../utils/next-detect.js";
import type { ViteReactDetection } from "../../utils/vite-detect.js";
import type { PackageInfo } from "../../utils/package-detect.js";
import type { PackageManager } from "../../utils/package-manager.js";

// ============================================================================
// Phase 1: Analyze - ProjectState
// ============================================================================

export interface NextAppInfo {
  projectPath: string;
  detection: NextAppRouterDetection;
}

export interface ViteAppInfo {
  projectPath: string;
  detection: ViteReactDetection;
}

export interface EslintPackageInfo extends PackageInfo {
  /** Path to eslint config file if found */
  eslintConfigPath: string | null;
  /** Filename of eslint config (e.g., "eslint.config.mjs") */
  eslintConfigFilename: string | null;
  /** Whether config already has uilint rules */
  hasUilintRules: boolean;
  /** IDs of uilint rules already configured */
  configuredRuleIds: string[];
  /** Whether this package uses TypeScript (inherited from PackageInfo) */
  isTypeScript: boolean;
}

export interface ProjectState {
  /** Current working directory */
  projectPath: string;
  /** Workspace root (may differ in monorepos) */
  workspaceRoot: string;
  /** Detected package manager */
  packageManager: PackageManager;

  /** .cursor directory state */
  cursorDir: {
    exists: boolean;
    path: string;
  };

  /** Styleguide state */
  styleguide: {
    exists: boolean;
    path: string;
  };

  /** Cursor commands state */
  commands: {
    genstyleguide: boolean;
  };

  /** Detected Next.js App Router projects */
  nextApps: NextAppInfo[];

  /** Detected Vite + React projects */
  viteApps: ViteAppInfo[];

  /** All packages with ESLint info */
  packages: EslintPackageInfo[];
}

// ============================================================================
// User Choices (gathered via prompts or CLI flags)
// ============================================================================

export type InstallItem =
  | "genstyleguide"
  | "skill"
  | "next"
  | "vite"
  | "eslint";

export interface EslintChoices {
  /** Package paths to install ESLint plugin into */
  packagePaths: string[];
  /** Selected rule metadata (may have customized options) */
  selectedRules: RuleMetadata[];
}

export interface NextChoices {
  /** Selected Next.js app project path */
  projectPath: string;
  /** Detection info for the selected app */
  detection: NextAppRouterDetection;
}

export interface ViteChoices {
  /** Selected Vite app project path */
  projectPath: string;
  /** Detection info for the selected Vite app */
  detection: ViteReactDetection;
}

export interface UserChoices {
  /** Items selected for installation */
  items: InstallItem[];
  /** ESLint-specific choices (if eslint selected) */
  eslint?: EslintChoices;
  /** Next.js-specific choices (if next selected) */
  next?: NextChoices;
  /** Vite-specific choices (if vite selected) */
  vite?: ViteChoices;
}

// ============================================================================
// Phase 2: Plan - InstallPlan
// ============================================================================

export interface CreateFileAction {
  type: "create_file";
  path: string;
  content: string;
  /** Unix file permissions (e.g., 0o755 for executable) */
  permissions?: number;
}

export interface MergeJsonAction {
  type: "merge_json";
  path: string;
  /** Object to deep merge into existing JSON */
  merge: Record<string, unknown>;
}

export interface DeleteFileAction {
  type: "delete_file";
  path: string;
}

export interface InjectEslintAction {
  type: "inject_eslint";
  packagePath: string;
  configPath: string;
  rules: RuleMetadata[];
  /** Whether config already has some uilint rules (add missing only) */
  hasExistingRules: boolean;
}

export interface InjectReactAction {
  type: "inject_react";
  projectPath: string;
  /**
   * For Next.js: "app" or "src/app"
   * For Vite: typically "src"
   */
  appRoot: string;
  /** Injection mode: defaults to "next" for backwards compatibility */
  mode?: "next" | "vite";
}

export interface InjectNextConfigAction {
  type: "inject_next_config";
  projectPath: string;
}

export interface InjectViteConfigAction {
  type: "inject_vite_config";
  projectPath: string;
}

export interface InstallNextRoutesAction {
  type: "install_next_routes";
  projectPath: string;
  appRoot: string;
}

export interface CreateDirectoryAction {
  type: "create_directory";
  path: string;
}

export interface AppendToFileAction {
  type: "append_to_file";
  path: string;
  content: string;
  /** Only append if this string is not already in the file */
  ifNotContains?: string;
}

export type InstallAction =
  | CreateFileAction
  | MergeJsonAction
  | DeleteFileAction
  | InjectEslintAction
  | InjectReactAction
  | InjectNextConfigAction
  | InjectViteConfigAction
  | InstallNextRoutesAction
  | CreateDirectoryAction
  | AppendToFileAction;

export interface DependencyInstall {
  packagePath: string;
  packageManager: PackageManager;
  packages: string[];
}

export interface InstallPlan {
  actions: InstallAction[];
  dependencies: DependencyInstall[];
}

// ============================================================================
// Phase 3: Execute - InstallResult
// ============================================================================

export interface ActionResult {
  action: InstallAction;
  success: boolean;
  error?: string;
  /** For dry run, what would have been done */
  wouldDo?: string;
}

export interface DependencyResult {
  install: DependencyInstall;
  success: boolean;
  error?: string;
  skipped?: boolean;
}

export interface InstallSummary {
  /** Items that were installed */
  installedItems: InstallItem[];
  /** Files created */
  filesCreated: string[];
  /** Files modified */
  filesModified: string[];
  /** Files deleted */
  filesDeleted: string[];
  /** Dependencies installed per package */
  dependenciesInstalled: { packagePath: string; packages: string[] }[];
  /** ESLint targets configured */
  eslintTargets: { displayName: string; configFile: string }[];
  /** Next.js app configured (if any) */
  nextApp?: { appRoot: string };
  /** Vite app configured (if any) */
  viteApp?: { entryRoot: string };
}

export interface InstallResult {
  success: boolean;
  actionsPerformed: ActionResult[];
  dependencyResults: DependencyResult[];
  summary: InstallSummary;
}

// ============================================================================
// Options
// ============================================================================

export interface InstallOptions {
  force?: boolean;
  // Non-interactive selections
  genstyleguide?: boolean;
  routes?: boolean;
  react?: boolean;
  eslint?: boolean;
  skill?: boolean;
}

export interface PlanOptions {
  force?: boolean;
}

export interface ExecuteOptions {
  dryRun?: boolean;
  /** Injectable dependency installer (for testing) */
  installDependencies?: (
    pm: PackageManager,
    projectPath: string,
    packages: string[]
  ) => Promise<void>;
  /** Suppress spinner/logging output */
  quiet?: boolean;
  /** Project path for prettier formatting (optional) */
  projectPath?: string;
  /** Skip prettier formatting (default: false) */
  skipPrettier?: boolean;
}
