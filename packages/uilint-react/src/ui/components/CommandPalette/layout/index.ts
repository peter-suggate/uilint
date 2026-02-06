/**
 * Tile Mosaic Layout Module
 *
 * Re-exports layout utilities from HierarchicalTiles/layout for backwards compatibility.
 * The canonical implementation lives in HierarchicalTiles/layout.
 */

// Re-export everything from the canonical location
export {
  calculateMosaicLayout,
  calculateBucket,
  calculateBuckets,
  groupTilesByRow,
  getBucketHeight,
  calculateCollapsedStripLayout,
  calculateChildGridLayout,
  calculateExpandedLayout,
} from "../../HierarchicalTiles/layout";

export type {
  TileLayout,
  MosaicLayoutResult,
  MosaicLayoutConfig,
  LayoutItem,
  CollapsedStripConfig,
  CollapsedTileLayout,
  ChildGridConfig,
  ChildTileLayout,
  ExpandedLayoutConfig,
  ExpandedLayoutInput,
  ExpandedLayoutResult,
  TilePosition,
} from "../../HierarchicalTiles/layout";
