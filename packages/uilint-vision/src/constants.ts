/**
 * Vision Plugin Constants
 */

/**
 * Default vision model - qwen3-vl is recommended for UI analysis
 */
export const VISION_DEFAULT_MODEL = "qwen3-vl:8b-instruct";

/**
 * Vision issue categories for filtering and display
 */
export const VISION_ISSUE_CATEGORIES = [
  "spacing",
  "alignment",
  "color",
  "typography",
  "layout",
  "contrast",
  "visual-hierarchy",
  "other",
] as const;

/**
 * Maximum text length to include in element manifest
 */
export const MANIFEST_TEXT_MAX_LENGTH = 100;

/**
 * Tags to skip when collecting manifest
 */
export const MANIFEST_SKIP_TAGS = [
  "SCRIPT",
  "STYLE",
  "SVG",
  "TEMPLATE",
  "SLOT",
  "NOSCRIPT",
  "LINK",
  "META",
  "HEAD",
] as const;

/**
 * WebSocket message types for vision plugin
 */
export const VISION_MESSAGE_TYPES = {
  CHECK: "vision:check",
  STATUS: "vision:status",
  ANALYZE: "vision:analyze",
  RESULT: "vision:result",
  PROGRESS: "vision:progress",
} as const;
