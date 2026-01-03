/**
 * Consistency analysis module exports
 */

export type {
  StyleSnapshot,
  ElementRole,
  ElementSnapshot,
  GroupedSnapshot,
  ViolationCategory,
  ViolationSeverity,
  Violation,
  ConsistencyResult,
} from "./types.js";

export {
  buildConsistencyPrompt,
  countElements,
  hasAnalyzableGroups,
} from "./prompts.js";

export {
  parseGroupedSnapshot,
  parseViolationsResponse,
  validateViolations,
  analyzeConsistency,
  formatConsistencyViolations,
  type AnalyzeConsistencyOptions,
} from "./analyzer.js";
