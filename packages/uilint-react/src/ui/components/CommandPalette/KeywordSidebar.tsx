/**
 * KeywordSidebar - Simple keyword filter sidebar for command palette
 *
 * Displays a flat list of keywords sorted by frequency (most first).
 * Clicking a keyword toggles it as a filter.
 * Multiple keywords can be selected (AND logic).
 */

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import { useComposedStore } from "../../../core/store";
import {
  selectKeywordCounts,
  selectHasKeywordFilters,
} from "../../../core/store/keyword-slice";
import { selectRawTileItems } from "../../../core/store/tile-selectors";
import type { KeywordCount } from "../../../core/plugin-system/types";

// ============================================================================
// Animation variants
// ============================================================================

const itemMotionVariants = {
  initial: { opacity: 0, x: -4 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -4 },
};

const crispEase = [0.32, 0.72, 0, 1] as const;

// ============================================================================
// Components
// ============================================================================

interface KeywordItemProps {
  keyword: string;
  count: number;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}

function KeywordItem({ keyword, count, isSelected, onClick, index }: KeywordItemProps) {
  return (
    <motion.div
      variants={itemMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.1, delay: index * 0.015, ease: crispEase }}
    >
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-center justify-between mx-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer select-none text-left",
          isSelected
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        style={{
          width: "calc(100% - 12px)",
          borderLeft: isSelected
            ? "2px solid var(--uilint-accent)"
            : "2px solid transparent",
          paddingLeft: isSelected ? 8 : 10,
        }}
      >
        <span className="truncate flex-1">{keyword}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground/60 ml-2">
          {count}
        </span>
      </button>
    </motion.div>
  );
}

function AllButton({
  isSelected,
  totalCount,
  onClick,
}: {
  isSelected: boolean;
  totalCount: number;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.1 }}
    >
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-center justify-between mx-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer select-none text-left",
          isSelected
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        style={{
          width: "calc(100% - 12px)",
          borderLeft: isSelected
            ? "2px solid var(--uilint-accent)"
            : "2px solid transparent",
          paddingLeft: isSelected ? 8 : 10,
          fontWeight: 500,
        }}
      >
        <span>All</span>
        {totalCount > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground/60">
            {totalCount}
          </span>
        )}
      </button>
    </motion.div>
  );
}

function Divider() {
  return (
    <div
      className="mx-3 my-1.5"
      style={{
        height: 1,
        background: "var(--uilint-border)",
        opacity: 0.3,
      }}
    />
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface KeywordSidebarProps {
  className?: string;
}

export function KeywordSidebar({ className }: KeywordSidebarProps) {
  // Get state from store using selectors
  const keywordCounts = useComposedStore(selectKeywordCounts);
  const selectedKeywords = useComposedStore((s) => s.selectedKeywords);
  const hasFilters = useComposedStore(selectHasKeywordFilters);
  const toggleKeyword = useComposedStore((s) => s.toggleKeyword);
  const clearKeywords = useComposedStore((s) => s.clearKeywords);
  const tileItems = useComposedStore(selectRawTileItems);

  // Total count is the number of tile items
  const totalCount = tileItems.length;

  // Check if a keyword is selected
  const isKeywordSelected = React.useCallback(
    (keyword: string) => selectedKeywords.has(keyword),
    [selectedKeywords]
  );

  return (
    <div
      className={cn(
        "shrink-0 w-28 py-2 border-r overflow-y-auto overflow-x-hidden",
        className
      )}
      style={{
        borderColor: "var(--uilint-border)",
      }}
      role="navigation"
      aria-label="Keyword filters"
    >
      {/* "All" button - always first */}
      <AllButton
        isSelected={!hasFilters}
        totalCount={totalCount}
        onClick={clearKeywords}
      />

      {/* Divider if there are keywords */}
      {keywordCounts.length > 0 && <Divider />}

      {/* Keyword list */}
      <AnimatePresence mode="popLayout">
        {keywordCounts.map((kw: KeywordCount, index: number) => (
          <KeywordItem
            key={kw.keyword}
            keyword={kw.keyword}
            count={kw.count}
            isSelected={isKeywordSelected(kw.keyword)}
            onClick={() => toggleKeyword(kw.keyword)}
            index={index}
          />
        ))}
      </AnimatePresence>

      {/* Empty state */}
      {keywordCounts.length === 0 && totalCount === 0 && (
        <div className="px-3 py-4 text-center">
          <div className="text-[10px] text-muted-foreground/50">
            No items
          </div>
        </div>
      )}
    </div>
  );
}
