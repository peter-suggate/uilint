/**
 * uilint-semantic - Styleguide checking plugin
 *
 * LLM-powered styleguide enforcement for React/TypeScript codebases.
 * This entry point is safe to import in browser contexts.
 */

// Types
export type {
  StyleguideStatusMessage,
  StyleguideAnalysisProgressMessage,
  StyleguideAnalysisCompleteMessage,
  StyleguideAnalysisErrorMessage,
  StyleguideMessage,
} from "./types.js";

// Plugin definition
export { styleguidePlugin } from "./plugin/index.js";
export type { StyleguideState } from "./plugin/state.js";
