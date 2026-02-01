/**
 * RuleHeader - Contextual rule info header for the inspector
 *
 * Shown when a rule filter is active. Displays:
 * - Rule name and category
 * - Description
 * - Quick severity selector
 * - Links to docs and config
 * - Clear filter button
 *
 * Glassmorphic styling with minimal color
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import { CloseIcon, ExternalLinkIcon, ChevronIcon } from "../../icons";
import { IconButton } from "../primitives";
import type { TileFilter } from "../../../core/plugin-system/types";

// ============================================================================
// Types
// ============================================================================

export interface RuleHeaderProps {
  /** The active rule filter */
  ruleFilter: TileFilter;
  /** Rule description (from available rules metadata) */
  description?: string;
  /** Rule category (e.g., "Possible Errors") */
  category?: string;
  /** URL to rule documentation */
  docsUrl?: string;
  /** Whether the config section is expanded */
  configExpanded: boolean;
  /** Called to toggle config expansion */
  onToggleConfig: () => void;
  /** Called to clear the rule filter */
  onClear: () => void;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function RuleHeader({
  ruleFilter,
  description,
  category,
  docsUrl,
  configExpanded,
  onToggleConfig,
  onClear,
  className,
}: RuleHeaderProps) {
  // Extract short name from potentially namespaced rule ID
  const shortName = ruleFilter.id.includes("/")
    ? ruleFilter.id.split("/").pop()!
    : ruleFilter.id;

  // Get namespace if present
  const namespace = ruleFilter.id.includes("/")
    ? ruleFilter.id.split("/")[0]
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "bg-foreground/[0.02]",
        "border-b border-foreground/[0.06]",
        className
      )}
    >
      {/* Main header */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          {/* Rule info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium text-foreground truncate">
                {shortName}
              </span>
              <IconButton
                variant="ghost"
                size="sm"
                onClick={onClear}
                title="Clear filter"
                className="opacity-60 hover:opacity-100"
              >
                <CloseIcon size={14} />
              </IconButton>
            </div>

            {/* Category / namespace */}
            {(category || namespace) && (
              <div className="text-xs text-muted-foreground/60 uppercase tracking-wider mt-0.5">
                {namespace && <span>{namespace}</span>}
                {namespace && category && <span className="mx-1">·</span>}
                {category && <span>{category}</span>}
              </div>
            )}

            {/* Description */}
            {description && (
              <p className="text-sm text-foreground/70 mt-2 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2 mt-3">
          {/* Config toggle */}
          <button
            type="button"
            onClick={onToggleConfig}
            className={cn(
              "inline-flex items-center gap-1.5",
              "px-2.5 py-1.5 rounded-md",
              "text-xs text-foreground/70",
              "bg-foreground/[0.04] hover:bg-foreground/[0.08]",
              "border border-foreground/[0.06]",
              "transition-colors duration-100"
            )}
          >
            <motion.span
              animate={{ rotate: configExpanded ? 90 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronIcon size={12} />
            </motion.span>
            Configure
          </button>

          {/* Docs link */}
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-1.5",
                "px-2.5 py-1.5 rounded-md",
                "text-xs text-foreground/50 hover:text-foreground/80",
                "hover:bg-foreground/[0.04]",
                "transition-colors duration-100"
              )}
            >
              <ExternalLinkIcon size={12} />
              Docs
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default RuleHeader;
