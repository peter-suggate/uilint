/**
 * UILint React UI
 *
 * Minimal, elegant UI for displaying lint issues as overlays
 */

// Main component
export { UILint, type UILintProps } from "./UILint";
export { UILint as default } from "./UILint";

// Types
export type { Issue, IssueSeverity, IssueStatus, RawESLintIssue } from "./types";
export {
  parseDataLoc,
  createIssueId,
  severityFromNumber,
  severityToColor,
  fromESLintIssue
} from "./types";

// Hooks (for advanced usage)
export { useIssues, useKeyboardShortcuts, useElementRects } from "./hooks";

// Components (for custom composition)
export { FloatingIcon } from "./components/FloatingIcon";
export { HeatmapOverlay } from "./components/HeatmapOverlay";
export { CommandPalette } from "./components/CommandPalette";
export { InspectorSidebar } from "./components/Inspector";

// Icons (for custom UI)
export * from "./icons";
