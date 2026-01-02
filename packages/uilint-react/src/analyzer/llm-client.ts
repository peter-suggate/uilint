/**
 * LLM client for browser environment
 * Uses uilint-core for prompts and wraps API calls
 */

import {
  createStyleSummary,
  buildAnalysisPrompt,
  buildStyleGuidePrompt,
  UILINT_DEFAULT_OLLAMA_MODEL,
  type ExtractedStyles,
  type UILintIssue,
  type AnalysisResult,
} from "uilint-core";

export interface LLMClientOptions {
  apiEndpoint?: string;
  model?: string;
}

const DEFAULT_API_ENDPOINT = "/api/uilint/analyze";

/**
 * Client for communicating with the LLM via API route (browser environment)
 */
export class LLMClient {
  private apiEndpoint: string;
  private model: string;

  constructor(options: LLMClientOptions = {}) {
    this.apiEndpoint = options.apiEndpoint || DEFAULT_API_ENDPOINT;
    this.model = options.model || UILINT_DEFAULT_OLLAMA_MODEL;
  }

  /**
   * Analyzes extracted styles and returns issues
   */
  async analyze(
    styles: ExtractedStyles,
    styleGuide: string | null
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const styleSummary = createStyleSummary(styles);

    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleSummary,
          styleGuide,
          model: this.model,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      return {
        issues: data.issues || [],
        suggestedStyleGuide: data.suggestedStyleGuide,
        analysisTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error("[UILint] Analysis failed:", error);
      return {
        issues: [],
        analysisTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Generates a style guide from detected styles
   */
  async generateStyleGuide(styles: ExtractedStyles): Promise<string | null> {
    const styleSummary = createStyleSummary(styles);

    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleSummary,
          generateGuide: true,
          model: this.model,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.styleGuide || null;
    } catch (error) {
      console.error("[UILint] Style guide generation failed:", error);
      return null;
    }
  }
}

// Re-export prompt builders for any code that uses them directly
export { buildAnalysisPrompt, buildStyleGuidePrompt };
