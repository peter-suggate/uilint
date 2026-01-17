/**
 * UILint Source Visualization Components
 *
 * A dev overlay for inspecting React components and analyzing code with LLM.
 * Use Alt+Click on any element to open the inspector sidebar.
 */

// Zustand store for direct access
export { useUILintStore } from "./store";
export type { UILintStore } from "./store";

// UI components
export { FloatingIcon } from "./FloatingIcon";
export { CommandPalette } from "./command-palette";
export { LocatorOverlay } from "./LocatorOverlay";
export { VisionIssueBadges } from "./VisionIssueBadge";
export { VisionIssuesPanel } from "./VisionIssuesPanel";
export { ScreenshotViewer } from "./ScreenshotViewer";

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

// DOM observation hook (for navigation detection)
export { useDOMObserver, getDataLocElementCount } from "./useDOMObserver";

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
