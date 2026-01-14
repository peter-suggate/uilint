/**
 * Prettier formatting utilities
 *
 * Formats files using the target project's prettier if available.
 * Falls back gracefully if prettier is not installed.
 */

import { existsSync } from "fs";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { detectPackageManager, type PackageManager } from "./package-manager.js";

/**
 * Check if prettier is available in the target project
 */
export function hasPrettier(projectPath: string): boolean {
  // Check for prettier in node_modules
  const prettierPath = join(projectPath, "node_modules", ".bin", "prettier");
  if (existsSync(prettierPath)) return true;

  // Walk up to find prettier (monorepo support)
  let dir = projectPath;
  for (let i = 0; i < 10; i++) {
    const binPath = join(dir, "node_modules", ".bin", "prettier");
    if (existsSync(binPath)) return true;

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return false;
}

/**
 * Get the prettier executable path for the project
 */
function getPrettierPath(projectPath: string): string | null {
  // Check local first
  const localPath = join(projectPath, "node_modules", ".bin", "prettier");
  if (existsSync(localPath)) return localPath;

  // Walk up for monorepo
  let dir = projectPath;
  for (let i = 0; i < 10; i++) {
    const binPath = join(dir, "node_modules", ".bin", "prettier");
    if (existsSync(binPath)) return binPath;

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Get the package manager runner command (npx, pnpm exec, yarn, bunx)
 */
function getPmRunner(pm: PackageManager): { command: string; args: string[] } {
  switch (pm) {
    case "pnpm":
      return { command: "pnpm", args: ["exec"] };
    case "yarn":
      return { command: "yarn", args: [] };
    case "bun":
      return { command: "bunx", args: [] };
    case "npm":
    default:
      return { command: "npx", args: [] };
  }
}

/**
 * Format a file using prettier
 *
 * @param filePath - Absolute path to the file to format
 * @param projectPath - Project root (used to find prettier config)
 * @returns Promise that resolves when formatting is complete
 */
export async function formatWithPrettier(
  filePath: string,
  projectPath: string
): Promise<{ formatted: boolean; error?: string }> {
  const prettierPath = getPrettierPath(projectPath);

  if (!prettierPath) {
    // Try using package manager runner as fallback
    const pm = detectPackageManager(projectPath);
    const runner = getPmRunner(pm);

    return new Promise((resolve) => {
      const args = [...runner.args, "prettier", "--write", filePath];
      const child = spawn(runner.command, args, {
        cwd: projectPath,
        stdio: "pipe",
        shell: process.platform === "win32",
      });

      let stderr = "";
      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("error", () => {
        // Prettier not available, that's OK
        resolve({ formatted: false, error: "prettier not available" });
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ formatted: true });
        } else {
          // Non-zero exit could mean prettier isn't installed
          resolve({ formatted: false, error: stderr || "prettier failed" });
        }
      });
    });
  }

  return new Promise((resolve) => {
    const child = spawn(prettierPath, ["--write", filePath], {
      cwd: projectPath,
      stdio: "pipe",
      shell: process.platform === "win32",
    });

    let stderr = "";
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      resolve({ formatted: false, error: err.message });
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ formatted: true });
      } else {
        resolve({ formatted: false, error: stderr || `exit code ${code}` });
      }
    });
  });
}

/**
 * Format multiple files using prettier
 *
 * @param filePaths - Array of absolute file paths to format
 * @param projectPath - Project root (used to find prettier config)
 * @returns Promise that resolves when all formatting is complete
 */
export async function formatFilesWithPrettier(
  filePaths: string[],
  projectPath: string
): Promise<{ formatted: string[]; failed: string[] }> {
  if (filePaths.length === 0) {
    return { formatted: [], failed: [] };
  }

  const prettierPath = getPrettierPath(projectPath);
  const formatted: string[] = [];
  const failed: string[] = [];

  if (!prettierPath) {
    // Try using package manager runner
    const pm = detectPackageManager(projectPath);
    const runner = getPmRunner(pm);

    return new Promise((resolve) => {
      const args = [...runner.args, "prettier", "--write", ...filePaths];
      const child = spawn(runner.command, args, {
        cwd: projectPath,
        stdio: "pipe",
        shell: process.platform === "win32",
      });

      child.on("error", () => {
        // Prettier not available
        resolve({ formatted: [], failed: filePaths });
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ formatted: filePaths, failed: [] });
        } else {
          resolve({ formatted: [], failed: filePaths });
        }
      });
    });
  }

  // Format all files in one prettier call for efficiency
  return new Promise((resolve) => {
    const child = spawn(prettierPath, ["--write", ...filePaths], {
      cwd: projectPath,
      stdio: "pipe",
      shell: process.platform === "win32",
    });

    child.on("error", () => {
      resolve({ formatted: [], failed: filePaths });
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ formatted: filePaths, failed: [] });
      } else {
        // If batch fails, try individual files
        Promise.all(
          filePaths.map(async (fp) => {
            const result = await formatWithPrettier(fp, projectPath);
            if (result.formatted) {
              formatted.push(fp);
            } else {
              failed.push(fp);
            }
          })
        ).then(() => {
          resolve({ formatted, failed });
        });
      }
    });
  });
}
