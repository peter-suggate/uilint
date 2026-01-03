/**
 * UILint Source Visualization Components
 *
 * A beautiful dev overlay for visualizing React component source files.
 */

// Main provider and context
export { UILintProvider, useUILintContext } from "./UILintProvider";

// UI components
export { UILintToolbar } from "./UILintToolbar";
export { SourceOverlays } from "./SourceOverlays";
export { InspectionPanel } from "./InspectionPanel";
export { LocatorOverlay } from "./LocatorOverlay";

// Fiber utilities
export {
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
} from "./fiber-utils";

// Source fetching
export {
  fetchSource,
  fetchSourceWithContext,
  clearSourceCache,
  getCachedSource,
  prefetchSources,
} from "./source-fetcher";

// Scan hook
export { useElementScan } from "./use-element-scan";

// Types
export type {
  SourceLocation,
  ComponentInfo,
  ScannedElement,
  SourceFile,
  UILintSettings,
  UILintMode,
  UILintContextValue,
  UILintProviderProps,
  SourceApiResponse,
  CachedSource,
  LocatorTarget,
} from "./types";

// Constants
export { FILE_COLORS, DEFAULT_SETTINGS, DATA_UILINT_ID } from "./types";
