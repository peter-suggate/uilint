/**
 * uilint-vision - Browser-safe exports
 *
 * This entry point is safe to import in browser contexts.
 * For Node.js-specific features (VisionAnalyzer), use the /node subpath.
 */

// Types
export type {
  // Core types
  VisionIssue,
  VisionIssueCategory,
  VisionIssueSeverity,
  ElementManifest,
  // Capture types
  CaptureRegion,
  CaptureMode,
  ScreenshotCapture,
  // Analysis types
  VisionAnalysisResult,
  // Settings types
  VisionAutoScanSettings,
  VisionStage,
  VisionErrorInfo,
  // Persistence types
  PersistedScreenshotMetadata,
  ScreenshotListResponse,
  // WebSocket message types
  VisionAnalyzeMessage,
  VisionResultMessage,
  VisionProgressMessage,
  VisionCheckMessage,
  VisionStatusMessage,
  VisionMessage,
} from "./types.js";

// Constants
export {
  DEFAULT_VISION_AUTO_SCAN_SETTINGS,
} from "./types.js";

export {
  VISION_DEFAULT_MODEL,
  VISION_ISSUE_CATEGORIES,
  VISION_MESSAGE_TYPES,
  MANIFEST_TEXT_MAX_LENGTH,
  MANIFEST_SKIP_TAGS,
} from "./constants.js";

// Plugin definition
export { visionPlugin } from "./plugin/index.js";

// Browser utilities (when available)
// export { collectElementManifest, captureScreenshot } from "./browser/index.js";

// Utility functions
// export { matchIssuesToManifest } from "./utils/issue-matcher.js";
