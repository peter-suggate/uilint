// UILint Provider and Components
export {
  UILintProvider,
  useUILintContext,
  UILintToolbar,
  InspectionPanel,
  LocatorOverlay,
  // Fiber utilities
  getFiberFromElement,
  getDebugSource,
  getDebugOwner,
  getComponentStack,
  scanDOMForSources,
  groupBySourceFile,
  cleanupDataAttributes,
  getElementById,
  updateElementRects,
  buildEditorUrl,
  isNodeModulesPath,
  getDisplayName,
  // Source fetching
  fetchSource,
  fetchSourceWithContext,
  clearSourceCache,
  getCachedSource,
  prefetchSources,
  // Constants
  FILE_COLORS,
  DEFAULT_SETTINGS,
  DATA_UILINT_ID,
} from "./components/ui-lint";
export type {
  SourceLocation,
  ComponentInfo,
  ScannedElement,
  SourceFile,
  UILintSettings,
  UILintContextValue,
  UILintProviderProps,
  SourceApiResponse,
  CachedSource,
  LocatorTarget,
  InspectedElement,
} from "./components/ui-lint";

// Consistency analysis
export {
  createSnapshot,
  cleanupDataElements,
  getElementBySnapshotId,
  ConsistencyHighlighter,
} from "./consistency/index";
export type {
  StyleSnapshot,
  ElementRole,
  ElementSnapshot,
  GroupedSnapshot,
  Violation,
  ViolationCategory,
  ViolationSeverity,
  ConsistencyResult,
} from "./consistency/types";

// Re-export core types for convenience
import type {
  UILintIssue,
  StyleGuide,
  ExtractedStyles,
  SerializedStyles,
  DOMSnapshot,
  AnalysisResult,
} from "uilint-core";

export type {
  UILintIssue,
  StyleGuide,
  ExtractedStyles,
  SerializedStyles,
  DOMSnapshot,
  AnalysisResult,
};

// Scanner utilities (browser-specific)
export { scanDOM } from "./scanner/dom-scanner";
export { isBrowser, isJSDOM, isNode } from "./scanner/environment";

// Note: JSDOMAdapter and runUILintInTest are available from "uilint-react/node"
// for Node.js/test environments only

// Re-export scanner utilities directly from core
export {
  extractStylesFromDOM,
  serializeStyles,
  createStyleSummary,
} from "uilint-core";

// Styleguide utilities - re-export directly from core
export { parseStyleGuide } from "uilint-core";
export { generateStyleGuideFromStyles as generateStyleGuide } from "uilint-core";
export { createEmptyStyleGuide, mergeStyleGuides } from "uilint-core";
