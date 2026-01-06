import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export interface InstallReactOverlayOptions {
  projectPath: string;
  /**
   * Relative app root: "app" or "src/app"
   */
  appRoot: string;
  force?: boolean;
  confirmOverwrite?: (relPath: string) => Promise<boolean>;
  /**
   * If multiple candidates are found, prompt user to choose.
   */
  confirmFileChoice?: (choices: string[]) => Promise<string>;
}

/**
 * Find top-level layout.* or page.* files in the app root.
 * Prefer layout.* over page.* (layouts are better for providers).
 */
function getDefaultCandidates(projectPath: string, appRoot: string): string[] {
  // Check layout files first (preferred)
  const layoutCandidates = [
    join(appRoot, "layout.tsx"),
    join(appRoot, "layout.jsx"),
    join(appRoot, "layout.ts"),
    join(appRoot, "layout.js"),
  ];

  const existingLayouts = layoutCandidates.filter((rel) =>
    existsSync(join(projectPath, rel))
  );

  if (existingLayouts.length > 0) {
    return existingLayouts;
  }

  // Fall back to page files if no layouts found
  const pageCandidates = [join(appRoot, "page.tsx"), join(appRoot, "page.jsx")];

  return pageCandidates.filter((rel) => existsSync(join(projectPath, rel)));
}

function ensureUILintProviderImport(source: string): string {
  if (
    source.includes('from "uilint-react"') ||
    source.includes("from 'uilint-react'")
  ) {
    // Check if UILintProvider is imported
    if (source.includes("UILintProvider")) {
      return source;
    }
    // Add UILintProvider to existing import
    return source.replace(
      /import\s*{([^}]*?)}\s*from\s*["']uilint-react["']/,
      (match, imports) => {
        const trimmedImports = imports.trim();
        if (trimmedImports) {
          return `import { ${trimmedImports}, UILintProvider } from "uilint-react"`;
        }
        return `import { UILintProvider } from "uilint-react"`;
      }
    );
  }

  const importLine = `import { UILintProvider } from "uilint-react";\n`;

  // Keep "use client" first if present.
  const useClientMatch = source.match(/^["']use client["'];\s*\n/);
  const startIdx = useClientMatch ? useClientMatch[0].length : 0;

  // Insert after last import statement in the header region.
  const header = source.slice(0, Math.min(source.length, 5000));
  const importRegex = /^import[\s\S]*?;\s*$/gm;
  let lastImportEnd = -1;
  for (const m of header.matchAll(importRegex)) {
    lastImportEnd = (m.index ?? 0) + m[0].length;
  }

  if (lastImportEnd !== -1) {
    const absoluteEnd = lastImportEnd;
    return (
      source.slice(0, absoluteEnd) +
      "\n" +
      importLine +
      source.slice(absoluteEnd)
    );
  }

  return source.slice(0, startIdx) + importLine + source.slice(startIdx);
}

function wrapChildrenWithUILintProvider(source: string): string {
  if (source.includes("<UILintProvider")) return source;
  const marker = "{children}";
  const idx = source.indexOf(marker);
  if (idx === -1) {
    throw new Error("Could not find `{children}` in target file to wrap.");
  }

  const wrapperStart = `<UILintProvider enabled={process.env.NODE_ENV !== "production"}>
          `;
  const wrapperEnd = `
        </UILintProvider>`;

  return (
    source.slice(0, idx) +
    wrapperStart +
    marker +
    wrapperEnd +
    source.slice(idx + marker.length)
  );
}

export async function installReactUILintOverlay(
  opts: InstallReactOverlayOptions
): Promise<{ targetFile: string }> {
  const candidates = getDefaultCandidates(opts.projectPath, opts.appRoot);
  if (!candidates.length) {
    throw new Error(
      `No suitable Next.js entry files found under ${opts.appRoot} (expected layout.* or page.*).`
    );
  }

  let chosen: string;

  // If there are multiple candidates, ask user to choose
  if (candidates.length > 1 && opts.confirmFileChoice) {
    chosen = await opts.confirmFileChoice(candidates);
  } else {
    // Single candidate - use it
    chosen = candidates[0]!;
  }

  const absTarget = join(opts.projectPath, chosen);
  const original = readFileSync(absTarget, "utf-8");

  if (
    original.includes("<UILintProvider") ||
    original.includes('from "uilint-react"')
  ) {
    if (!opts.force) {
      const ok = await opts.confirmOverwrite?.(chosen);
      if (!ok) return { targetFile: chosen };
    }
  }

  let updated = original;
  updated = ensureUILintProviderImport(updated);
  updated = wrapChildrenWithUILintProvider(updated);

  if (updated !== original) {
    writeFileSync(absTarget, updated, "utf-8");
  }

  return { targetFile: chosen };
}
