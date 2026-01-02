import { existsSync, readdirSync } from "fs";
import { join } from "path";

export interface NextAppRouterDetection {
  /**
   * Relative path to the Next App Router root dir (either "app" or "src/app").
   */
  appRoot: string;
  /**
   * Absolute path to the App Router root dir.
   */
  appRootAbs: string;
  /**
   * Candidate entry files (relative paths) that are good injection targets.
   */
  candidates: string[];
}

function fileExists(projectPath: string, relPath: string): boolean {
  return existsSync(join(projectPath, relPath));
}

export function detectNextAppRouter(
  projectPath: string
): NextAppRouterDetection | null {
  const roots = ["app", join("src", "app")];
  const candidates: string[] = [];

  let chosenRoot: string | null = null;
  for (const root of roots) {
    if (existsSync(join(projectPath, root))) {
      chosenRoot = root;
      break;
    }
  }

  if (!chosenRoot) return null;

  // Prioritize layout files (Next App Router canonical integration point).
  const entryCandidates = [
    join(chosenRoot, "layout.tsx"),
    join(chosenRoot, "layout.jsx"),
    join(chosenRoot, "layout.ts"),
    join(chosenRoot, "layout.js"),
    // Fallbacks (less ideal, but can work):
    join(chosenRoot, "page.tsx"),
    join(chosenRoot, "page.jsx"),
  ];

  for (const rel of entryCandidates) {
    if (fileExists(projectPath, rel)) candidates.push(rel);
  }

  // If nothing exists, still return detection so routes can be installed.
  return {
    appRoot: chosenRoot,
    appRootAbs: join(projectPath, chosenRoot),
    candidates,
  };
}

export interface NextAppRouterProjectMatch {
  /**
   * Absolute path to the Next project root (dir containing app/ or src/app/).
   */
  projectPath: string;
  detection: NextAppRouterDetection;
}

const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  ".turbo",
  ".vercel",
  ".cursor",
  "coverage",
  ".uilint",
]);

/**
 * Best-effort monorepo discovery for Next.js App Router apps.
 *
 * Walks down from `rootDir` looking for directories that contain `app/` or
 * `src/app/`. Skips common large/irrelevant dirs.
 */
export function findNextAppRouterProjects(
  rootDir: string,
  options?: { maxDepth?: number; ignoreDirs?: Set<string> }
): NextAppRouterProjectMatch[] {
  const maxDepth = options?.maxDepth ?? 4;
  const ignoreDirs = options?.ignoreDirs ?? DEFAULT_IGNORE_DIRS;
  const results: NextAppRouterProjectMatch[] = [];
  const visited = new Set<string>();

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    if (visited.has(dir)) return;
    visited.add(dir);

    const detection = detectNextAppRouter(dir);
    if (detection) {
      results.push({ projectPath: dir, detection });
      // Don't descend further once we found a project root (avoid nested hits).
      return;
    }

    let entries: Array<{ name: string; isDirectory: boolean }> = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true }).map((d) => ({
        name: d.name,
        isDirectory: d.isDirectory(),
      }));
    } catch {
      return;
    }

    for (const ent of entries) {
      if (!ent.isDirectory) continue;
      if (ignoreDirs.has(ent.name)) continue;
      // Skip hidden dirs by default (except `src` which matters)
      if (ent.name.startsWith(".") && ent.name !== ".") continue;
      walk(join(dir, ent.name), depth + 1);
    }
  }

  walk(rootDir, 0);
  return results;
}
