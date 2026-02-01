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
} from "./mosaic-layout";

export type {
  TileLayout,
  MosaicLayoutResult,
  MosaicLayoutConfig,
  LayoutItem,
} from "./types";
