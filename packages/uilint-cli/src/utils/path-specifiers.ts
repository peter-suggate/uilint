/**
 * Path specifier utilities for CLI.
 *
 * We support "workspace-relative" specifiers using a leading "@", e.g.:
 * - @apps/test-app/app/page.tsx
 * - @apps/test-app/.uilint/styleguide.md
 *
 * This mirrors how some tools (and humans) refer to "repo-relative" paths.
 */

import { isAbsolute, resolve } from "path";
import { findWorkspaceRoot } from "uilint-core/node";

/**
 * Resolve a user-provided path specifier into an absolute filesystem path.
 *
 * Rules:
 * - Absolute paths are left absolute (normalized with resolve()).
 * - "@<path>" is resolved relative to the workspace root (pnpm-workspace/.git).
 * - Everything else is resolved relative to cwd.
 */
export function resolvePathSpecifier(
  spec: string,
  cwd: string = process.cwd()
): string {
  const raw = (spec ?? "").trim();
  if (!raw) return resolve(cwd, spec);

  if (raw.startsWith("@")) {
    const workspaceRoot = findWorkspaceRoot(cwd);
    let rest = raw.slice(1);
    if (rest.startsWith("/")) rest = rest.slice(1);
    // Note: resolve(workspaceRoot, rest) is safe even if rest contains "..";
    // callers that need a security boundary should validate separately.
    return resolve(workspaceRoot, rest);
  }

  if (isAbsolute(raw)) return resolve(raw);
  return resolve(cwd, raw);
}
