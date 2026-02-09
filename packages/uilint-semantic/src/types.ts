/**
 * Styleguide Plugin Types
 *
 * Types for the styleguide checking plugin.
 */

// Re-export plugin message types
export type {
  StyleguideStatusMessage,
  StyleguideAnalysisProgressMessage,
  StyleguideAnalysisCompleteMessage,
  StyleguideAnalysisErrorMessage,
  StyleguideMessage,
} from "./plugin/messages.js";
