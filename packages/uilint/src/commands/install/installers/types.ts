/**
 * Installer interface - pluggable installation targets
 *
 * Each installer represents a specific feature/integration that can be installed:
 * - ESLint plugin
 * - Next.js overlay
 * - Vite overlay
 * - Cursor commands
 * - Claude Code skills
 *
 * Installers are self-contained and registered via the installer registry.
 */

import type { ProjectState, InstallAction, DependencyInstall } from "../types.js";

/**
 * Represents a specific installation target within an installer
 * For example, ESLint installer might have multiple targets (one per package)
 */
export interface InstallTarget {
  /** Unique ID for this target (e.g., "next-web", "eslint-packages-ui") */
  id: string;
  /** Display label shown in UI (e.g., "apps/web", "packages/ui") */
  label: string;
  /** File system path to the target (e.g., "/path/to/apps/web") */
  path: string;
  /** Optional hint text (e.g., "App Router", "2 configs detected") */
  hint?: string;
  /** Whether this target is already installed/configured */
  isInstalled: boolean;
}

/**
 * Configuration gathered from user prompts (if any)
 * Installers can define their own config shape
 */
export type InstallerConfig = Record<string, unknown>;

/**
 * Progress event emitted during installation
 */
export interface ProgressEvent {
  /** Event type */
  type: "start" | "progress" | "complete" | "error";
  /** Main message (e.g., "Installing uilint-eslint") */
  message: string;
  /** Optional detail/sub-message (e.g., "→ Adding to dependencies") */
  detail?: string;
  /** For error events, the error details */
  error?: string;
}

/**
 * Installer interface
 *
 * Each installer implements detection, configuration, and execution
 * for a specific installation target.
 */
export interface Installer {
  /** Unique installer ID (e.g., "eslint", "next-overlay") */
  id: string;

  /** Display name (e.g., "ESLint Plugin") */
  name: string;

  /** Description shown in UI (e.g., "Lint UI consistency with ESLint rules") */
  description: string;

  /** Emoji/icon for UI (optional) */
  icon?: string;

  /**
   * Check if this installer is applicable to the project
   * @returns true if the installer can run in this project
   */
  isApplicable(project: ProjectState): boolean;

  /**
   * Get all possible installation targets for this installer
   * @returns Array of targets (may be empty if not applicable)
   */
  getTargets(project: ProjectState): InstallTarget[];

  /**
   * Gather additional configuration from user (optional)
   * Only called if user selects this installer
   *
   * @param targets - The selected targets (subset of getTargets())
   * @param project - Full project state
   * @returns Configuration object (can be empty)
   */
  configure?(
    targets: InstallTarget[],
    project: ProjectState
  ): Promise<InstallerConfig>;

  /**
   * Generate installation plan for selected targets
   * Returns actions and dependencies to install
   *
   * @param targets - Selected targets to install
   * @param config - Configuration from configure() step
   * @param project - Full project state
   * @returns Installation actions and dependency installs
   */
  plan(
    targets: InstallTarget[],
    config: InstallerConfig,
    project: ProjectState
  ): {
    actions: InstallAction[];
    dependencies: DependencyInstall[];
  };

  /**
   * Execute installation with progress reporting
   *
   * @param targets - Selected targets
   * @param config - Configuration
   * @param project - Project state
   * @yields Progress events as installation proceeds
   */
  execute(
    targets: InstallTarget[],
    config: InstallerConfig,
    project: ProjectState
  ): AsyncGenerator<ProgressEvent>;
}

/**
 * Simplified installer selection for UI
 */
export interface InstallerSelection {
  /** The installer */
  installer: Installer;
  /** Selected targets (subset of installer.getTargets()) */
  targets: InstallTarget[];
  /** Whether user selected this installer */
  selected: boolean;
}
