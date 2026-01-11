/**
 * Vision analyzer for Ollama vision LLM analysis
 *
 * This module provides functionality to analyze screenshots using Ollama's
 * vision models (e.g., qwen3-vl, llava) to detect UI consistency issues
 * that are only visible in rendered output.
 *
 * Uses the official ollama npm package with the chat API for proper vision support.
 */

import { Ollama } from "ollama";
import type {
  OllamaClientOptions,
  StreamProgressCallback,
  LLMInstrumentationCallbacks,
  InstrumentationSpan,
} from "../types.js";

/**
 * Default vision model - qwen3-vl is recommended for UI analysis
 */
export const UILINT_DEFAULT_VISION_MODEL = "qwen3-vl:8b-instruct";

/**
 * Element manifest entry (matches uilint-react/scanner/vision-capture.ts)
 */
export interface ElementManifest {
  id: string;
  text: string;
  dataLoc: string;
  rect: { x: number; y: number; width: number; height: number };
  tagName: string;
  role?: string;
  instanceCount?: number;
}

/**
 * Vision analysis issue category
 */
export type VisionIssueCategory =
  | "spacing"
  | "alignment"
  | "color"
  | "typography"
  | "layout"
  | "contrast"
  | "visual-hierarchy";

/**
 * Vision analysis issue severity
 */
export type VisionIssueSeverity = "error" | "warning" | "info";

/**
 * Vision analysis issue
 */
export interface VisionIssue {
  /** Element text that the LLM referenced */
  elementText: string;
  /** Matched data-loc from manifest (after text matching) */
  dataLoc?: string;
  /** Issue description */
  message: string;
  /** Issue category */
  category: VisionIssueCategory;
  /** Issue severity */
  severity: VisionIssueSeverity;
  /** Suggested fix (optional) */
  suggestion?: string;
}

/**
 * Vision analysis result
 */
export interface VisionAnalysisResult {
  /** Detected issues */
  issues: VisionIssue[];
  /** Analysis time in milliseconds */
  analysisTime: number;
  /** Full prompt sent to the model (for debugging/reports) */
  prompt?: string;
  /** Raw LLM response (for debugging) */
  rawResponse?: string;
}

function stripCodeFences(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1]!.trim() : trimmed;
}

function extractJsonObject(input: string): string {
  const s = stripCodeFences(input).trim();
  if (!s) return s;
  if (s.startsWith("{") && s.endsWith("}")) return s;
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return s.slice(start, end + 1).trim();
  }
  return s;
}

/**
 * Options for vision analysis
 */
export interface VisionAnalysisOptions {
  /** Style guide content (markdown) */
  styleGuide?: string | null;
  /** Progress callback for streaming */
  onProgress?: StreamProgressCallback;
  /** Custom prompt additions */
  additionalContext?: string;
}

/**
 * Vision analyzer client options
 */
export interface VisionAnalyzerOptions extends OllamaClientOptions {
  /** Vision model to use (default: qwen3-vl:30b) */
  visionModel?: string;
}

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT = 120000; // Vision models can be slower

/**
 * Vision analyzer for UI screenshot analysis
 * Uses the ollama npm package with chat API for proper vision model support
 */
export class VisionAnalyzer {
  private baseUrl: string;
  private visionModel: string;
  private timeout: number;
  private instrumentation?: LLMInstrumentationCallbacks;
  private client: Ollama;

  constructor(options: VisionAnalyzerOptions = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.visionModel = options.visionModel || UILINT_DEFAULT_VISION_MODEL;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.instrumentation = options.instrumentation;
    this.client = new Ollama({ host: this.baseUrl });
  }

  /**
   * Analyzes a screenshot with element manifest for UI consistency issues
   */
  async analyzeScreenshot(
    imageBase64: string,
    manifest: ElementManifest[],
    options: VisionAnalysisOptions = {}
  ): Promise<VisionAnalysisResult> {
    const startTime = Date.now();

    const prompt = this.buildVisionPrompt(manifest, options);

    // Start instrumentation span if available
    const spanResult = this.instrumentation?.onGenerationStart?.({
      name: "vision-analyze",
      model: this.visionModel,
      prompt,
      metadata: {
        manifestSize: manifest.length,
        hasStyleGuide: !!options.styleGuide,
      },
    });
    // Convert void to undefined for type compatibility
    const span: InstrumentationSpan | undefined = spanResult || undefined;

    try {
      const rawResponse = options.onProgress
        ? await this.chatVisionStreaming(
            imageBase64,
            prompt,
            options.onProgress,
            span
          )
        : await this.chatVision(imageBase64, prompt, span);

      const issues = this.parseVisionResponse(rawResponse, manifest);

      return {
        issues,
        analysisTime: Date.now() - startTime,
        prompt,
        rawResponse,
      };
    } catch (error) {
      const analysisTime = Date.now() - startTime;
      const err =
        error instanceof Error
          ? error
          : new Error(String(error ?? "Unknown error"));
      console.error("[VisionAnalyzer] Analysis failed", {
        baseUrl: this.baseUrl,
        model: this.visionModel,
        manifestSize: manifest.length,
        analysisTime,
        error: err.message,
      });
      span?.end("", { error: err.message });
      throw err;
    }
  }

  /**
   * Builds the vision analysis prompt
   */
  private buildVisionPrompt(
    manifest: ElementManifest[],
    options: VisionAnalysisOptions
  ): string {
    const styleGuideSection = options.styleGuide
      ? `## Style Guide
${options.styleGuide}

`
      : "";

    const additionalSection = options.additionalContext
      ? `## Additional Context
${options.additionalContext}

`
      : "";

    // Build element manifest section for context
    const manifestSection = this.buildManifestSection(manifest);

    return `You are a UI consistency analyzer examining a screenshot of a web page.
Analyze the visual appearance and identify any UI consistency issues.

${styleGuideSection}${additionalSection}${manifestSection}

## Task

Examine the screenshot and identify visual consistency issues such as:
1. **Spacing inconsistencies**: Elements with uneven padding, margins, or gaps
2. **Alignment issues**: Elements that should be aligned but aren't
3. **Color inconsistencies**: Similar colors that should be identical, or colors that don't match the style guide
4. **Typography issues**: Inconsistent font sizes, weights, or families
5. **Layout problems**: Broken layouts, overlapping elements, or visual hierarchy issues
6. **Contrast issues**: Text that's hard to read or UI elements with insufficient contrast

For each issue found, reference the element by its visible text so we can map it back to the source code.

## Response Format

Respond with JSON ONLY. Return a single JSON object:

\`\`\`json
{
  "issues": [
    {
      "elementText": "Submit Order",
      "message": "Button has inconsistent padding compared to other buttons (appears larger)",
      "category": "spacing",
      "severity": "warning"
    }
  ]
}
\`\`\`

Categories: spacing, alignment, color, typography, layout, contrast, visual-hierarchy
Severities: error (major issue), warning (should fix), info (minor/suggestion)

IMPORTANT:
- Reference elements by their visible text content
- Be specific about what's wrong and what the expected state should be
- Only report significant visual inconsistencies
- If no issues are found, return {"issues": []}`;
  }

  /**
   * Builds the manifest section of the prompt
   */
  private buildManifestSection(manifest: ElementManifest[]): string {
    if (manifest.length === 0) {
      return "";
    }

    const elements = manifest.map((el) => {
      const parts = [`- "${el.text}"`];
      if (el.role) parts.push(`(${el.role})`);
      if (el.instanceCount && el.instanceCount > 1) {
        parts.push(`[${el.instanceCount} instances]`);
      }
      return parts.join(" ");
    });

    return `## Page Elements

The following elements are visible on the page (reference by text when reporting issues):

${elements.join("\n")}

`;
  }

  /**
   * Non-streaming chat API call for vision
   */
  private async chatVision(
    imageBase64: string,
    prompt: string,
    span?: InstrumentationSpan
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Strip data URL prefix if present
      const base64Data = imageBase64.includes(",")
        ? imageBase64.split(",")[1]!
        : imageBase64;

      const response = await this.client.chat({
        model: this.visionModel,
        messages: [
          {
            role: "user",
            content: prompt,
            images: [base64Data],
          },
        ],
        format: "json",
        options: {
          // Increase context window for large prompts
          num_ctx: 8192,
        },
      });

      const output = response.message?.content || "";

      if (!output.trim()) {
        const diag = JSON.stringify(
          {
            done_reason: response.done_reason,
            model: response.model,
            prompt_eval_count: response.prompt_eval_count,
            eval_count: response.eval_count,
          },
          null,
          2
        );
        const errorMsg = `Vision model returned empty output. Diagnostics: ${diag}`;
        span?.end("", { error: errorMsg });
        throw new Error(errorMsg);
      }

      span?.end(output, {
        promptTokens: response.prompt_eval_count,
        completionTokens: response.eval_count,
        totalTokens:
          (response.prompt_eval_count || 0) + (response.eval_count || 0) ||
          undefined,
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
   * Streaming chat API call for vision
   * Uses ollama package's async iterator for streaming
   */
  private async chatVisionStreaming(
    imageBase64: string,
    prompt: string,
    onProgress: StreamProgressCallback,
    span?: InstrumentationSpan
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let chunksReceived = 0;
    let lastProgressAt = Date.now();
    let emittedWaitingLine = false;

    try {
      // Strip data URL prefix if present
      const base64Data = imageBase64.includes(",")
        ? imageBase64.split(",")[1]!
        : imageBase64;

      const stream = await this.client.chat({
        model: this.visionModel,
        messages: [
          {
            role: "user",
            content: prompt,
            images: [base64Data],
          },
        ],
        // Enable thinking for streaming so we can surface reasoning traces for thinking-capable models.
        // Models that don't support it should ignore it.
        think: false,
        stream: true,
        format: "json",
        options: {
          num_ctx: 8192,
        },
      });

      let fullResponse = "";
      let lastLatestLine = "";

      for await (const chunk of stream) {
        chunksReceived++;

        // Emit waiting message on first chunk if no content yet
        if (!emittedWaitingLine && !fullResponse.trim()) {
          onProgress("(waiting for model output…)", fullResponse);
          emittedWaitingLine = true;
        }

        // Thinking-capable models stream `message.thinking` separately from `message.content`.
        const thinking = (chunk as any)?.message?.thinking || "";
        if (thinking) {
          onProgress(lastLatestLine, fullResponse, undefined, thinking);
          lastProgressAt = Date.now();
        }

        // Chat API uses message.content for text deltas (final answer)
        const content = chunk.message?.content || "";
        if (content) {
          fullResponse += content;

          // Get the latest line for progress display
          const responseLines = fullResponse.split("\n");
          const latestLine =
            responseLines[responseLines.length - 1] ||
            responseLines[responseLines.length - 2] ||
            "";

          // Stream the actual text delta to the callback
          lastLatestLine = latestLine.trim();
          onProgress(lastLatestLine, fullResponse, content);
          lastProgressAt = Date.now();
        }

        // Capture token counts from final chunk
        if (chunk.done) {
          promptTokens = chunk.prompt_eval_count;
          completionTokens = chunk.eval_count;
        }

        // Heartbeat if we're receiving chunks but no text output
        if (!fullResponse.trim() && Date.now() - lastProgressAt > 4000) {
          onProgress(
            `(streaming… received ${chunksReceived} chunks)`,
            fullResponse
          );
          lastProgressAt = Date.now();
        }
      }

      if (!fullResponse.trim()) {
        const diag = JSON.stringify(
          {
            chunksReceived,
            promptTokens,
            completionTokens,
            model: this.visionModel,
          },
          null,
          2
        );
        const errorMsg = `Vision model returned empty output (streaming). Diagnostics: ${diag}`;
        span?.end("", { error: errorMsg });
        throw new Error(errorMsg);
      }

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
   * Parses the vision LLM response and matches elements to manifest
   */
  private parseVisionResponse(
    response: string,
    manifest: ElementManifest[]
  ): VisionIssue[] {
    try {
      const jsonText = extractJsonObject(response);
      const parsed = JSON.parse(jsonText);
      const rawIssues = parsed.issues || [];

      // Map elementText to dataLoc using manifest
      return rawIssues.map((issue: VisionIssue) => {
        const matchedElement = this.matchElementByText(
          issue.elementText,
          manifest
        );

        return {
          ...issue,
          dataLoc: matchedElement?.dataLoc,
        };
      });
    } catch {
      const s = response ?? "";
      const previewHead = s ? s.slice(0, 600) : "";
      const previewTail = s && s.length > 600 ? s.slice(-400) : "";
      throw new Error(
        `Vision model returned non-JSON output (expected JSON). length=${
          s.length
        } head=${JSON.stringify(previewHead)} tail=${JSON.stringify(
          previewTail
        )}`
      );
    }
  }

  /**
   * Matches element text from LLM response to manifest entries
   */
  private matchElementByText(
    elementText: string,
    manifest: ElementManifest[]
  ): ElementManifest | undefined {
    if (!elementText) return undefined;

    const normalizedSearch = elementText.toLowerCase().trim();

    // Exact match first
    for (const entry of manifest) {
      if (entry.text.toLowerCase().trim() === normalizedSearch) {
        return entry;
      }
    }

    // Partial match
    for (const entry of manifest) {
      const normalizedEntry = entry.text.toLowerCase().trim();
      if (
        normalizedEntry.includes(normalizedSearch) ||
        normalizedSearch.includes(normalizedEntry)
      ) {
        return entry;
      }
    }

    return undefined;
  }

  /**
   * Checks if the vision model is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const models = await this.client.list();
      return models.models.some(
        (m) =>
          m.name === this.visionModel ||
          m.name.startsWith(this.visionModel.split(":")[0])
      );
    } catch {
      return false;
    }
  }

  /**
   * Gets the current vision model
   */
  getModel(): string {
    return this.visionModel;
  }

  /**
   * Gets the Ollama base URL (for diagnostics)
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Sets the vision model
   */
  setModel(model: string): void {
    this.visionModel = model;
  }

  /**
   * Sets instrumentation callbacks
   */
  setInstrumentation(
    instrumentation: LLMInstrumentationCallbacks | undefined
  ): void {
    this.instrumentation = instrumentation;
  }
}

// Default singleton instance
let defaultAnalyzer: VisionAnalyzer | null = null;

/**
 * Gets the default VisionAnalyzer instance
 */
export function getVisionAnalyzer(
  options?: VisionAnalyzerOptions
): VisionAnalyzer {
  if (!defaultAnalyzer || options) {
    defaultAnalyzer = new VisionAnalyzer(options);
  }
  return defaultAnalyzer;
}
