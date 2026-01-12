import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

export interface ViteReactDetection {
  /**
   * Relative path to the Vite config file (e.g. "vite.config.ts").
   */
  configFile: string;
  /**
   * Absolute path to the Vite config file.
   */
  configFileAbs: string;
  /**
   * Relative path to the source root (usually "src").
   */
  entryRoot: string;
  /**
   * Candidate entry files (relative paths) that are good injection targets.
   * For Vite+React this is usually `src/main.*`.
   */
  candidates: string[];
}

const VITE_CONFIG_EXTS = [".ts", ".mjs", ".js", ".cjs"];

function findViteConfigFile(projectPath: string): string | null {
  for (const ext of VITE_CONFIG_EXTS) {
    const rel = `vite.config${ext}`;
    if (existsSync(join(projectPath, rel))) return rel;
  }
  return null;
}

function looksLikeReactPackage(projectPath: string): boolean {
  try {
    const pkgPath = join(projectPath, "package.json");
    if (!existsSync(pkgPath)) return false;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    return "react" in deps || "react-dom" in deps;
  } catch {
    return false;
  }
}

function fileExists(projectPath: string, relPath: string): boolean {
  return existsSync(join(projectPath, relPath));
}

export function detectViteReact(projectPath: string): ViteReactDetection | null {
  const configFile = findViteConfigFile(projectPath);
  if (!configFile) return null;

  // Overlay integration currently targets React apps.
  if (!looksLikeReactPackage(projectPath)) return null;

  // Prefer Vite defaults: src/main.(tsx|jsx|ts|js)
  const entryRoot = "src";
  const candidates: string[] = [];
  const entryCandidates = [
    join(entryRoot, "main.tsx"),
    join(entryRoot, "main.jsx"),
    join(entryRoot, "main.ts"),
    join(entryRoot, "main.js"),
  ];

  for (const rel of entryCandidates) {
    if (fileExists(projectPath, rel)) candidates.push(rel);
  }

  // If no main.* exists, try common fallbacks (some templates render in App.tsx)
  const fallbackCandidates = [
    join(entryRoot, "App.tsx"),
    join(entryRoot, "App.jsx"),
  ];
  for (const rel of fallbackCandidates) {
    if (!candidates.includes(rel) && fileExists(projectPath, rel)) {
      candidates.push(rel);
    }
  }

  return {
    configFile,
    configFileAbs: join(projectPath, configFile),
    entryRoot,
    candidates,
  };
}

export interface ViteReactProjectMatch {
  /**
   * Absolute path to the Vite project root (dir containing vite.config.*).
   */
  projectPath: string;
  detection: ViteReactDetection;
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
 * Best-effort monorepo discovery for Vite + React apps.
 *
 * Walks down from `rootDir` looking for directories that contain `vite.config.*`
 * and whose package.json looks like a React project.
 */
export function findViteReactProjects(
  rootDir: string,
  options?: { maxDepth?: number; ignoreDirs?: Set<string> }
): ViteReactProjectMatch[] {
  const maxDepth = options?.maxDepth ?? 4;
  const ignoreDirs = options?.ignoreDirs ?? DEFAULT_IGNORE_DIRS;
  const results: ViteReactProjectMatch[] = [];
  const visited = new Set<string>();

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    if (visited.has(dir)) return;
    visited.add(dir);

    const detection = detectViteReact(dir);
    if (detection) {
      results.push({ projectPath: dir, detection });
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
      if (ent.name.startsWith(".") && ent.name !== ".") continue;
      walk(join(dir, ent.name), depth + 1);
    }
  }

  walk(rootDir, 0);
  return results;
}
