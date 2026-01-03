/**
 * Adapter for running UILint in JSDOM/Node.js test environments
 * Uses uilint-core for analysis
 */

import { OllamaClient, createStyleSummary } from "uilint-core";
import type { UILintIssue, AnalysisResult } from "uilint-core";
import { scanDOM } from "./dom-scanner.js";
import { isJSDOM } from "./environment.js";

/**
 * Adapter for running UILint in JSDOM/Node.js test environments
 * Calls Ollama directly and outputs to console.warn()
 */
export class JSDOMAdapter {
  private styleGuideContent: string | null = null;
  private styleGuidePath: string;
  private client: InstanceType<typeof OllamaClient>;

  constructor(styleGuidePath: string = ".uilint/styleguide.md") {
    this.styleGuidePath = styleGuidePath;
    this.client = new OllamaClient();
  }

  /**
   * Loads the style guide from the filesystem (Node.js only)
   */
  async loadStyleGuide(): Promise<string | null> {
    if (typeof process === "undefined") return null;

    try {
      // Dynamic import for Node.js fs module
      const fs = await import("fs/promises");
      const path = await import("path");

      const fullPath = path.resolve(process.cwd(), this.styleGuidePath);
      this.styleGuideContent = await fs.readFile(fullPath, "utf-8");
      return this.styleGuideContent;
    } catch {
      // Style guide doesn't exist yet
      return null;
    }
  }

  /**
   * Analyzes the current DOM and returns issues
   */
  async analyze(root?: Element | Document): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Scan the DOM
    const snapshot = scanDOM(root);
    const styleSummary = createStyleSummary(snapshot.styles);

    // Load style guide if not already loaded
    if (!this.styleGuideContent) {
      await this.loadStyleGuide();
    }

    // Call Ollama via the core client
    const result = await this.client.analyzeStyles(
      styleSummary,
      this.styleGuideContent
    );

    return {
      issues: result.issues,
      analysisTime: Date.now() - startTime,
    };
  }

  /**
   * Outputs issues to console.warn (for test visibility)
   */
  outputWarnings(issues: UILintIssue[]): void {
    if (issues.length === 0) {
      console.warn("[UILint] No UI consistency issues found");
      return;
    }

    issues.forEach((issue) => {
      const parts = [`⚠️ [UILint] ${issue.message}`];

      if (issue.currentValue && issue.expectedValue) {
        parts.push(
          `Current: ${issue.currentValue}, Expected: ${issue.expectedValue}`
        );
      }

      if (issue.suggestion) {
        parts.push(`Suggestion: ${issue.suggestion}`);
      }

      console.warn(parts.join(" | "));
    });
  }
}

/**
 * Convenience function for running UILint in tests
 */
export async function runUILintInTest(
  root?: Element | Document
): Promise<UILintIssue[]> {
  const adapter = new JSDOMAdapter();
  const result = await adapter.analyze(root);
  adapter.outputWarnings(result.issues);
  return result.issues;
}

// Re-export for backwards compatibility
export { isJSDOM };
