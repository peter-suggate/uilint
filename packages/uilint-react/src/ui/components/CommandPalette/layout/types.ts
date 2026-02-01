/**
 * Layout Types for Tile Mosaic
 *
 * Defines types for calculating tile positions in a flexbox-based mosaic grid.
 */

import type { TileBucket, TileItem } from "../../../../core/plugin-system/types";

/**
 * Layout information for a single tile
 */
export interface TileLayout {
  /** Tile ID */
  id: string;
  /** Row index (0-based) */
  row: number;
  /** Column index within row (0-based) */
  column: number;
  /** CSS width value (e.g., "calc(50% - 6px)") */
  width: string;
  /** Width as fraction (0.5, 0.333, etc.) */
  widthFraction: number;
  /** Size bucket for height */
  bucket: TileBucket;
  /** Whether this tile starts a new row */
  isRowStart: boolean;
}

/**
 * Result of mosaic layout calculation
 */
export interface MosaicLayoutResult {
  /** Map of tile ID to layout info */
  tiles: Map<string, TileLayout>;
  /** Total number of rows */
  rowCount: number;
  /** Number of columns (for grid patterns) */
  columnCount: number;
  /** Layout pattern used */
  pattern: "single" | "pair" | "trio" | "quad" | "grid";
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
}

/**
 * Input item for layout calculation (minimal interface)
 */
export interface LayoutItem {
  id: string;
  count: number;
}
