/**
 * PreviewPane - Preview panel for the two-panel command palette
 *
 * Renders plugin-provided preview content for the currently selected
 * search item. Shows an empty state when nothing is selected.
 *
 * Features:
 * - AnimatePresence crossfade on item change
 * - Empty state with subtle styling
 * - Focus indicator border
 */

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
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
// Constants
// ============================================================================

const crispEase = [0.32, 0.72, 0, 1] as const;

// ============================================================================
// Sub-components
// ============================================================================

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col items-center justify-center h-full py-16 px-8"
    >
      <div className="mb-3 opacity-20">
        <Eye size={24} strokeWidth={1.5} />
      </div>
      <div className="text-xs text-muted-foreground/40 text-center">
        Select an item to preview
      </div>
    </motion.div>
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
      <AnimatePresence mode="wait">
        {selectedItem && previewResult ? (
          <motion.div
            key={selectedItem.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.1,
              ease: crispEase,
            }}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
          >
            {previewResult.element}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            className="flex-1"
          >
            <EmptyState />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
