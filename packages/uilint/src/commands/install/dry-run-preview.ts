/**
 * Dry-run preview utilities
 *
 * Provides enhanced visual preview of what would be done in dry-run mode
 */

import { pc, note } from "../../utils/prompts.js";
import type { InstallResult, InstallAction } from "./types.js";

/**
 * Display a detailed preview of what would be done in dry-run mode
 *
 * @param result - Installation result from dry-run execution
 */
export function displayDryRunPreview(result: InstallResult): void {
  const preview: string[] = [];

  // Group actions by type
  const fileCreations = result.actionsPerformed.filter(
    (r) => r.action.type === "create_file"
  );
  const fileModifications = result.actionsPerformed.filter(
    (r) =>
      r.action.type === "merge_json" ||
      r.action.type === "append_to_file" ||
      r.action.type === "inject_eslint" ||
      r.action.type === "inject_react" ||
      r.action.type === "inject_next_config" ||
      r.action.type === "inject_vite_config"
  );
  const directoryCreations = result.actionsPerformed.filter(
    (r) => r.action.type === "create_directory"
  );

  // Show directories to be created
  if (directoryCreations.length > 0) {
    preview.push(pc.bold("Directories to create:"));
    for (const action of directoryCreations) {
      if (action.action.type === "create_directory") {
        preview.push(`  ${pc.green("+")} ${action.action.path}`);
      }
    }
    preview.push("");
  }

  // Show files to be created
  if (fileCreations.length > 0) {
    preview.push(pc.bold("Files to create:"));
    for (const action of fileCreations) {
      if (action.action.type === "create_file") {
        const permissions = action.action.permissions
          ? ` ${pc.dim(`(${action.action.permissions.toString(8)})`)}`
          : "";
        preview.push(`  ${pc.green("+")} ${action.action.path}${permissions}`);
      }
    }
    preview.push("");
  }

  // Show files to be modified
  if (fileModifications.length > 0) {
    preview.push(pc.bold("Files to modify:"));
    for (const action of fileModifications) {
      let displayPath = "";
      let description = "";

      switch (action.action.type) {
        case "merge_json":
          displayPath = action.action.path;
          description = "merge JSON";
          break;
        case "append_to_file":
          displayPath = action.action.path;
          description = "append content";
          break;
        case "inject_eslint":
          displayPath = action.action.configPath;
          description = `add ${action.action.rules.length} ESLint rule(s)`;
          break;
        case "inject_react":
          displayPath = `${action.action.projectPath}/${action.action.appRoot}`;
          description = "inject <uilint-devtools />";
          break;
        case "inject_next_config":
          displayPath = `${action.action.projectPath}/next.config.*`;
          description = "wrap with withJsxLoc";
          break;
        case "inject_vite_config":
          displayPath = `${action.action.projectPath}/vite.config.*`;
          description = "add jsxLoc plugin";
          break;
      }

      preview.push(
        `  ${pc.yellow("~")} ${displayPath} ${pc.dim(`(${description})`)}`
      );
    }
    preview.push("");
  }

  // Show dependencies to be installed
  if (result.dependencyResults.length > 0) {
    preview.push(pc.bold("Dependencies to install:"));
    for (const depResult of result.dependencyResults) {
      const { install } = depResult;
      preview.push(
        `  ${pc.cyan("+")} ${install.packagePath} ${pc.dim(`← ${install.packages.join(", ")}`)}`
      );
    }
    preview.push("");
  }

  // Show summary
  const totalActions =
    fileCreations.length +
    fileModifications.length +
    directoryCreations.length;
  preview.push(
    pc.dim(
      `${totalActions} action(s) would be performed, ${result.dependencyResults.length} dependency install(s)`
    )
  );

  note(preview.join("\n"), "Dry Run Preview");
}

/**
 * Get a short description of an action
 *
 * @param action - Installation action
 * @returns Human-readable description
 */
export function getActionDescription(action: InstallAction): string {
  switch (action.type) {
    case "create_file":
      return `Create ${action.path}`;
    case "create_directory":
      return `Create directory ${action.path}`;
    case "merge_json":
      return `Merge JSON into ${action.path}`;
    case "append_to_file":
      return `Append to ${action.path}`;
    case "delete_file":
      return `Delete ${action.path}`;
    case "inject_eslint":
      return `Configure ESLint in ${action.configPath}`;
    case "inject_react":
      return `Install React overlay in ${action.projectPath}`;
    case "inject_next_config":
      return `Configure Next.js in ${action.projectPath}`;
    case "inject_vite_config":
      return `Configure Vite in ${action.projectPath}`;
    case "install_next_routes":
      return `Install Next.js routes in ${action.projectPath}`;
    default:
      return "Unknown action";
  }
}
