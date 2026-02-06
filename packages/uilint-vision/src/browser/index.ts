/**
 * Vision Browser Utilities
 *
 * Browser-specific utilities for screenshot capture and manifest collection.
 * Uses DOM APIs - no React.
 */

export { collectElementManifest } from "./manifest.js";
export { captureScreenshot, captureRegion } from "./capture.js";
export {
  getCurrentRoute,
  generateTimestamp,
  matchIssuesToManifest,
  buildVisionAnalysisPayload,
} from "./utils.js";

// Alias for backwards compatibility
export { captureRegion as captureScreenshotRegion } from "./capture.js";
