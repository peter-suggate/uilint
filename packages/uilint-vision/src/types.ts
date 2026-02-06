/**
 * Vision Plugin Types
 *
 * All types for vision-based UI consistency analysis.
 * Consolidated from uilint-core and uilint-react.
 */

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Vision issue category
 */
export type VisionIssueCategory =
  | "spacing"
  | "alignment"
  | "color"
  | "typography"
  | "layout"
  | "contrast"
  | "visual-hierarchy"
  | "other";

/**
 * Vision issue severity
 */
export type VisionIssueSeverity = "error" | "warning" | "info";

/**
 * Vision analysis issue from the LLM
 */
export interface VisionIssue {
  /** Text of the element this issue refers to */
  elementText: string;
  /** Issue description */
  message: string;
  /** Issue category */
  category: VisionIssueCategory;
  /** Severity level */
  severity: VisionIssueSeverity;
  /** Matched dataLoc from manifest (filled in after text matching) */
  dataLoc?: string;
  /** Matched element ID (filled in after text matching) */
  elementId?: string;
  /** Suggested fix (optional) */
  suggestion?: string;
}

/**
 * Element manifest entry for vision analysis.
 * Maps visible elements to their source locations.
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

// =============================================================================
// CAPTURE TYPES
// =============================================================================

/**
 * Region bounds for partial screenshot capture
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
  type: CaptureMode;
  /** Region bounds if type is 'region' */
  region?: CaptureRegion;
  /** Whether this is a persisted screenshot loaded from disk */
  persisted?: boolean;
  /** Vision issues specific to this capture */
  issues?: VisionIssue[];
}

// =============================================================================
// ANALYSIS TYPES
// =============================================================================

/**
 * Vision analysis result from the analyzer
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
  /** Full prompt sent to the model (for debugging) */
  prompt?: string;
  /** Raw LLM response (for debugging) */
  rawResponse?: string;
}

// =============================================================================
// SETTINGS & STATE TYPES
// =============================================================================

/**
 * Auto-scan settings for Vision analysis.
 * Persisted to localStorage.
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
 * Vision error information with stage context
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

// =============================================================================
// PERSISTENCE TYPES
// =============================================================================

/**
 * Persisted screenshot metadata from the API
 */
export interface PersistedScreenshotMetadata {
  filename: string;
  timestamp: number;
  screenshotFile: string;
  route: string | null;
  issues: VisionIssue[] | null;
  manifest: ElementManifest[] | null;
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

// =============================================================================
// WEBSOCKET MESSAGE TYPES
// =============================================================================

/**
 * Client -> Server: Request vision analysis
 */
export interface VisionAnalyzeMessage {
  type: "vision:analyze";
  route: string;
  timestamp: number;
  screenshot: string;
  manifest: ElementManifest[];
  requestId?: string;
}

/**
 * Server -> Client: Vision analysis result
 */
export interface VisionResultMessage {
  type: "vision:result";
  route: string;
  issues: VisionIssue[];
  analysisTime: number;
  error?: string;
  requestId?: string;
}

/**
 * Server -> Client: Vision analysis progress
 */
export interface VisionProgressMessage {
  type: "vision:progress";
  route: string;
  phase: string;
  requestId?: string;
}

/**
 * Client -> Server: Check vision availability
 */
export interface VisionCheckMessage {
  type: "vision:check";
  requestId?: string;
}

/**
 * Server -> Client: Vision availability status
 */
export interface VisionStatusMessage {
  type: "vision:status";
  available: boolean;
  model?: string;
  requestId?: string;
}

/**
 * Union of all vision WebSocket messages
 */
export type VisionMessage =
  | VisionAnalyzeMessage
  | VisionResultMessage
  | VisionProgressMessage
  | VisionCheckMessage
  | VisionStatusMessage;
