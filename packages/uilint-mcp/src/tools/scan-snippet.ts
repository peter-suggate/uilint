/**
 * Scan a markup snippet (best-effort HTML/JSX-ish) against the style guide.
 *
 * This replaces the removed validate/lint snippet tools by using the same pipeline
 * as `uilint scan`: parse -> extract styles -> summarize -> LLM analyze.
 */

import type { AnalysisResult } from "uilint-core";
import { OllamaClient, createStyleSummary } from "uilint-core";
import {
  ensureOllamaReady,
  parseCLIInput,
  readTailwindThemeTokens,
} from "uilint-core/node";

export type { AnalysisResult };

export interface ScanSnippetOptions {
  model?: string;
  /**
   * Directory to search for Tailwind config (optional).
   * If omitted, Tailwind theme tokens are not included.
   */
  tailwindSearchPath?: string;
}

export async function scanSnippet(
  markup: string,
  styleGuide: string | null,
  options: ScanSnippetOptions = {}
): Promise<AnalysisResult> {
  const snapshot = parseCLIInput(markup);

  const tailwindTheme =
    options.tailwindSearchPath && options.tailwindSearchPath.trim()
      ? readTailwindThemeTokens(options.tailwindSearchPath)
      : null;

  const summary = createStyleSummary(snapshot.styles, {
    html: snapshot.html,
    tailwindTheme: tailwindTheme ?? undefined,
  });

  await ensureOllamaReady({ model: options.model });
  const client = new OllamaClient({ model: options.model });
  return await client.analyzeStyles(summary, styleGuide);
}
