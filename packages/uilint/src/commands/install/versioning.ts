import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const require = createRequire(import.meta.url);

export interface ToInstallSpecifierOptions {
  /**
   * When true, prefer pnpm workspace protocol for internal packages so local
   * monorepo installs always link the latest workspace version.
   */
  preferWorkspaceProtocol?: boolean;
  /** Workspace root (used for pnpm-workspace detection) */
  workspaceRoot?: string;
  /** Target project path (used to ensure target is within workspace) */
  targetProjectPath?: string;
}

function isWithinDir(childPath: string, parentPath: string): boolean {
  const parent = parentPath.endsWith("/") ? parentPath : parentPath + "/";
  return childPath === parentPath || childPath.startsWith(parent);
}

function isPnpmWorkspaceRoot(dir: string | undefined): boolean {
  if (!dir) return false;
  return existsSync(join(dir, "pnpm-workspace.yaml"));
}

function workspaceHasPackage(
  workspaceRoot: string | undefined,
  pkgName: string
): boolean {
  if (!workspaceRoot) return false;
  // In this repo, workspace packages live under /packages/<name>/package.json
  return existsSync(join(workspaceRoot, "packages", pkgName, "package.json"));
}

function tryReadInstalledVersion(pkgName: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const depPkg = require(`${pkgName}/package.json`) as Record<
      string,
      unknown
    >;
    const v = depPkg?.version;
    return typeof v === "string" ? v : null;
  } catch {
    // Fallback: try filesystem relative to this package (best-effort)
    try {
      const p = require.resolve(`${pkgName}/package.json`);
      const raw = readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw) as { version?: string };
      return typeof parsed.version === "string" ? parsed.version : null;
    } catch {
      return null;
    }
  }
}

/**
 * Get the version range for a dependency from uilint's package.json
 *
 * Note: We also check devDependencies so we can expose install-time version
 * ranges (e.g. for uilint-react) without forcing them to be runtime deps of the CLI.
 */
export function getSelfDependencyVersionRange(pkgName: string): string | null {
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
    const devDeps = pkgJson?.devDependencies as
      | Record<string, string>
      | undefined;

    const v =
      deps?.[pkgName] ??
      optDeps?.[pkgName] ??
      peerDeps?.[pkgName] ??
      devDeps?.[pkgName];
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Convert package name to install specifier with version (when possible)
 */
export function toInstallSpecifier(
  pkgName: string,
  options: ToInstallSpecifierOptions = {}
): string {
  const { preferWorkspaceProtocol, workspaceRoot, targetProjectPath } = options;

  // Local monorepo: force workspace protocol for internal packages.
  if (
    preferWorkspaceProtocol &&
    isPnpmWorkspaceRoot(workspaceRoot) &&
    typeof targetProjectPath === "string" &&
    isWithinDir(targetProjectPath, workspaceRoot || "") &&
    workspaceHasPackage(workspaceRoot, pkgName)
  ) {
    return `${pkgName}@workspace:*`;
  }

  const range = getSelfDependencyVersionRange(pkgName);
  if (!range) return pkgName;
  if (range.startsWith("workspace:")) {
    // In published builds, pnpm usually rewrites workspace: to a semver range.
    // But if it doesn't, fall back to the actually installed dependency version.
    const installed = tryReadInstalledVersion(pkgName);
    return installed ? `${pkgName}@^${installed}` : pkgName;
  }
  if (range.startsWith("file:")) return pkgName;
  if (range.startsWith("link:")) return pkgName;
  return `${pkgName}@${range}`;
}
