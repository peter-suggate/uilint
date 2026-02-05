/**
 * FileNodeAdapter - Adapts FileGroup data to HierarchyNode structure
 *
 * This module provides the bridge between the file-groups-selector data
 * and the generic HierarchicalTiles framework. It enables FileGroups to be
 * rendered as expandable tiles with consistent styling.
 *
 * Exports:
 * - FileNodeData: Interface wrapping FileGroup
 * - FileNode: Type alias for HierarchyNode<FileNodeData>
 * - fileGroupsToNodes: Transform FileGroup[] to FileNode[]
 * - FileCardHeader: Component replicating FileSection header styling
 * - renderFileHeader: Function for ExpandableContainer's renderHeader prop
 */
import React from "react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import type { FileGroup } from "../../../core/store/file-groups-selector";
import type { HierarchyNode } from "../HierarchicalTiles/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Data payload for file hierarchy nodes.
 * Wraps the FileGroup to carry full file information through the hierarchy.
 */
export interface FileNodeData {
  /** The underlying FileGroup data */
  fileGroup: FileGroup;
}

/**
 * Type alias for file-based hierarchy nodes.
 * Represents a file in the hierarchical tiles structure.
 */
export type FileNode = HierarchyNode<FileNodeData>;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get CSS class for severity dots based on severity type.
 */
function getSeverityDotsClass(severity: "error" | "warning" | "info"): string {
  switch (severity) {
    case "error":
      return "bg-error/70";
    case "warning":
      return "bg-warning/70";
    case "info":
      return "bg-info/70";
  }
}

// ============================================================================
// Sub-components
// ============================================================================

interface SeverityDotsProps {
  severityCounts: { error: number; warning: number; info: number };
}

/**
 * Minimal severity indicators - dots with counts.
 * Clean and unobtrusive visual representation of issue distribution.
 */
function SeverityDots({ severityCounts }: SeverityDotsProps) {
  const dots: Array<{ type: "error" | "warning" | "info"; count: number }> = [];

  if (severityCounts.error > 0) dots.push({ type: "error", count: severityCounts.error });
  if (severityCounts.warning > 0) dots.push({ type: "warning", count: severityCounts.warning });
  if (severityCounts.info > 0) dots.push({ type: "info", count: severityCounts.info });

  if (dots.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {dots.map(({ type, count }) => (
        <div key={type} className="flex items-center gap-1">
          <div className={cn("w-1.5 h-1.5 rounded-full", getSeverityDotsClass(type))} />
          <span className="text-[11px] text-muted-foreground/50 tabular-nums">
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Transform Function
// ============================================================================

/**
 * Transform FileGroup array to HierarchyNode array.
 *
 * Maps FileGroup properties to HierarchyNode structure:
 * - id: fileGroup.filePath (unique identifier)
 * - label: fileGroup.fileName (displayed prominently)
 * - subtitle: fileGroup.filePath (full path in mono font)
 * - tileType: "file" (for visual differentiation)
 * - count: fileGroup.totalCount (for badge/sizing)
 * - severityCounts: fileGroup.severityCounts (for severity indicators)
 * - data: { fileGroup } (full data payload)
 * - isLeaf: true (FileSourceView is the leaf content)
 * - children: undefined (leaf nodes have no child tiles)
 *
 * @param fileGroups - Array of FileGroup objects from the selector
 * @returns Array of FileNode objects ready for HierarchicalTiles
 */
export function fileGroupsToNodes(fileGroups: FileGroup[]): FileNode[] {
  return fileGroups.map((fileGroup) => ({
    id: fileGroup.filePath,
    label: fileGroup.fileName,
    subtitle: fileGroup.filePath,
    tileType: "file" as const,
    count: fileGroup.totalCount,
    severityCounts: fileGroup.severityCounts,
    data: { fileGroup },
    isLeaf: true,
    children: undefined,
  }));
}

// ============================================================================
// FileCardHeader Component
// ============================================================================

export interface FileCardHeaderProps {
  /** The file node to render header for */
  node: FileNode;
  /** Whether this node is currently expanded */
  isExpanded: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * FileCardHeader - Replicates the FileSection header styling.
 *
 * Displays:
 * - File name (prominent, font-light text-[17px])
 * - Directory (text-xs text-muted-foreground/50)
 * - Count (text-2xl font-extralight)
 * - Severity dots
 *
 * This component is designed to be used as the header content
 * within ExpandableContainer or similar tile-based layouts.
 */
export function FileCardHeader({ node, isExpanded: _isExpanded, className }: FileCardHeaderProps) {
  const { fileGroup } = node.data;

  return (
    <div
      className={cn(
        "w-full flex items-start justify-between gap-4 p-4",
        "text-left",
        className
      )}
    >
      {/* Left side: File info */}
      <div className="flex-1 min-w-0">
        {/* File name - prominent */}
        <div className="font-light text-[17px] text-foreground truncate leading-tight">
          {fileGroup.fileName}
        </div>
        {/* Directory - secondary line */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-muted-foreground/50 truncate">
            {fileGroup.directory}
          </span>
        </div>
      </div>

      {/* Right side: Count and severity */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {/* Large count number */}
        <span className="text-2xl font-extralight text-foreground/70 leading-none tabular-nums">
          {fileGroup.totalCount}
        </span>
        {/* Severity breakdown */}
        <SeverityDots severityCounts={fileGroup.severityCounts} />
      </div>
    </div>
  );
}

// ============================================================================
// Render Function for ExpandableContainer
// ============================================================================

/**
 * Render function for ExpandableContainer's renderHeader prop.
 *
 * This function returns a ReactNode that renders the FileCardHeader
 * component. It's designed to be passed to ExpandableContainer.
 *
 * @param node - The FileNode to render a header for
 * @param isExpanded - Whether the node is currently expanded
 * @returns ReactNode rendering the file header
 *
 * @example
 * ```tsx
 * <ExpandableContainer
 *   node={fileNode}
 *   renderHeader={(node) => renderFileHeader(node, isExpanded)}
 *   // ... other props
 * />
 * ```
 */
export function renderFileHeader(node: FileNode, isExpanded: boolean): ReactNode {
  return <FileCardHeader node={node} isExpanded={isExpanded} />;
}
