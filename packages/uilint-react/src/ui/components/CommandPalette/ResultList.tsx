/**
 * ResultList - Grouped result list for the two-panel command palette
 *
 * Shows search items grouped under section headers ("Rules", "Files").
 * Supports keyboard navigation with a smooth sliding selection highlight.
 *
 * Features:
 * - Section headers with item count badges
 * - Severity indicators and count badges per row
 * - Staggered entrance animations
 * - layoutId-based selection highlight morph
 * - Auto-scroll selected item into view
 */

import React, { useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, AlertTriangle, Info, FileCode, Shield } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { SearchItem } from "../../../core/plugin-system/types";

// ============================================================================
// Types
// ============================================================================

export interface ResultListProps {
  /** Grouped search results (section name → items) */
  grouped: Map<string, SearchItem[]>;
  /** Flat list of items in display order */
  flatItems: SearchItem[];
  /** Currently selected item ID */
  selectedItemId: string | null;
  /** Current selected flat index */
  selectedIndex: number;
  /** Callback when an item is highlighted (hover or keyboard) */
  onItemSelect: (item: SearchItem, index: number) => void;
  /** Callback when an item is confirmed (Enter / click) */
  onItemConfirm: (item: SearchItem) => void;
}

// ============================================================================
// Constants
// ============================================================================

const crispEase = [0.32, 0.72, 0, 1] as const;

const SECTION_LABELS: Record<string, string> = {
  rules: "Rules",
  files: "Files",
  commands: "Commands",
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  rules: <Shield size={11} className="text-muted-foreground/40" />,
  files: <FileCode size={11} className="text-muted-foreground/40" />,
};

// ============================================================================
// Sub-components
// ============================================================================

function SeverityDot({ severity }: { severity: "error" | "warning" | "info" }) {
  const colorClass =
    severity === "error"
      ? "bg-error"
      : severity === "warning"
        ? "bg-warning"
        : "bg-info";

  return <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", colorClass)} />;
}

function SeverityCountBadges({
  counts,
}: {
  counts: { error: number; warning: number; info: number };
}) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {counts.error > 0 && (
        <span className="flex items-center gap-0.5 text-[10px] text-error/70 tabular-nums">
          <AlertCircle size={10} />
          {counts.error}
        </span>
      )}
      {counts.warning > 0 && (
        <span className="flex items-center gap-0.5 text-[10px] text-warning/70 tabular-nums">
          <AlertTriangle size={10} />
          {counts.warning}
        </span>
      )}
      {counts.info > 0 && (
        <span className="flex items-center gap-0.5 text-[10px] text-info/70 tabular-nums">
          <Info size={10} />
          {counts.info}
        </span>
      )}
    </div>
  );
}

function ResultItem({
  item,
  isSelected,
  onSelect,
  onConfirm,
  animIndex,
}: {
  item: SearchItem;
  isSelected: boolean;
  onSelect: () => void;
  onConfirm: () => void;
  animIndex: number;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isSelected]);

  const highestSeverity = item.severityCounts
    ? item.severityCounts.error > 0
      ? "error" as const
      : item.severityCounts.warning > 0
        ? "warning" as const
        : "info" as const
    : null;

  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.1,
        ease: crispEase,
        delay: Math.min(animIndex * 0.02, 0.15),
      }}
      onClick={onConfirm}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={onSelect}
      tabIndex={-1}
      className={cn(
        "w-full text-left relative",
        "flex items-center gap-2.5 px-3 py-2",
        "transition-colors duration-75",
        "hover:bg-foreground/[0.04]",
        "outline-none"
      )}
    >
      {/* Selection highlight (animated background) */}
      {isSelected && (
        <motion.div
          layoutId="result-list-highlight"
          className="absolute inset-0 bg-foreground/[0.06]"
          transition={{ duration: 0.15, ease: crispEase }}
        />
      )}

      {/* Content (above highlight) */}
      <div className="relative flex items-center gap-2.5 w-full min-w-0">
        {/* Severity dot */}
        {highestSeverity && <SeverityDot severity={highestSeverity} />}

        {/* Label + subtitle */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-foreground/85 truncate leading-tight">
            {item.label}
          </div>
          {item.subtitle && (
            <div className="text-[10px] text-muted-foreground/50 truncate leading-tight mt-0.5">
              {item.subtitle}
            </div>
          )}
        </div>

        {/* Severity count badges */}
        {item.severityCounts && (
          <SeverityCountBadges counts={item.severityCounts} />
        )}
      </div>
    </motion.button>
  );
}

function SectionHeader({
  section,
  count,
}: {
  section: string;
  count: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.08 }}
      className="flex items-center gap-1.5 px-3 pt-3 pb-1.5"
    >
      {SECTION_ICONS[section]}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
        {SECTION_LABELS[section] || section}
      </span>
      <span className="text-[10px] text-muted-foreground/30 tabular-nums">
        {count}
      </span>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ResultList({
  grouped,
  flatItems,
  selectedItemId,
  onItemSelect,
  onItemConfirm,
}: ResultListProps) {
  // Build a flat index lookup
  const flatIndexMap = React.useMemo(() => {
    const map = new Map<string, number>();
    flatItems.forEach((item, index) => map.set(item.id, index));
    return map;
  }, [flatItems]);

  const handleSelect = useCallback(
    (item: SearchItem) => {
      const index = flatIndexMap.get(item.id) ?? 0;
      onItemSelect(item, index);
    },
    [flatIndexMap, onItemSelect]
  );

  if (flatItems.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="flex flex-col items-center justify-center py-12 px-4"
      >
        <div className="text-xs text-muted-foreground/50">No results found</div>
      </motion.div>
    );
  }

  let animIndex = 0;

  return (
    <div className="py-1">
      <AnimatePresence mode="popLayout">
        {Array.from(grouped.entries()).map(([section, items]) => (
          <div key={section}>
            <SectionHeader section={section} count={items.length} />
            {items.map((item) => {
              const currentAnimIndex = animIndex++;
              return (
                <ResultItem
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedItemId}
                  onSelect={() => handleSelect(item)}
                  onConfirm={() => onItemConfirm(item)}
                  animIndex={currentAnimIndex}
                />
              );
            })}
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
