/**
 * RuleOptionsForm - Container for rule option fields
 *
 * Maps over optionSchema.fields to render OptionField components.
 * Calls onChange immediately when any field changes (instant apply via WebSocket).
 *
 * Features:
 * - Dynamic field rendering based on schema
 * - Immediate change propagation
 * - Loading state during updates
 * - Reset to defaults functionality
 */
import React, { useCallback } from "react";
import { motion } from "motion/react";
import { cn } from "../../../lib/utils";
import { OptionField } from "./OptionField";
import type { RuleOptionSchema, OptionFieldSchema } from "../../../plugins/eslint/types";

// ============================================================================
// Types
// ============================================================================

export interface RuleOptionsFormProps {
  /** Rule ID for context */
  ruleId: string;
  /** Option schema defining available fields */
  optionSchema: RuleOptionSchema;
  /** Current option values */
  currentOptions: Record<string, unknown>;
  /** Default option values for reset */
  defaultOptions: Record<string, unknown>;
  /** Called when any option changes - applies immediately */
  onOptionChange: (key: string, value: unknown) => void;
  /** Called to reset all options to defaults */
  onReset?: () => void;
  /** Whether an update is in progress */
  isUpdating?: boolean;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function RuleOptionsForm({
  optionSchema,
  currentOptions,
  defaultOptions,
  onOptionChange,
  onReset,
  isUpdating = false,
  className,
}: RuleOptionsFormProps) {
  const fields = optionSchema?.fields ?? [];

  // Get value for a field, falling back to default
  const getFieldValue = useCallback(
    (field: OptionFieldSchema) => {
      const currentValue = currentOptions[field.key];
      if (currentValue !== undefined) {
        return currentValue;
      }
      // Fall back to default from schema
      return field.defaultValue;
    },
    [currentOptions]
  );

  // Check if current values differ from defaults
  const hasChanges = useCallback(() => {
    for (const field of fields) {
      const current = currentOptions[field.key];
      const defaultVal = defaultOptions[field.key] ?? field.defaultValue;

      // Handle array comparison
      if (Array.isArray(current) && Array.isArray(defaultVal)) {
        if (current.length !== defaultVal.length) return true;
        if (current.some((v, i) => v !== defaultVal[i])) return true;
      } else if (current !== defaultVal) {
        return true;
      }
    }
    return false;
  }, [fields, currentOptions, defaultOptions]);

  // No fields - show message
  if (fields.length === 0) {
    return (
      <div className={cn("text-xs text-muted-foreground/50 italic", className)}>
        No additional options for this rule
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn("relative", className)}
    >
      {/* Updating overlay */}
      {isUpdating && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-md">
          <span className="text-xs text-muted-foreground animate-pulse">
            Updating...
          </span>
        </div>
      )}

      {/* Options header */}
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs text-muted-foreground/70 uppercase tracking-wider">
          Options
        </label>
        {onReset && hasChanges() && (
          <button
            type="button"
            onClick={onReset}
            disabled={isUpdating}
            className={cn(
              "text-xs text-muted-foreground/60 hover:text-foreground/80",
              "transition-colors duration-100",
              isUpdating && "cursor-not-allowed opacity-50"
            )}
          >
            Reset to defaults
          </button>
        )}
      </div>

      {/* Option fields */}
      <div className={cn(isUpdating && "opacity-50 pointer-events-none")}>
        {fields.map((field) => (
          <OptionField
            key={field.key}
            schema={field}
            value={getFieldValue(field)}
            onChange={onOptionChange}
            disabled={isUpdating}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default RuleOptionsForm;
