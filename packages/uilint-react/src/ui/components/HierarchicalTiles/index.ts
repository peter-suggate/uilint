/**
 * HierarchicalTiles - Barrel Export
 *
 * A reusable framework for building expandable, hierarchical tile-based
 * navigation components with iOS-style glassmorphic design.
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Core hierarchy types
  HierarchyNode,
  HierarchyContextValue,

  // Component props from generic types
  ExpandableContainerProps,
  TileHeaderProps,
  SiblingStripProps,
  TileProps,

  // Shared types (re-exported from plugin-system)
  SeverityCounts,
  TileSeverityCounts,
  TileBucket,
  TileVisualState,
} from "./types";

// ============================================================================
// Context & Providers
// ============================================================================

// HierarchyProvider - Context for managing hierarchical expansion state
export { HierarchyProvider, useHierarchy } from "./HierarchyProvider";

// ============================================================================
// Components
// ============================================================================

// ExpandableContainer - Generic expandable wrapper with leaf content support
export { ExpandableContainer } from "./ExpandableContainer";

// TileHeader - Navigation header with back button
export { TileHeader } from "./TileHeader";
export type { TileHeaderProps as TileHeaderComponentProps } from "./TileHeader";

// SiblingStrip - Horizontal strip of collapsed siblings
export { SiblingStrip } from "./SiblingStrip";
export type {
  SiblingStripProps as SiblingStripComponentProps,
  SiblingStripItem,
} from "./SiblingStrip";

// Tile - Individual glassmorphic tile
export { Tile } from "./Tile";
export type {
  TileProps as TileComponentProps,
  TileBucket as TileComponentBucket,
  SeverityCounts as TileComponentSeverityCounts,
} from "./Tile";

// TileGrid - Bin-packing mosaic grid
export { TileGrid } from "./TileGrid";
export type { TileGridProps, BaseTileItem } from "./TileGrid";

// ============================================================================
// Layout Utilities
// ============================================================================

export {
  // Mosaic layout (primary grid algorithm)
  calculateMosaicLayout,
  calculateBucket,
  calculateBuckets,
  groupTilesByRow,
  getBucketHeight,

  // Expanded tile layout helpers
  calculateCollapsedStripLayout,
  calculateChildGridLayout,

  // Expanded layout algorithm
  calculateExpandedLayout,
} from "./layout";

export type {
  // Mosaic layout types
  TileLayout,
  MosaicLayoutResult,
  MosaicLayoutConfig,
  LayoutItem,

  // Collapsed strip layout types
  CollapsedStripConfig,
  CollapsedTileLayout,

  // Child grid layout types
  ChildGridConfig,
  ChildTileLayout,

  // Expanded layout types
  ExpandedLayoutConfig,
  ExpandedLayoutInput,
  ExpandedLayoutResult,
  TilePosition,
} from "./layout";

// ============================================================================
// Animation Utilities
// ============================================================================

export {
  // Easing curves
  crispEase,
  smoothOvershoot,
  quickEaseIn,

  // Duration constants
  DURATIONS,

  // Tile state variants
  tileContainerVariants,
  tileContainerTransition,

  // Expansion animation variants
  expansionWrapperVariants,
  expansionWrapperTransition,

  // Children stagger variants
  childrenContainerVariants,
  childTileVariants,
  childTileTransition,

  // Collapsed strip variants
  collapsedStripVariants,
  collapsedStripTransition,
  collapsedTileVariants,

  // Header variants
  headerVariants,
  headerTransition,

  // Back button variants
  backButtonVariants,
  backButtonTransition,

  // Layout transitions
  layoutTransition,
  quickLayoutTransition,

  // Utility functions
  getStaggerDelay,
  getTileAnimationState,
} from "./animations";
