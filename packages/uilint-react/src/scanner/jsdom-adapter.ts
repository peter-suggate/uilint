import type { DOMSnapshot, UILintIssue, AnalysisResult } from "../types";
import { scanDOM, createStyleSummary } from "./dom-scanner";
import { isJSDOM } from "./environment";

const OLLAMA_URL = "http://localhost:11434/api/generate";

/**
 * Adapter for running UILint in JSDOM/Node.js test environments
 * Calls Ollama directly and outputs to console.warn()
 */
export class JSDOMAdapter {
  private styleGuideContent: string | null = null;
  private styleGuidePath: string;

  constructor(styleGuidePath: string = ".uilint/styleguide.md") {
    this.styleGuidePath = styleGuidePath;
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

    // Call Ollama directly
    const issues = await this.callOllama(styleSummary, this.styleGuideContent);

    return {
      issues,
      analysisTime: Date.now() - startTime,
    };
  }

  /**
   * Calls Ollama directly (for test environments)
   */
  private async callOllama(
    styleSummary: string,
    styleGuide: string | null
  ): Promise<UILintIssue[]> {
    const prompt = this.buildPrompt(styleSummary, styleGuide);

    try {
      const response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2",
          prompt,
          stream: false,
          format: "json",
        }),
      });

      if (!response.ok) {
        console.warn(
          "[UILint] Failed to connect to Ollama. Is it running on localhost:11434?"
        );
        return [];
      }

      const data = await response.json();
      return this.parseResponse(data.response);
    } catch (error) {
      console.warn("[UILint] Error calling Ollama:", error);
      return [];
    }
  }

  private buildPrompt(styleSummary: string, styleGuide: string | null): string {
    const guideSection = styleGuide
      ? `## Current Style Guide\n${styleGuide}\n\n`
      : "## No Style Guide Found\nAnalyze the styles and identify inconsistencies.\n\n";

    return `You are a UI consistency analyzer. Analyze the following extracted styles and identify inconsistencies.

${guideSection}

${styleSummary}

Respond with a JSON object containing an "issues" array. Each issue should have:
- id: unique string identifier
- type: one of "color", "typography", "spacing", "component", "responsive", "accessibility"
- message: human-readable description of the issue
- currentValue: the problematic value found
- expectedValue: what it should be (if known from style guide)
- suggestion: how to fix it

Focus on:
1. Similar but not identical colors (e.g., #3B82F6 vs #3575E2)
2. Inconsistent font sizes or weights
3. Spacing values that don't follow a consistent scale
4. Mixed border-radius values

Example response:
{
  "issues": [
    {
      "id": "color-1",
      "type": "color",
      "message": "Found similar blue colors that should be consolidated",
      "currentValue": "#3575E2",
      "expectedValue": "#3B82F6",
      "suggestion": "Use the primary blue #3B82F6 consistently"
    }
  ]
}`;
  }

  private parseResponse(response: string): UILintIssue[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.issues || [];
    } catch {
      console.warn("[UILint] Failed to parse LLM response");
      return [];
    }
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
