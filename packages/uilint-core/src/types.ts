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

// Validation result (for code snippets)
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  type: "error" | "warning";
  message: string;
  line?: number;
  suggestion?: string;
}

// Lint result
export interface LintResult {
  issues: LintIssue[];
  summary: string;
}

export interface LintIssue {
  severity: "error" | "warning" | "info";
  type: "color" | "spacing" | "typography" | "component" | "accessibility";
  message: string;
  line?: number;
  code?: string;
  suggestion?: string;
}

// Ollama client options
export interface OllamaClientOptions {
  baseUrl?: string;
  model?: string;
  timeout?: number;
}

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
