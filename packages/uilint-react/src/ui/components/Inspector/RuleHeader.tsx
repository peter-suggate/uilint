/**
 * RuleHeader - Compact contextual rule info header for the inspector
 *
 * Shown when a rule filter is active. Displays:
 * - Rule name, category, and inline actions
 * - Description revealed on hover/focus for reduced visual weight
 *
 * Glassmorphic styling with minimal color
 */
import React, { useState } from "react";
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
  /** Whether to show the close button (default: true, set to false when inside expanded tile) */
  showCloseButton?: boolean;
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
  showCloseButton = true,
  className,
}: RuleHeaderProps) {
  const [showDescription, setShowDescription] = useState(false);

  // Get namespace if present
  const namespace = ruleFilter.id.includes("/")
    ? ruleFilter.id.split("/")[0]
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className={cn(
        "bg-foreground/[0.01]",
        "border-b border-foreground/[0.04]",
        className
      )}
    >
      {/* Compact header - single row with all controls */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Category badge */}
          {(category || namespace) && (
            <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider flex-shrink-0">
              {namespace || category}
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Inline actions */}
          <div className="flex items-center gap-1">
            {/* Info toggle - reveals description */}
            {description && (
              <button
                type="button"
                onClick={() => setShowDescription(!showDescription)}
                className={cn(
                  "px-2 py-1 rounded",
                  "text-[11px] text-muted-foreground/60 hover:text-foreground/80",
                  "hover:bg-foreground/[0.04]",
                  "transition-colors duration-100",
                  showDescription && "bg-foreground/[0.04] text-foreground/80"
                )}
                title={showDescription ? "Hide description" : "Show description"}
              >
                Info
              </button>
            )}

            {/* Config toggle */}
            <button
              type="button"
              onClick={onToggleConfig}
              className={cn(
                "inline-flex items-center gap-1",
                "px-2 py-1 rounded",
                "text-[11px] text-muted-foreground/60 hover:text-foreground/80",
                "hover:bg-foreground/[0.04]",
                "transition-colors duration-100",
                configExpanded && "bg-foreground/[0.04] text-foreground/80"
              )}
            >
              <motion.span
                animate={{ rotate: configExpanded ? 90 : 0 }}
                transition={{ duration: 0.1 }}
                className="flex items-center"
              >
                <ChevronIcon size={10} />
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
                  "inline-flex items-center gap-1",
                  "px-2 py-1 rounded",
                  "text-[11px] text-muted-foreground/50 hover:text-foreground/70",
                  "hover:bg-foreground/[0.04]",
                  "transition-colors duration-100"
                )}
              >
                <ExternalLinkIcon size={10} />
                Docs
              </a>
            )}

            {/* Close button */}
            {showCloseButton && (
              <IconButton
                variant="ghost"
                size="sm"
                onClick={onClear}
                title="Clear filter"
                className="opacity-40 hover:opacity-100 ml-1"
              >
                <CloseIcon size={12} />
              </IconButton>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible description */}
      <AnimatePresence>
        {showDescription && description && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <p className="px-3 pb-2 text-xs text-foreground/60 leading-relaxed">
              {description}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default RuleHeader;
