/**
 * Core types for UILint
 */

// Issue types
export interface UILintIssue {
  id: string;
  type:
    | "color"
    | "typography"
    | "spacing"
    | "component"
    | "responsive"
    | "accessibility";
  message: string;
  element?: string;
  selector?: string;
  currentValue?: string;
  expectedValue?: string;
  suggestion?: string;
}

// Style guide types
export interface StyleGuide {
  colors: ColorRule[];
  typography: TypographyRule[];
  spacing: SpacingRule[];
  components: ComponentRule[];
}

export interface ColorRule {
  name: string;
  value: string;
  usage: string;
}

export interface TypographyRule {
  element: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
}

export interface SpacingRule {
  name: string;
  value: string;
}

export interface ComponentRule {
  name: string;
  styles: string[];
}

// Extracted styles (from DOM scanning)
export interface ExtractedStyles {
  colors: Map<string, number>;
  fontSizes: Map<string, number>;
  fontFamilies: Map<string, number>;
  fontWeights: Map<string, number>;
  spacing: Map<string, number>;
  borderRadius: Map<string, number>;
}

// Serialized version for JSON transport
export interface SerializedStyles {
  colors: Record<string, number>;
  fontSizes: Record<string, number>;
  fontFamilies: Record<string, number>;
  fontWeights: Record<string, number>;
  spacing: Record<string, number>;
  borderRadius: Record<string, number>;
}

// DOM snapshot for analysis
export interface DOMSnapshot {
  html: string;
  styles: ExtractedStyles;
  elementCount: number;
  timestamp: number;
}

// Analysis result
export interface AnalysisResult {
  issues: UILintIssue[];
  suggestedStyleGuide?: string;
  analysisTime: number;
}

/**
 * Lightweight issue type used for per-source scanning (e.g. via data-loc).
 * This intentionally differs from `UILintIssue` (which is for styleSummary analysis).
 */
export interface UILintScanIssue {
  /** Line number in the source file (1-based). */
  line?: number;
  /** Human-readable description of the issue. */
  message: string;
  /** Optional data-loc reference (format: "path:line:column") */
  dataLoc?: string;
}

export interface UILintSourceScanResult {
  issues: UILintScanIssue[];
}

// LLM Instrumentation types (for optional observability integration)
/**
 * Represents an active generation span that can be ended with output data.
 * Returned by onGenerationStart when instrumentation is enabled.
 */
export interface InstrumentationSpan {
  /** End the span with the generation output and optional usage metrics */
  end: (
    output: string,
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      error?: string;
    }
  ) => void;
}

/**
 * Optional instrumentation callbacks for LLM observability.
 * Allows plugging in any observability tool (Langfuse, OpenTelemetry, etc.)
 * without adding hard dependencies to uilint-core.
 */
export interface LLMInstrumentationCallbacks {
  /**
   * Called when an LLM generation starts.
   * Return an InstrumentationSpan to track the generation, or void to skip.
   */
  onGenerationStart?: (params: {
    /** Operation name (e.g., "ollama-generate", "analyze-styles") */
    name: string;
    /** Model identifier */
    model: string;
    /** The prompt sent to the LLM */
    prompt: string;
    /** Optional metadata */
    metadata?: Record<string, unknown>;
  }) => InstrumentationSpan | void;
}

// Ollama client options
export interface OllamaClientOptions {
  baseUrl?: string;
  model?: string;
  timeout?: number;
  /** Optional instrumentation callbacks for observability (Langfuse, OpenTelemetry, etc.) */
  instrumentation?: LLMInstrumentationCallbacks;
}

// Callback for streaming progress updates
export type StreamProgressCallback = (
  latestLine: string,
  fullResponse: string,
  /** The text delta just received (optional, for printing raw streamed output) */
  delta?: string,
  /**
   * The "thinking" delta just received (optional, for models that support Ollama's `think`).
   * For chat this comes from `chunk.message.thinking`; for generate this comes from `chunk.thinking`.
   */
  thinkingDelta?: string
) => void;

// Style values extracted from styleguide
export interface ExtractedStyleValues {
  colors: string[];
  fontSizes: string[];
  fontFamilies: string[];
  spacing: string[];
  borderRadius: string[];
}

// Tailwind (optional) token sets for styleguide + validation
export interface TailwindThemeTokens {
  configPath: string;
  colors: string[]; // tailwind:<name> or tailwind:<name>-<shade>
  spacingKeys: string[];
  borderRadiusKeys: string[];
  fontFamilyKeys: string[];
  fontSizeKeys: string[];
}
