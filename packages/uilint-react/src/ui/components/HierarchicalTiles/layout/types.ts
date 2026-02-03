/**
 * Layout Types for Tile Mosaic
 *
 * Defines types for calculating tile positions using bin-packing algorithm.
 * Uses absolute positioning for true masonry layout.
 */

import type { TileBucket, TileItem } from "../../../../core/plugin-system/types";

/**
 * Layout information for a single tile
 */
export interface TileLayout {
  /** Tile ID */
  id: string;
  /** Row index (0-based) - legacy, not used for absolute positioning */
  row: number;
  /** Column index within row (0-based) */
  column: number;
  /** CSS width value (e.g., "158px") */
  width: string;
  /** Width as fraction (0.5, 0.333, etc.) */
  widthFraction: number;
  /** Size bucket for height */
  bucket: TileBucket;
  /** Whether this tile starts a new row */
  isRowStart: boolean;
  /** Absolute X position in pixels */
  x: number;
  /** Absolute Y position in pixels */
  y: number;
  /** Height in pixels */
  height: number;
}

/**
 * Result of mosaic layout calculation
 */
export interface MosaicLayoutResult {
  /** Map of tile ID to layout info */
  tiles: Map<string, TileLayout>;
  /** Total number of rows (approximate) */
  rowCount: number;
  /** Number of columns */
  columnCount: number;
  /** Layout pattern used */
  pattern: "single" | "pair" | "trio" | "quad" | "grid";
  /** Total height of the layout in pixels */
  totalHeight: number;
}

/**
 * Configuration for mosaic layout calculation
 */
export interface MosaicLayoutConfig {
  /** Available width in pixels (default: 500) */
  availableWidth?: number;
  /** Gap between tiles in pixels (default: 12) */
  gap?: number;
  /** Minimum tile width in pixels (default: 140) */
  minTileWidth?: number;
  /** Padding around the grid (default: { top: 0, right: 0, bottom: 0, left: 0 }) */
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

/**
 * Input item for layout calculation (minimal interface)
 */
export interface LayoutItem {
  id: string;
  count: number;
}
