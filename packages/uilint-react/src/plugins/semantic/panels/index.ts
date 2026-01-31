/**
 * Semantic Plugin Panels
 *
 * Inspector panels for the semantic analysis plugin.
 */

export { DuplicatesInspectorPanel, getDuplicatesPanelTitle } from "./DuplicatesInspectorPanel";
export { DuplicateSimilarityBadge } from "./DuplicateSimilarityBadge";
export { ScrollableCodeSection } from "./ScrollableCodeSection";
export { useDiffHighlights, getSegmentOpacity } from "./useDiffHighlights";
export type { DiffSegment, DiffLine, DiffHighlightsResult } from "./useDiffHighlights";
