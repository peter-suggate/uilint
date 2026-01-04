/**
 * Resolve the workspace/repo root from an arbitrary starting directory.
 *
 * This is primarily used in monorepos where runtime `process.cwd()` may point at
 * a sub-app (e.g. `apps/web`) but UI linting assets live at the workspace root.
 */
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";

function hasWorkspacesField(dir: string): boolean {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return false;
  try {
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as { workspaces?: unknown };
    return !!pkg.workspaces;
  } catch {
    return false;
  }
}

function hasRootMarker(dir: string): boolean {
  // pnpm is the primary supported monorepo layout in this repo
  if (existsSync(join(dir, "pnpm-workspace.yaml"))) return true;
  // fallbacks for other setups
  if (existsSync(join(dir, ".git"))) return true;
  if (hasWorkspacesField(dir)) return true;
  return false;
}

/**
 * Walks up from `startDir` to find a likely workspace root.
 *
 * If none is found, returns `startDir`.
 */
export function findWorkspaceRoot(startDir: string): string {
  let dir = startDir;
  let lastFallback: string | null = null;

  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;

    if (hasRootMarker(dir)) {
      // keep walking to prefer the highest-level marker (esp. .git)
      lastFallback = dir;
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return lastFallback || startDir;
}

