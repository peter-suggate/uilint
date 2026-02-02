/**
 * Tile Mosaic Layout Module
 *
 * Pure functions for calculating tile positions in a flexbox-based mosaic grid.
 */

export {
  calculateMosaicLayout,
  calculateBucket,
  calculateBuckets,
  groupTilesByRow,
  getBucketHeight,
  // Expanded tile layout helpers
  calculateCollapsedStripLayout,
  calculateChildGridLayout,
} from "./mosaic-layout";

export type {
  TileLayout,
  MosaicLayoutResult,
  MosaicLayoutConfig,
  LayoutItem,
} from "./types";

// Re-export expanded layout types
export type {
  CollapsedStripConfig,
  CollapsedTileLayout,
  ChildGridConfig,
  ChildTileLayout,
} from "./mosaic-layout";
