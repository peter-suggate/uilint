/**
 * PreviewPane - Preview panel for the two-panel command palette
 *
 * Renders plugin-provided preview content for the currently selected
 * search item. Shows an empty state when nothing is selected.
 */

import React, { useMemo } from "react";
import { Eye } from "lucide-react";
import { cn } from "../../../lib/utils";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import type { SearchItem } from "../../../core/plugin-system/types";

// ============================================================================
// Types
// ============================================================================

export interface PreviewPaneProps {
  /** The currently selected item (null = empty state) */
  selectedItem: SearchItem | null;
  /** Whether this pane has keyboard focus */
  isFocused: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-8">
      <div className="mb-3 opacity-20">
        <Eye size={24} strokeWidth={1.5} />
      </div>
      <div className="text-xs text-muted-foreground/40 text-center">
        Select an item to preview
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PreviewPane({ selectedItem, isFocused }: PreviewPaneProps) {
  // Get preview content from plugin registry
  const previewResult = useMemo(() => {
    if (!selectedItem) return null;
    return pluginRegistry.getPreviewPanel(selectedItem);
  }, [selectedItem]);

  return (
    <div
      className={cn(
        "flex flex-col h-full transition-colors duration-100",
        isFocused && "border-l-2 border-accent/30"
      )}
    >
      {selectedItem && previewResult ? (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {previewResult.element}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
