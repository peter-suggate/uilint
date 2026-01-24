/**
 * UILint Legacy Utilities
 *
 * These utilities are kept for backward compatibility.
 * New UI components are in /ui/ directory.
 */

// DOM utilities (data-loc based)
export {
  scanDOMForSources,
  groupBySourceFile,
  cleanupDataAttributes,
  getElementById,
  updateElementRects,
  buildEditorUrl,
  isNodeModulesPath,
  getDisplayName,
  getSourceFromDataLoc,
} from "./dom-utils";

// Source fetching
export {
  fetchSource,
  fetchSourceWithContext,
  clearSourceCache,
  getCachedSource,
  prefetchSources,
} from "./source-fetcher";

// Types
export type {
  SourceLocation,
  ScannedElement,
  SourceFile,
  UILintSettings,
  SourceApiResponse,
  CachedSource,
  LocatorTarget,
  InspectedElement,
  VisionIssue,
  VisionAnalysisResult,
  ElementManifest,
} from "./types";

// Constants
export { FILE_COLORS, DEFAULT_SETTINGS, DATA_UILINT_ID } from "./types";

// Vision capture utilities
export {
  collectElementManifest,
  captureScreenshot,
  getCurrentRoute,
  matchIssuesToManifest,
} from "../../scanner/vision-capture";
