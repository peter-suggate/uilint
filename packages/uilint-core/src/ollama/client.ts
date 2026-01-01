/**
 * Ollama API client for LLM interactions
 */

import type {
  UILintIssue,
  AnalysisResult,
  ValidationResult,
  OllamaClientOptions,
} from "../types.js";
import {
  extractStyleValues,
  extractTailwindAllowlist,
} from "../styleguide/parser.js";
import {
  buildAnalysisPrompt,
  buildStyleGuidePrompt,
  buildQueryPrompt,
  buildValidationPrompt,
} from "./prompts.js";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "qwen2.5-coder:7b";
const DEFAULT_TIMEOUT = 60000;

export class OllamaClient {
  private baseUrl: string;
  private model: string;
  private timeout: number;

  constructor(options: OllamaClientOptions = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.model = options.model || DEFAULT_MODEL;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Analyzes styles and returns issues
   */
  async analyzeStyles(
    styleSummary: string,
    styleGuide: string | null
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const prompt = buildAnalysisPrompt(styleSummary, styleGuide);

    try {
      const response = await this.generate(prompt);
      const issues = this.parseIssuesResponse(response);

      return {
        issues,
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
  async generateStyleGuide(styleSummary: string): Promise<string | null> {
    const prompt = buildStyleGuidePrompt(styleSummary);

    try {
      const response = await this.generate(prompt, false);
      return response;
    } catch (error) {
      console.error("[UILint] Style guide generation failed:", error);
      return null;
    }
  }

  /**
   * Queries the style guide for specific information
   */
  async queryStyleGuide(
    query: string,
    styleGuide: string | null
  ): Promise<string> {
    const prompt = buildQueryPrompt(query, styleGuide);

    try {
      const response = await this.generate(prompt, false);
      return response;
    } catch (error) {
      console.error("[UILint] Query failed:", error);
      return "Failed to query style guide. Please try again.";
    }
  }

  /**
   * Validates code against the style guide
   */
  async validateCode(
    code: string,
    styleGuide: string | null
  ): Promise<ValidationResult> {
    const prompt = buildValidationPrompt(code, styleGuide);

    try {
      const response = await this.generate(prompt);
      const parsed = this.parseValidationResponse(response);

      // Guardrail: LLM may hallucinate "not in the style guide" issues even when the
      // value exists. Filter out contradictions when we have a style guide.
      if (styleGuide) {
        const styleValues = extractStyleValues(styleGuide);
        const allowedHex = new Set(
          styleValues.colors
            .filter((c) => c.startsWith("#"))
            .map((c) => c.toUpperCase())
        );

        const twAllow = /\n##\s+Tailwind\b/i.test(styleGuide)
          ? extractTailwindAllowlist(styleGuide)
          : null;

        const issues = (parsed.issues || [])
          .map((i: any): ValidationResult["issues"][number] => ({
            type: i?.type === "error" ? "error" : "warning",
            message: String(i?.message || ""),
            suggestion: i?.suggestion ? String(i.suggestion) : undefined,
          }))
          .filter((issue) => {
            const m = issue.message.match(/Color\s+(#[A-Fa-f0-9]{6})\b/);
            if (m) {
              const hex = m[1].toUpperCase();
              // If it's in the style guide, drop the issue as a contradiction.
              if (allowedHex.has(hex)) return false;
            }

            const u = issue.message.match(
              /Tailwind utility\s+"([^"]+)"\s+is not allowed/i
            );
            if (u && twAllow) {
              const util = u[1];
              if (twAllow.allowedUtilities.has(util)) return false;
            }
            return true;
          });

        return {
          valid: issues.filter((i) => i.type === "error").length === 0,
          issues,
        };
      }

      return parsed;
    } catch (error) {
      console.error("[UILint] Validation failed:", error);
      return { valid: true, issues: [] };
    }
  }

  /**
   * Core generate method that calls Ollama API
   */
  private async generate(
    prompt: string,
    jsonFormat: boolean = true
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          ...(jsonFormat && { format: "json" }),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || "";
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parses issues from LLM response
   */
  private parseIssuesResponse(response: string): UILintIssue[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.issues || [];
    } catch {
      console.warn("[UILint] Failed to parse LLM response as JSON");
      return [];
    }
  }

  /**
   * Parses validation result from LLM response
   */
  private parseValidationResponse(response: string): ValidationResult {
    try {
      const parsed = JSON.parse(response);
      return {
        valid: parsed.valid ?? true,
        issues: parsed.issues || [],
      };
    } catch {
      console.warn("[UILint] Failed to parse validation response");
      return { valid: true, issues: [] };
    }
  }

  /**
   * Checks if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Gets the current model
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Sets the model
   */
  setModel(model: string): void {
    this.model = model;
  }
}

// Default singleton instance
let defaultClient: OllamaClient | null = null;

export function getOllamaClient(options?: OllamaClientOptions): OllamaClient {
  if (!defaultClient || options) {
    defaultClient = new OllamaClient(options);
  }
  return defaultClient;
}
