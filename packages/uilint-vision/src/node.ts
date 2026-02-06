/**
 * uilint-vision/node - Node.js exports
 *
 * Includes VisionAnalyzer which requires Ollama.
 * Import this for server-side analysis.
 */

// Re-export everything from browser-safe entry
export * from "./index.js";

// Node.js only exports - VisionAnalyzer requires ollama package
export {
  VisionAnalyzer,
  getVisionAnalyzer,
  UILINT_DEFAULT_VISION_MODEL,
  type VisionAnalyzerOptions,
  type VisionAnalysisOptions,
  type AnalyzerResult,
} from "./analyzer/vision-analyzer.js";
