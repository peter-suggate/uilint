/**
 * UILint Source Visualization Components
 *
 * A dev overlay for inspecting React components and analyzing code with LLM.
 * Use Alt+Click on any element to open the inspector sidebar.
 */

// Main provider and context
export { UILintProvider, useUILintContext } from "./UILintProvider";

// UI components
export { UILintToolbar } from "./UILintToolbar";
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

// Types
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
} from "./types";

// Constants
export { FILE_COLORS, DEFAULT_SETTINGS, DATA_UILINT_ID } from "./types";
