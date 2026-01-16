/**
 * Types for UILint Source Visualization
 */

import type { VisionIssue } from "../../scanner/vision-capture";

/**
 * Display mode for ESLint issue visualization
 */
export type IssueDisplayMode = "badges" | "heatmap";

/**
 * Source location from data-loc attribute
 */
export interface SourceLocation {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

/**
 * A scanned DOM element with its source information
 * Source is always present from data-loc attribute
 */
export interface ScannedElement {
  /**
   * Unique per-instance ID derived from data-loc.
   * Format: "loc:path:line:column#occurrence"
   */
  id: string;
  element: Element;
  tagName: string;
  className: string;
  /** Source location (always present from data-loc) */
  source: SourceLocation;
  rect: DOMRect;
}

/**
 * A source file with all its associated elements
 */
export interface SourceFile {
  path: string;
  displayName: string;
  color: string;
  elements: ScannedElement[];
}

/**
 * User-configurable settings for the overlay
 */
export interface UILintSettings {
  hideNodeModules: boolean;
  autoScanEnabled: boolean;
}

/**
 * Auto-scan settings for ESLint and Vision analysis
 * Persisted to localStorage
 */
export interface AutoScanSettings {
  eslint: {
    /** Auto-scan when page first loads */
    onPageLoad: boolean;
    /** Re-scan when files change (existing behavior) */
    onFileChange: boolean;
    /** Display mode for issue visualization */
    displayMode: IssueDisplayMode;
  };
  vision: {
    /** Auto-capture and analyze on route change */
    onRouteChange: boolean;
    /** Auto-capture and analyze on initial page load */
    onInitialLoad: boolean;
  };
}

/**
 * Default auto-scan settings
 */
export const DEFAULT_AUTO_SCAN_SETTINGS: AutoScanSettings = {
  eslint: {
    onPageLoad: false,
    onFileChange: true,
    displayMode: "badges",
  },
  vision: {
    onRouteChange: false,
    onInitialLoad: false,
  },
};

/**
 * Screenshot capture entry for the gallery
 */
export interface ScreenshotCapture {
  /** Unique ID for this capture */
  id: string;
  /** Route where the capture was taken */
  route: string;
  /** Base64 data URL of the screenshot (for in-memory captures) */
  dataUrl?: string;
  /** Filename for persisted screenshots (used to fetch from API) */
  filename?: string;
  /** Unix timestamp when captured */
  timestamp: number;
  /** Type of capture */
  type: "full" | "region";
  /** Region bounds if type is 'region' */
  region?: { x: number; y: number; width: number; height: number };
  /** Whether this is a persisted screenshot loaded from disk */
  persisted?: boolean;
  /** Vision issues specific to this capture */
  issues?: VisionIssue[];
}

/**
 * Persisted screenshot metadata from the API
 */
export interface PersistedScreenshotMetadata {
  filename: string;
  timestamp: number;
  screenshotFile: string;
  route: string | null;
  issues: VisionIssue[] | null;
  manifest: unknown | null;
  analysisResult: {
    route: string;
    timestamp: number;
    issues: VisionIssue[];
    analysisTime: number;
    error?: string;
  } | null;
}

/**
 * API response for listing screenshots
 */
export interface ScreenshotListResponse {
  screenshots: Array<{
    filename: string;
    metadata: PersistedScreenshotMetadata | null;
  }>;
  projectRoot: string;
  screenshotsDir: string;
}

/**
 * State for the auto-scan feature
 */
export interface AutoScanState {
  status: "idle" | "scanning" | "paused" | "complete";
  currentIndex: number;
  totalElements: number;
  elements: ScannedElement[];
}

/**
 * ESLint issue from WebSocket server (uilint serve)
 */
export interface ESLintIssue {
  /** Line number in source file */
  line: number;
  /** Column number */
  column?: number;
  /** Issue description */
  message: string;
  /** ESLint rule ID (e.g., "uilint/semantic", "uilint/no-arbitrary-tailwind") */
  ruleId?: string;
  /** data-loc value to match to DOM element */
  dataLoc?: string;
}

/**
 * Cached issue data for a scanned element
 */
export interface ElementIssue {
  elementId: string;
  /** ESLint rule violations from uilint-eslint (including semantic rule) */
  issues: ESLintIssue[];
  status: "pending" | "scanning" | "complete" | "error";
}

/**
 * Element detected under the cursor during Alt-key locator mode
 */
export interface LocatorTarget {
  element: Element;
  source: SourceLocation;
  rect: DOMRect;
}

/**
 * Element being inspected in the sidebar
 */
export interface InspectedElement {
  element: Element;
  source: SourceLocation;
  rect: DOMRect;
  /** Optional ID from auto-scan to link to cached results */
  scannedElementId?: string;
}

/**
 * File-level issue (not mapped to a specific DOM element)
 */
export interface FileIssue {
  filePath: string;
  issues: ESLintIssue[];
}

/**
 * Response from the source API
 */
export interface SourceApiResponse {
  content: string;
  relativePath: string;
}

/**
 * Cached source file content
 */
export interface CachedSource {
  content: string;
  relativePath: string;
  fetchedAt: number;
}

/**
 * Color palette for source file differentiation
 */
export const FILE_COLORS = [
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#10B981", // emerald
  "#F59E0B", // amber
  "#06B6D4", // cyan
  "#EF4444", // red
  "#84CC16", // lime
  "#6366F1", // indigo
  "#F97316", // orange
  "#14B8A6", // teal
  "#A855F7", // purple
] as const;

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: UILintSettings = {
  hideNodeModules: true,
  autoScanEnabled: false,
};

/**
 * Default auto-scan state
 */
export const DEFAULT_AUTO_SCAN_STATE: AutoScanState = {
  status: "idle",
  currentIndex: 0,
  totalElements: 0,
  elements: [],
};

/**
 * Data attribute used to mark scanned elements
 */
export const DATA_UILINT_ID = "data-ui-lint-id";

/**
 * Re-export vision types for convenience
 */
export type {
  VisionIssue,
  VisionAnalysisResult,
  ElementManifest,
} from "../../scanner/vision-capture";
