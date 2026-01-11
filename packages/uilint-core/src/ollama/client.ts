/**
 * Ollama API client for LLM interactions
 */

import type {
  UILintIssue,
  AnalysisResult,
  OllamaClientOptions,
  StreamProgressCallback,
  LLMInstrumentationCallbacks,
} from "../types.js";
import {
  buildAnalysisPrompt,
  buildSourceAnalysisPrompt,
  buildStyleGuidePrompt,
  type BuildSourceAnalysisPromptOptions,
} from "./prompts.js";
import { UILINT_DEFAULT_OLLAMA_MODEL } from "./defaults.js";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT = 60000;

export class OllamaClient {
  private baseUrl: string;
  private model: string;
  private timeout: number;
  private instrumentation?: LLMInstrumentationCallbacks;

  constructor(options: OllamaClientOptions = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.model = options.model || UILINT_DEFAULT_OLLAMA_MODEL;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.instrumentation = options.instrumentation;
  }

  /**
   * Low-level completion API for custom prompts (used by installers/tools).
   *
   * When `json` is true, Ollama is requested to emit JSON (best-effort).
   */
  async complete(
    prompt: string,
    options: {
      json?: boolean;
      stream?: boolean;
      onProgress?: StreamProgressCallback;
    } = {}
  ): Promise<string> {
    const jsonFormat = options.json ?? false;
    if (options.stream && options.onProgress) {
      return await this.generateStreaming(
        prompt,
        jsonFormat,
        options.onProgress
      );
    }
    return await this.generate(prompt, jsonFormat);
  }

  /**
   * Analyzes styles and returns issues
   */
  async analyzeStyles(
    styleSummary: string,
    styleGuide: string | null,
    onProgress?: StreamProgressCallback
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const prompt = buildAnalysisPrompt(styleSummary, styleGuide);

    try {
      const response = onProgress
        ? await this.generateStreaming(
            prompt,
            true,
            onProgress,
            "analyze-styles"
          )
        : await this.generate(prompt, true, "analyze-styles");
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
   * Analyzes a raw source file/snippet (TSX/JSX/etc) directly and returns issues.
   * This bypasses HTML/DOM parsing entirely.
   */
  async analyzeSource(
    source: string,
    styleGuide: string | null,
    onProgress?: StreamProgressCallback,
    options: BuildSourceAnalysisPromptOptions = {}
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const prompt = buildSourceAnalysisPrompt(source, styleGuide, options);

    try {
      const response = onProgress
        ? await this.generateStreaming(
            prompt,
            true,
            onProgress,
            "analyze-source"
          )
        : await this.generate(prompt, true, "analyze-source");
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
      const response = await this.generate(
        prompt,
        false,
        "generate-styleguide"
      );
      return response;
    } catch (error) {
      console.error("[UILint] Style guide generation failed:", error);
      return null;
    }
  }

  /**
   * Core generate method that calls Ollama API
   */
  private async generate(
    prompt: string,
    jsonFormat: boolean = true,
    operationName: string = "ollama-generate"
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Start instrumentation span if available
    const span = this.instrumentation?.onGenerationStart?.({
      name: operationName,
      model: this.model,
      prompt,
      metadata: { jsonFormat, stream: false },
    });

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
        const error = `Ollama API error: ${response.status}`;
        span?.end("", { error });
        throw new Error(error);
      }

      const data = await response.json();
      const output = data.response || "";

      // End instrumentation span with output and usage
      span?.end(output, {
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
        totalTokens:
          (data.prompt_eval_count || 0) + (data.eval_count || 0) || undefined,
      });

      return output;
    } catch (error) {
      span?.end("", { error: String(error) });
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Streaming generate method that calls Ollama API with streaming
   * and reports progress via callback
   */
  private async generateStreaming(
    prompt: string,
    jsonFormat: boolean = true,
    onProgress: StreamProgressCallback,
    operationName: string = "ollama-generate-stream"
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Start instrumentation span if available
    const span = this.instrumentation?.onGenerationStart?.({
      name: operationName,
      model: this.model,
      prompt,
      metadata: { jsonFormat, stream: true },
    });

    // Track token counts from streaming response
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt,
          // Enable thinking when streaming so we can surface reasoning traces for thinking-capable models.
          // For models that don't support it, Ollama will ignore it.
          think: true,
          stream: true,
          ...(jsonFormat && { format: "json" }),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = `Ollama API error: ${response.status}`;
        span?.end("", { error });
        throw new Error(error);
      }

      if (!response.body) {
        const error = "No response body for streaming";
        span?.end("", { error });
        throw new Error(error);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let lastLineEmitted = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete JSON lines from the buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            const thinkingDelta: string = chunk.thinking || "";
            const delta: string = chunk.response || "";

            // Stream thinking trace first (if any). Keep it separate from the final response.
            if (thinkingDelta) {
              onProgress(
                lastLineEmitted,
                fullResponse,
                undefined,
                thinkingDelta
              );
            }

            if (delta) {
              fullResponse += delta;
              // Get the latest line from the response for progress display
              const responseLines = fullResponse.split("\n");
              const latestLine =
                responseLines[responseLines.length - 1] ||
                responseLines[responseLines.length - 2] ||
                "";
              lastLineEmitted = latestLine.trim();
              onProgress(lastLineEmitted, fullResponse, delta);
            }
            // Capture token counts from final chunk
            if (chunk.done) {
              promptTokens = chunk.prompt_eval_count;
              completionTokens = chunk.eval_count;
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }

      // Process any remaining content in buffer
      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer);
          const delta: string = chunk.response || "";
          if (delta) {
            fullResponse += delta;
          }
          if (chunk.done) {
            promptTokens = chunk.prompt_eval_count;
            completionTokens = chunk.eval_count;
          }
        } catch {
          // Skip malformed JSON
        }
      }

      // End instrumentation span with output and usage
      span?.end(fullResponse, {
        promptTokens,
        completionTokens,
        totalTokens: (promptTokens || 0) + (completionTokens || 0) || undefined,
      });

      return fullResponse;
    } catch (error) {
      span?.end("", { error: String(error) });
      throw error;
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

  /**
   * Sets instrumentation callbacks for observability.
   * This allows configuring instrumentation after construction.
   */
  setInstrumentation(
    instrumentation: LLMInstrumentationCallbacks | undefined
  ): void {
    this.instrumentation = instrumentation;
  }

  /**
   * Returns true if instrumentation is currently configured.
   */
  hasInstrumentation(): boolean {
    return !!this.instrumentation;
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
