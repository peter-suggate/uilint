/**
 * UILint Core - Shared library for UI consistency checking
 *
 * This is the browser-safe entry point. For Node.js-specific features
 * like JSDOM parsing, use the /node subpath.
 */

// Types
export type {
  UILintIssue,
  StyleGuide,
  ColorRule,
  TypographyRule,
  SpacingRule,
  ComponentRule,
  ExtractedStyles,
  SerializedStyles,
  DOMSnapshot,
  AnalysisResult,
  OllamaClientOptions,
  ExtractedStyleValues,
  TailwindThemeTokens,
  StreamProgressCallback,
} from "./types.js";

// Ollama client
export { OllamaClient, getOllamaClient } from "./ollama/client.js";
export { UILINT_DEFAULT_OLLAMA_MODEL } from "./ollama/defaults.js";
export {
  buildAnalysisPrompt,
  buildSourceAnalysisPrompt,
  buildStyleGuidePrompt,
} from "./ollama/prompts.js";

// Output formatting (plain text; no ANSI)
export { formatViolationsText, sanitizeIssues } from "./format/issues.js";

// Scanner (browser-safe parts only)
export {
  extractStyles,
  extractStylesFromDOM,
  serializeStyles,
  deserializeStyles,
  createStyleSummary,
  truncateHTML,
} from "./scanner/style-extractor.js";

// Styleguide
export {
  parseStyleGuide,
  parseStyleGuideSections,
  extractStyleValues,
  extractTailwindAllowlist,
} from "./styleguide/parser.js";
export {
  generateStyleGuideFromStyles,
  styleGuideToMarkdown,
} from "./styleguide/generator.js";
export {
  createEmptyStyleGuide,
  validateStyleGuide,
  mergeStyleGuides,
  createColorRule,
  createTypographyRule,
  createSpacingRule,
  createComponentRule,
} from "./styleguide/schema.js";

// Consistency analysis
export type {
  StyleSnapshot,
  ElementRole,
  ElementSnapshot,
  GroupedSnapshot,
  ViolationCategory,
  ViolationSeverity,
  Violation,
  ConsistencyResult,
  AnalyzeConsistencyOptions,
} from "./consistency/index.js";

export {
  buildConsistencyPrompt,
  countElements,
  hasAnalyzableGroups,
  parseGroupedSnapshot,
  parseViolationsResponse,
  validateViolations,
  analyzeConsistency,
  formatConsistencyViolations,
} from "./consistency/index.js";

// NOTE: rule-based code validation/linting was removed in favor of scan/analyze flows.
