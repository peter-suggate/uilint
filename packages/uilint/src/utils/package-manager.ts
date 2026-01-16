import { existsSync } from "fs";
import { spawn } from "child_process";
import { dirname, join } from "path";

export type PackageManager = "pnpm" | "yarn" | "npm" | "bun";

/**
 * Detect which package manager a project uses by looking for lockfiles.
 * Walks up the directory tree to support monorepos.
 */
export function detectPackageManager(projectPath: string): PackageManager {
  // Monorepo-friendly detection: walk up to find the lockfile/workspace marker.
  let dir = projectPath;
  for (;;) {
    // pnpm
    if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return "pnpm";

    // yarn
    if (existsSync(join(dir, "yarn.lock"))) return "yarn";

    // bun
    if (existsSync(join(dir, "bun.lockb"))) return "bun";
    if (existsSync(join(dir, "bun.lock"))) return "bun";

    // npm
    if (existsSync(join(dir, "package-lock.json"))) return "npm";

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Default: npm (best-effort)
  return "npm";
}

function spawnAsync(
  command: string,
  args: string[],
  cwd: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

export async function installDependencies(
  pm: PackageManager,
  projectPath: string,
  packages: string[]
): Promise<void> {
  if (!packages.length) return;

  switch (pm) {
    case "pnpm":
      await spawnAsync("pnpm", ["add", ...packages], projectPath);
      return;
    case "yarn":
      await spawnAsync("yarn", ["add", ...packages], projectPath);
      return;
    case "bun":
      await spawnAsync("bun", ["add", ...packages], projectPath);
      return;
    case "npm":
    default:
      await spawnAsync("npm", ["install", "--save", ...packages], projectPath);
      return;
  }
}
