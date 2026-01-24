/**
 * Vision Plugin Types
 *
 * Types for AI-powered visual consistency analysis.
 * Extracted from scanner/vision-capture.ts and components/ui-lint/store.ts.
 */

/**
 * Vision analysis issue from the LLM
 */
export interface VisionIssue {
  /** Text of the element this issue refers to */
  elementText: string;
  /** Issue description */
  message: string;
  /** Issue category */
  category:
    | "spacing"
    | "alignment"
    | "color"
    | "typography"
    | "layout"
    | "contrast"
    | "visual-hierarchy"
    | "other";
  /** Severity level */
  severity: "error" | "warning" | "info";
  /** Matched dataLoc from manifest (filled in after text matching) */
  dataLoc?: string;
  /** Matched element ID (filled in after text matching) */
  elementId?: string;
}

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
 * Auto-scan settings for Vision analysis
 * Persisted to localStorage
 */
export interface VisionAutoScanSettings {
  /** Auto-capture and analyze on route change */
  onRouteChange: boolean;
  /** Auto-capture and analyze on initial page load */
  onInitialLoad: boolean;
}

/**
 * Default vision auto-scan settings
 */
export const DEFAULT_VISION_AUTO_SCAN_SETTINGS: VisionAutoScanSettings = {
  onRouteChange: false,
  onInitialLoad: false,
};

/**
 * Vision pipeline stage (for error tracking)
 */
export type VisionStage = "capture" | "manifest" | "ws" | "vision";

/**
 * Vision error information with stage context for user-friendly UI
 */
export interface VisionErrorInfo {
  /** The stage where the error occurred */
  stage: VisionStage;
  /** Human-readable error message */
  message: string;
  /** Route that was being analyzed */
  route: string;
  /** Timestamp of the error */
  timestamp: number;
}

/**
 * Region selection bounds for partial screenshot capture
 */
export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Capture mode for vision analysis
 */
export type CaptureMode = "full" | "region";

/**
 * Element manifest entry for vision analysis
 * (Re-exported from vision-capture for convenience)
 */
export interface ElementManifest {
  /** Unique ID (data-loc if present, otherwise generated) */
  id: string;
  /** Visible text content (truncated to 100 chars) */
  text: string;
  /** data-loc value: "path:line:column" */
  dataLoc: string;
  /** Bounding rectangle */
  rect: { x: number; y: number; width: number; height: number };
  /** HTML tag name */
  tagName: string;
  /** Inferred semantic role (button, heading, link, etc.) */
  role?: string;
  /** Total instances with same dataLoc (if deduplicated) */
  instanceCount?: number;
}

/**
 * Vision analysis result
 */
export interface VisionAnalysisResult {
  /** Route/path that was analyzed */
  route: string;
  /** Timestamp of capture */
  timestamp: number;
  /** Screenshot as base64 data URL */
  screenshotDataUrl?: string;
  /** Element manifest */
  manifest: ElementManifest[];
  /** Issues found by vision analysis */
  issues: VisionIssue[];
  /** Analysis duration in ms */
  analysisTime: number;
  /** Error message if analysis failed */
  error?: string;
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
