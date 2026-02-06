/**
 * Vision Plugin Types
 *
 * Re-exports types from uilint-vision for use in React components.
 */

// Re-export all types from uilint-vision
export type {
  VisionIssue,
  VisionIssueCategory,
  VisionIssueSeverity,
  ElementManifest,
  CaptureRegion,
  CaptureMode,
  ScreenshotCapture,
  VisionAnalysisResult,
  VisionAutoScanSettings,
  VisionStage,
  VisionErrorInfo,
  PersistedScreenshotMetadata,
  ScreenshotListResponse,
} from "uilint-vision";

// Re-export constants
export { DEFAULT_VISION_AUTO_SCAN_SETTINGS } from "uilint-vision";
