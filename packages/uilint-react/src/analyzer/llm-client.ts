/**
 * LLM client for browser environment
 * Wraps API calls to the dev server analyze route (browser environment)
 */

import { UILINT_DEFAULT_OLLAMA_MODEL } from "uilint-core";

export type UILintScanIssue = {
  line?: number;
  message: string;
  dataLoc?: string;
};

export interface LLMClientOptions {
  apiEndpoint?: string;
  model?: string;
}

const DEFAULT_API_ENDPOINT = "/api/.uilint/analyze";

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
   * Analyze a source file/snippet and return issues.
   *
   * NOTE: This matches the (simplified) `/api/.uilint/analyze` route which is
   * now source-only (no styleSummary / styleguide generation).
   */
  async analyzeSource(input: {
    sourceCode: string;
    filePath?: string;
    styleGuide?: string | null;
    componentName?: string;
    componentLine?: number;
    includeChildren?: boolean;
    dataLocs?: string[];
  }): Promise<{ issues: UILintScanIssue[] }> {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCode: input.sourceCode,
          filePath: input.filePath,
          styleGuide: input.styleGuide ?? undefined,
          componentName: input.componentName,
          componentLine: input.componentLine,
          includeChildren: input.includeChildren,
          dataLocs: input.dataLocs,
          model: this.model,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return { issues: data.issues || [] };
    } catch (error) {
      console.error("[UILint] Analysis failed:", error);
      return { issues: [] };
    }
  }
}
