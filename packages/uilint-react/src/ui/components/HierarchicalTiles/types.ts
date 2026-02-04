/**
 * HierarchicalTiles Type Definitions
 *
 * Core generic types for the reusable hierarchical tiles framework.
 * This module provides type-safe interfaces for building expandable,
 * hierarchical tile-based navigation components.
 */

import type { ReactNode } from "react";
import type {
  TileBucket,
  TileSeverityCounts,
  TileVisualState,
} from "../../../core/plugin-system/types";

// ============================================================================
// Re-exports from Plugin System
// ============================================================================

/**
 * Re-export TileBucket from plugin-system types.
 * Size bucket for tiles in the masonry grid.
 */
export type { TileBucket };

/**
 * Re-export TileSeverityCounts as SeverityCounts for convenience.
 * Severity counts for visual breakdown in tiles.
 */
export type { TileSeverityCounts as SeverityCounts };

/**
 * Also export TileSeverityCounts directly for compatibility.
 */
export type { TileSeverityCounts };

/**
 * Re-export TileVisualState from plugin-system types.
 * Visual state of a tile in the expandable grid.
 */
export type { TileVisualState };

// ============================================================================
// Local Type Alias
// ============================================================================

/**
 * Local alias for SeverityCounts to use in interfaces.
 */
type SeverityCounts = TileSeverityCounts;

// ============================================================================
// Generic Hierarchy Node
// ============================================================================

/**
 * Generic node type for hierarchical tile structures.
 *
 * Represents a single node in a tree hierarchy that can be rendered as a tile.
 * The generic parameter T allows arbitrary data payloads for different use cases.
 *
 * @template T - The type of the data payload attached to this node
 *
 * @example
 * ```typescript
 * // Node for ESLint rules
 * type RuleNode = HierarchyNode<{ ruleId: string; fixable: boolean }>;
 *
 * // Node for file system
 * type FileNode = HierarchyNode<{ path: string; isDirectory: boolean }>;
 * ```
 */
export interface HierarchyNode<T> {
  /**
   * Unique identifier for this node.
   * Must be unique within the entire hierarchy.
   */
  id: string;

  /**
   * Primary display label for the tile.
   */
  label: string;

  /**
   * Optional secondary text displayed below the label.
   */
  subtitle?: string;

  /**
   * Optional icon to display in the tile.
   * Can be a React component, emoji, or any renderable element.
   */
  icon?: ReactNode;

  /**
   * Optional count for badge display and bucket sizing.
   * Typically represents number of items, issues, or children.
   */
  count?: number;

  /**
   * Optional severity breakdown for visual indicators.
   * When provided, tiles can show error/warning/info distribution.
   */
  severityCounts?: SeverityCounts;

  /**
   * Optional preview messages for large tiles.
   * Typically the first few issue messages for preview.
   */
  previewMessages?: string[];

  /**
   * Optional file count for displaying in large tiles.
   */
  fileCount?: number;

  /**
   * Arbitrary data payload associated with this node.
   * Contains domain-specific information for the use case.
   */
  data: T;

  /**
   * Child nodes in the hierarchy.
   * When present and non-empty, the node can be expanded to show children.
   */
  children?: HierarchyNode<T>[];

  /**
   * Indicates that children exist but have not been loaded yet.
   * When true, expanding the node should trigger lazy loading of children.
   * Mutually exclusive with having children already populated.
   */
  hasChildren?: boolean;

  /**
   * Indicates that this node is a leaf node with custom content.
   * When true, expanding shows custom content via renderChildren
   * instead of child tiles.
   */
  isLeaf?: boolean;
}

// ============================================================================
// Hierarchy Context
// ============================================================================

/**
 * Context value for managing hierarchical expansion state.
 *
 * Provides the current expansion state and methods to modify it.
 * Used by components to track and control which nodes are expanded.
 *
 * @template T - The type of the data payload in hierarchy nodes
 *
 * @example
 * ```typescript
 * const { expansionPath, expand, collapseToLevel } = useHierarchyContext<RuleData>();
 *
 * // Expand a node
 * expand(selectedNode);
 *
 * // Go back one level
 * collapseToLevel(currentLevel - 1);
 * ```
 */
export interface HierarchyContextValue<T> {
  /**
   * Array of nodes representing the current expansion path.
   * First element is the root-level expanded node, subsequent elements
   * are nested expansions. Empty array means no expansion.
   */
  expansionPath: HierarchyNode<T>[];

  /**
   * Current depth level in the hierarchy (0 = root, 1 = first expansion, etc.).
   * Equals the length of expansionPath.
   */
  currentLevel: number;

  /**
   * ID of the currently expanded node at the deepest level.
   * Null if no node is expanded.
   */
  expandedNodeId: string | null;

  /**
   * Expand a node, adding it to the expansion path.
   * If a node at the same level is already expanded, it will be replaced.
   *
   * @param node - The node to expand
   */
  expand: (node: HierarchyNode<T>) => void;

  /**
   * Collapse the most recently expanded node.
   * Removes the last entry from the expansion path.
   */
  collapse: () => void;

  /**
   * Collapse to a specific level in the hierarchy.
   * Useful for breadcrumb-style navigation.
   *
   * @param level - The level to collapse to (0 = fully collapsed)
   */
  collapseToLevel: (level: number) => void;

  /**
   * Collapse all expansions, returning to the root view.
   * Equivalent to collapseToLevel(0).
   */
  collapseAll: () => void;
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for the expandable container component.
 *
 * The expandable container wraps a tile and its expanded content,
 * handling the expansion animation and layout.
 *
 * @template T - The type of the data payload in hierarchy nodes
 */
export interface ExpandableContainerProps<T> {
  /**
   * The node this container represents.
   */
  node: HierarchyNode<T>;

  /**
   * Whether this node is currently expanded.
   */
  isExpanded: boolean;

  /**
   * Callback when the node should be expanded.
   */
  onExpand: () => void;

  /**
   * Callback when the node should be collapsed.
   */
  onCollapse: () => void;

  /**
   * Sibling nodes at the same level.
   * Used for rendering the collapsed sibling strip.
   */
  siblings?: HierarchyNode<T>[];

  /**
   * Callback when a sibling tile is clicked.
   * Typically switches expansion to the clicked sibling.
   *
   * @param node - The sibling node that was clicked
   */
  onSiblingClick?: (node: HierarchyNode<T>) => void;

  /**
   * Custom render function for the tile header.
   * Override default header rendering for custom layouts.
   *
   * @param node - The node to render a header for
   * @returns React element for the header
   */
  renderHeader?: (node: HierarchyNode<T>) => ReactNode;

  /**
   * Custom render function for leaf node content.
   * Called when isLeaf is true and the node is expanded.
   * Use this for custom detail views instead of child tiles.
   *
   * @param node - The leaf node to render content for
   * @returns React element for the leaf content
   */
  renderChildren?: (node: HierarchyNode<T>) => ReactNode;

  /**
   * Custom render function for child tiles.
   * Override default tile rendering for custom appearances.
   *
   * @param node - The node to render as a tile
   * @returns React element for the tile
   */
  renderTile?: (node: HierarchyNode<T>) => ReactNode;

  /**
   * Layout mode for child tiles.
   * - 'grid': Standard CSS grid layout
   * - 'list': Vertical list layout
   * - 'masonry': Pinterest-style masonry layout
   *
   * @default 'grid'
   */
  layout?: "grid" | "list" | "masonry";

  /**
   * Whether to show the collapsed sibling strip.
   * When true and expanded, shows minimized versions of sibling tiles.
   *
   * @default true
   */
  showSiblingStrip?: boolean;
}

/**
 * Props for the tile header component.
 *
 * The header displays the node's label, icon, counts, and expansion controls.
 */
export interface TileHeaderProps {
  /**
   * Primary display label.
   */
  label: string;

  /**
   * Optional secondary text.
   */
  subtitle?: string;

  /**
   * Optional icon to display.
   */
  icon?: ReactNode;

  /**
   * Optional count for badge display.
   */
  count?: number;

  /**
   * Optional severity breakdown for visual indicator.
   */
  severityCounts?: SeverityCounts;

  /**
   * Whether the associated tile is expanded.
   */
  isExpanded?: boolean;

  /**
   * Whether the tile can be expanded (has children or hasChildren is true).
   */
  isExpandable?: boolean;

  /**
   * Callback when the expand/collapse button is clicked.
   */
  onExpandToggle?: () => void;

  /**
   * Callback when the header is clicked.
   * May differ from onExpandToggle for selection vs expansion behavior.
   */
  onClick?: () => void;

  /**
   * Additional CSS class names.
   */
  className?: string;
}

/**
 * Props for the sibling strip component.
 *
 * The sibling strip shows minimized versions of sibling tiles
 * when a tile is expanded, allowing quick navigation between siblings.
 *
 * @template T - The type of the data payload in hierarchy nodes
 */
export interface SiblingStripProps<T> {
  /**
   * Array of sibling nodes to display.
   */
  siblings: HierarchyNode<T>[];

  /**
   * ID of the currently expanded sibling.
   */
  expandedId: string;

  /**
   * Callback when a sibling is clicked.
   *
   * @param node - The clicked sibling node
   */
  onSiblingClick: (node: HierarchyNode<T>) => void;

  /**
   * Custom render function for sibling items.
   *
   * @param node - The sibling node to render
   * @param isExpanded - Whether this sibling is the expanded one
   * @returns React element for the sibling item
   */
  renderSibling?: (node: HierarchyNode<T>, isExpanded: boolean) => ReactNode;

  /**
   * Orientation of the sibling strip.
   *
   * @default 'horizontal'
   */
  orientation?: "horizontal" | "vertical";

  /**
   * Additional CSS class names.
   */
  className?: string;
}

/**
 * Generic props for tile components.
 *
 * Base props that all tile variants should accept.
 *
 * @template T - The type of the data payload in hierarchy nodes
 */
export interface TileProps<T> {
  /**
   * The node this tile represents.
   */
  node: HierarchyNode<T>;

  /**
   * Visual state of the tile.
   * Determines styling and interaction behavior.
   */
  visualState?: TileVisualState;

  /**
   * Size bucket for the tile.
   * Determines tile dimensions in grid layouts.
   */
  bucket?: TileBucket;

  /**
   * Whether the tile is currently selected.
   */
  isSelected?: boolean;

  /**
   * Whether the tile is currently expanded.
   */
  isExpanded?: boolean;

  /**
   * Whether the tile can be expanded.
   */
  isExpandable?: boolean;

  /**
   * Callback when the tile is clicked.
   */
  onClick?: () => void;

  /**
   * Callback when the expand button is clicked.
   * If not provided, onClick handles expansion.
   */
  onExpand?: () => void;

  /**
   * Callback when the tile receives keyboard focus.
   */
  onFocus?: () => void;

  /**
   * Callback when the tile loses keyboard focus.
   */
  onBlur?: () => void;

  /**
   * Additional CSS class names.
   */
  className?: string;

  /**
   * Test ID for automated testing.
   */
  testId?: string;
}
