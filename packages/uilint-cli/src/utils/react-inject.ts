import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ensureOllamaReady } from "uilint-core/node";
import { createLLMClient } from "./llm-client.js";

export interface InstallReactOverlayOptions {
  projectPath: string;
  /**
   * Relative app root: "app" or "src/app"
   */
  appRoot: string;
  model?: string;
  force?: boolean;
  confirmOverwrite?: (relPath: string) => Promise<boolean>;
  /**
   * Always used to confirm the target file (even if there's only one candidate).
   */
  confirmFileChoice?: (choices: string[]) => Promise<string>;
}

function getDefaultCandidates(projectPath: string, appRoot: string): string[] {
  const candidates = [
    join(appRoot, "layout.tsx"),
    join(appRoot, "layout.jsx"),
    join(appRoot, "layout.ts"),
    join(appRoot, "layout.js"),
    join(appRoot, "page.tsx"),
    join(appRoot, "page.jsx"),
  ];
  return candidates.filter((rel) => existsSync(join(projectPath, rel)));
}

function buildFileSelectionPrompt(
  candidates: Array<{ path: string; preview: string }>
): string {
  const serialized = candidates
    .map((c) => `### ${c.path}\n` + "```tsx\n" + c.preview + "\n```\n")
    .join("\n");

  return `You are helping install a React dev overlay component into a Next.js App Router project.

Choose the SINGLE best file to inject a <UILintProvider> wrapper into, from the list below.

Rules:
- You MUST pick exactly one of the provided file paths.
- Prefer app/layout.* over page.*.
- Prefer the top-level layout that wraps the whole app (the one containing {children} in the body).
- Respond ONLY with JSON: { "targetFile": "<one-of-the-paths>", "reason": "<short>" }

Candidates:
${serialized}`;
}

function tryParseJSON<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
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
): Promise<{ targetFile: string; usedLLM: boolean }> {
  const candidates = getDefaultCandidates(opts.projectPath, opts.appRoot);
  if (!candidates.length) {
    throw new Error(
      `No suitable Next.js entry files found under ${opts.appRoot} (expected layout.* or page.*).`
    );
  }

  let usedLLM = false;
  let chosen: string = candidates[0]!;

  // Try LLM selection first.
  try {
    await ensureOllamaReady({ model: opts.model });
    const client = await createLLMClient({ model: opts.model });

    const promptCandidates = candidates.slice(0, 6).map((p) => {
      const abs = join(opts.projectPath, p);
      const content = readFileSync(abs, "utf-8");
      const preview = content.split("\n").slice(0, 220).join("\n");
      return { path: p, preview };
    });

    const prompt = buildFileSelectionPrompt(promptCandidates);
    const raw = await client.complete(prompt, { json: true });
    const parsed = tryParseJSON<{ targetFile?: string }>(raw);
    if (parsed?.targetFile && candidates.includes(parsed.targetFile)) {
      chosen = parsed.targetFile;
      usedLLM = true;
    }
  } catch {
    // Ignore and fall back to heuristics / user choice.
  }

  // If LLM didn't pick and there are multiple, ask user (interactive).
  if (opts.confirmFileChoice) {
    const orderedChoices = [chosen, ...candidates.filter((c) => c !== chosen)];
    chosen = await opts.confirmFileChoice(orderedChoices);
  }

  const absTarget = join(opts.projectPath, chosen);
  const original = readFileSync(absTarget, "utf-8");

  if (
    original.includes("<UILintProvider") ||
    original.includes('from "uilint-react"')
  ) {
    if (!opts.force) {
      const ok = await opts.confirmOverwrite?.(chosen);
      if (!ok) return { targetFile: chosen, usedLLM };
    }
  }

  let updated = original;
  updated = ensureUILintProviderImport(updated);
  updated = wrapChildrenWithUILintProvider(updated);

  if (updated !== original) {
    writeFileSync(absTarget, updated, "utf-8");
  }

  return { targetFile: chosen, usedLLM };
}
