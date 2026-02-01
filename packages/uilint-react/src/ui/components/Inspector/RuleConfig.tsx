/**
 * RuleConfig - Expandable configuration section for a rule
 *
 * Displays:
 * - Severity selector (off/warn/error)
 * - Rule-specific options (future)
 * - Apply/reset buttons
 *
 * Glassmorphic styling with minimal color
 */
import React from "react";
import { motion } from "motion/react";
import { cn } from "../../../lib/utils";

// ============================================================================
// Types
// ============================================================================

export type RuleSeverity = "off" | "warn" | "error";

export interface RuleConfigProps {
  /** Rule ID */
  ruleId: string;
  /** Current severity setting */
  currentSeverity: RuleSeverity;
  /** Called when severity is changed */
  onSeverityChange: (severity: RuleSeverity) => void;
  /** Whether changes are pending (unsaved) */
  hasPendingChanges?: boolean;
  /** Called to apply changes */
  onApply?: () => void;
  /** Called to reset to defaults */
  onReset?: () => void;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

interface SeverityButtonProps {
  severity: RuleSeverity;
  isSelected: boolean;
  onClick: () => void;
  label: string;
}

function SeverityButton({ severity, isSelected, onClick, label }: SeverityButtonProps) {
  const dotClass = {
    off: "bg-muted-foreground/30",
    warn: "bg-warning/70",
    error: "bg-error/70",
  }[severity];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md",
        "text-sm transition-colors duration-100",
        isSelected
          ? "bg-foreground/[0.08] text-foreground"
          : "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground/80"
      )}
    >
      <div className={cn("w-2 h-2 rounded-full", dotClass)} />
      <span>{label}</span>
    </button>
  );
}

// ============================================================================
// Component
// ============================================================================

export function RuleConfig({
  ruleId,
  currentSeverity,
  onSeverityChange,
  hasPendingChanges = false,
  onApply,
  onReset,
  className,
}: RuleConfigProps) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "overflow-hidden",
        "bg-foreground/[0.01]",
        "border-b border-foreground/[0.06]",
        className
      )}
    >
      <div className="px-4 py-4">
        {/* Severity selector */}
        <div className="mb-4">
          <label className="block text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
            Severity
          </label>
          <div className="flex items-center gap-1 p-1 bg-foreground/[0.02] rounded-lg border border-foreground/[0.04]">
            <SeverityButton
              severity="off"
              isSelected={currentSeverity === "off"}
              onClick={() => onSeverityChange("off")}
              label="Off"
            />
            <SeverityButton
              severity="warn"
              isSelected={currentSeverity === "warn"}
              onClick={() => onSeverityChange("warn")}
              label="Warn"
            />
            <SeverityButton
              severity="error"
              isSelected={currentSeverity === "error"}
              onClick={() => onSeverityChange("error")}
              label="Error"
            />
          </div>
        </div>

        {/* Placeholder for future options */}
        <div className="text-xs text-muted-foreground/50 italic mb-4">
          Additional rule options coming soon
        </div>

        {/* Action buttons */}
        {(onApply || onReset) && (
          <div className="flex items-center gap-2">
            {onApply && (
              <button
                type="button"
                onClick={onApply}
                disabled={!hasPendingChanges}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm",
                  "transition-colors duration-100",
                  hasPendingChanges
                    ? "bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.12]"
                    : "bg-foreground/[0.02] text-muted-foreground/40 cursor-not-allowed"
                )}
              >
                Apply changes
              </button>
            )}
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm",
                  "text-foreground/50 hover:text-foreground/80",
                  "hover:bg-foreground/[0.04]",
                  "transition-colors duration-100"
                )}
              >
                Reset to default
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default RuleConfig;
