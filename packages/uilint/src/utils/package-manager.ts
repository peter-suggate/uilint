import { existsSync, readFileSync } from "fs";
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
      // Capture output so we can surface it in installer summaries, while still
      // streaming to the user for a good UX.
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const MAX_CAPTURE = 64 * 1024; // keep last 64KB per stream

    child.stdout?.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      stdoutChunks.push(chunk);
      // keep bounded
      while (Buffer.concat(stdoutChunks).length > MAX_CAPTURE) stdoutChunks.shift();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
      stderrChunks.push(chunk);
      while (Buffer.concat(stderrChunks).length > MAX_CAPTURE) stderrChunks.shift();
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const cmd = `${command} ${args.join(" ")}`.trim();
      const stdout = Buffer.concat(stdoutChunks).toString("utf-8").trim();
      const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
      const snippet = (stderr || stdout).trim();

      reject(
        new Error(
          `${cmd} exited with ${code}${
            snippet ? `\n\n--- output ---\n${snippet}\n--- end output ---` : ""
          }`
        )
      );
    });
  });
}

/**
 * Get the set of packages already installed in a project
 * (both dependencies and devDependencies)
 */
function getInstalledPackages(projectPath: string): Set<string> {
  const pkgJsonPath = join(projectPath, "package.json");
  if (!existsSync(pkgJsonPath)) {
    return new Set();
  }

  try {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const installed = new Set<string>();
    if (pkgJson.dependencies) {
      for (const name of Object.keys(pkgJson.dependencies)) {
        installed.add(name);
      }
    }
    if (pkgJson.devDependencies) {
      for (const name of Object.keys(pkgJson.devDependencies)) {
        installed.add(name);
      }
    }
    return installed;
  } catch {
    return new Set();
  }
}

/**
 * Extract package name from a package specifier (e.g., "foo@^1.0.0" -> "foo")
 */
function getPackageName(specifier: string): string {
  // Handle scoped packages like @scope/pkg@version
  if (specifier.startsWith("@")) {
    const slashIndex = specifier.indexOf("/");
    if (slashIndex === -1) return specifier;

    const afterSlash = specifier.slice(slashIndex + 1);
    const atIndex = afterSlash.indexOf("@");
    if (atIndex === -1) return specifier;
    return specifier.slice(0, slashIndex + 1 + atIndex);
  }

  // Handle unscoped packages like pkg@version
  const atIndex = specifier.indexOf("@");
  if (atIndex === -1) return specifier;
  return specifier.slice(0, atIndex);
}

/**
 * Filter out packages that are already installed
 */
function filterAlreadyInstalled(
  packages: string[],
  projectPath: string
): string[] {
  const installed = getInstalledPackages(projectPath);
  return packages.filter((pkg) => {
    const name = getPackageName(pkg);
    return !installed.has(name);
  });
}

export async function installDependencies(
  pm: PackageManager,
  projectPath: string,
  packages: string[],
  options: { dev?: boolean } = { dev: true }
): Promise<void> {
  if (!packages.length) return;

  // Filter out packages that are already installed to avoid yarn/npm errors
  // when trying to add a regular dependency as a dev dependency or vice versa
  const packagesToInstall = filterAlreadyInstalled(packages, projectPath);
  if (!packagesToInstall.length) return;

  const isDev = options.dev ?? true;

  switch (pm) {
    case "pnpm":
      await spawnAsync(
        "pnpm",
        ["add", ...(isDev ? ["-D"] : []), ...packagesToInstall],
        projectPath
      );
      return;
    case "yarn":
      await spawnAsync(
        "yarn",
        ["add", ...(isDev ? ["-D"] : []), ...packagesToInstall],
        projectPath
      );
      return;
    case "bun":
      await spawnAsync(
        "bun",
        ["add", ...(isDev ? ["-d"] : []), ...packagesToInstall],
        projectPath
      );
      return;
    case "npm":
    default:
      await spawnAsync(
        "npm",
        ["install", isDev ? "--save-dev" : "--save", ...packagesToInstall],
        projectPath
      );
      return;
  }
}

/**
 * Get the command and arguments to run tests with coverage
 */
export function getTestCoverageCommand(pm: PackageManager): {
  command: string;
  args: string[];
} {
  switch (pm) {
    case "pnpm":
      return { command: "pnpm", args: ["test", "--", "--coverage"] };
    case "yarn":
      return { command: "yarn", args: ["test", "--coverage"] };
    case "bun":
      return { command: "bun", args: ["test", "--coverage"] };
    case "npm":
    default:
      return { command: "npm", args: ["test", "--", "--coverage"] };
  }
}

/**
 * Run tests with coverage for a project
 */
export async function runTestsWithCoverage(
  pm: PackageManager,
  projectPath: string
): Promise<void> {
  const { command, args } = getTestCoverageCommand(pm);
  await spawnAsync(command, args, projectPath);
}
