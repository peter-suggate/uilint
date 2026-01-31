/**
 * MobileCategoryTabs - Horizontal scrolling category tabs for mobile
 */
import * as React from "react";
import { motion } from "motion/react";
import type { CategoryNode } from "../../../core/store/category-slice";

interface MobileCategoryTabsProps {
  categories: CategoryNode[];
  selectedId: string | null;
  onSelect: (categoryId: string | null) => void;
}

export function MobileCategoryTabs({
  categories,
  selectedId,
  onSelect,
}: MobileCategoryTabsProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Flatten category tree for tabs
  const flatCategories = React.useMemo(() => {
    const result: Array<{ id: string; label: string; count?: number }> = [
      { id: "all", label: "All" },
    ];

    const flatten = (nodes: CategoryNode[]) => {
      for (const node of nodes) {
        result.push({
          id: node.id,
          label: node.label,
          count: node.count,
        });
        if (node.children && node.children.length > 0) {
          flatten(node.children);
        }
      }
    };

    flatten(categories);
    return result;
  }, [categories]);

  return (
    <div
      ref={scrollRef}
      style={{
        display: "flex",
        overflowX: "auto",
        gap: 8,
        padding: "8px 16px",
        borderBottom: "1px solid var(--uilint-border)",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <style>
        {`
          .mobile-category-tabs::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>
      {flatCategories.map((cat) => {
        const isSelected =
          cat.id === "all" ? selectedId === null : selectedId === cat.id;

        return (
          <motion.button
            key={cat.id}
            onClick={() => onSelect(cat.id === "all" ? null : cat.id)}
            whileTap={{ scale: 0.95 }}
            style={{
              flexShrink: 0,
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: isSelected
                ? "var(--uilint-accent)"
                : "var(--uilint-surface-elevated)",
              color: isSelected
                ? "var(--uilint-accent-foreground)"
                : "var(--uilint-text-secondary)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            {cat.label}
            {cat.count !== undefined && cat.count > 0 && (
              <span
                style={{
                  opacity: 0.7,
                  fontSize: 11,
                  background: isSelected
                    ? "rgba(255,255,255,0.2)"
                    : "var(--uilint-surface)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {cat.count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
