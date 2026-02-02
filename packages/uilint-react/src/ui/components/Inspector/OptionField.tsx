/**
 * OptionField - Dynamic form field renderer for rule options
 *
 * Renders appropriate input based on OptionFieldSchema type:
 * - text: Text input
 * - number: Number input with validation
 * - boolean: Toggle button group
 * - select: Dropdown selector
 * - multiselect: Multi-select with pills
 * - array: Comma-separated text input
 *
 * Uses glassmorphism styling consistent with the design system.
 */
import React, { useCallback, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import type { OptionFieldSchema } from "../../../plugins/eslint/types";

// ============================================================================
// Types
// ============================================================================

export interface OptionFieldProps {
  /** Field schema defining type, label, etc. */
  schema: OptionFieldSchema;
  /** Current field value */
  value: unknown;
  /** Called when value changes */
  onChange: (key: string, value: unknown) => void;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Shared Styles
// ============================================================================

const labelStyles = "block text-xs text-muted-foreground/70 uppercase tracking-wider mb-1.5";

const inputBaseStyles = cn(
  "w-full px-3 py-2 text-sm rounded-md",
  "bg-foreground/[0.02] border border-foreground/[0.06]",
  "text-foreground placeholder:text-muted-foreground/40",
  "focus:outline-none focus:border-foreground/[0.12]",
  "transition-colors duration-100",
  "disabled:opacity-50 disabled:cursor-not-allowed"
);

const descriptionStyles = "text-xs text-muted-foreground/50 mt-1.5";

// ============================================================================
// Text Field
// ============================================================================

function TextField({
  schema,
  value,
  onChange,
  disabled,
}: Omit<OptionFieldProps, "className">) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(schema.key, e.target.value);
    },
    [schema.key, onChange]
  );

  return (
    <input
      type="text"
      value={(value as string) ?? ""}
      onChange={handleChange}
      placeholder={schema.placeholder}
      disabled={disabled}
      className={inputBaseStyles}
    />
  );
}

// ============================================================================
// Number Field
// ============================================================================

function NumberField({
  schema,
  value,
  onChange,
  disabled,
}: Omit<OptionFieldProps, "className">) {
  const [localValue, setLocalValue] = useState<string>(
    value !== undefined && value !== null ? String(value) : ""
  );
  const [isValid, setIsValid] = useState(true);

  // Sync local value when external value changes
  useEffect(() => {
    const newValue = value !== undefined && value !== null ? String(value) : "";
    setLocalValue(newValue);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      setLocalValue(inputValue);

      // Allow empty input
      if (inputValue === "" || inputValue === "-") {
        setIsValid(true);
        return;
      }

      const numValue = parseFloat(inputValue);
      if (!isNaN(numValue)) {
        setIsValid(true);
        onChange(schema.key, numValue);
      } else {
        setIsValid(false);
      }
    },
    [schema.key, onChange]
  );

  const handleBlur = useCallback(() => {
    // On blur, if empty, reset to default
    if (localValue === "" || localValue === "-") {
      const defaultVal = schema.defaultValue as number;
      setLocalValue(String(defaultVal));
      onChange(schema.key, defaultVal);
    }
  }, [localValue, schema.key, schema.defaultValue, onChange]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={schema.placeholder ?? String(schema.defaultValue)}
      disabled={disabled}
      className={cn(
        inputBaseStyles,
        !isValid && "border-error/50 focus:border-error"
      )}
    />
  );
}

// ============================================================================
// Boolean Field (Toggle)
// ============================================================================

function BooleanField({
  schema,
  value,
  onChange,
  disabled,
}: Omit<OptionFieldProps, "className">) {
  const isEnabled = Boolean(value);

  const handleToggle = useCallback(
    (newValue: boolean) => {
      if (!disabled) {
        onChange(schema.key, newValue);
      }
    },
    [schema.key, onChange, disabled]
  );

  return (
    <div className="flex items-center gap-1 p-1 bg-foreground/[0.02] rounded-lg border border-foreground/[0.04]">
      <button
        type="button"
        onClick={() => handleToggle(false)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md",
          "text-sm transition-colors duration-100",
          !isEnabled
            ? "bg-foreground/[0.08] text-foreground"
            : "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground/80",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            !isEnabled ? "bg-muted-foreground/50" : "bg-muted-foreground/20"
          )}
        />
        <span>Off</span>
      </button>
      <button
        type="button"
        onClick={() => handleToggle(true)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md",
          "text-sm transition-colors duration-100",
          isEnabled
            ? "bg-foreground/[0.08] text-foreground"
            : "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground/80",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            isEnabled ? "bg-success/70" : "bg-success/20"
          )}
        />
        <span>On</span>
      </button>
    </div>
  );
}

// ============================================================================
// Select Field
// ============================================================================

function SelectField({
  schema,
  value,
  onChange,
  disabled,
}: Omit<OptionFieldProps, "className">) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = schema.options ?? [];
  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = useCallback(
    (optValue: string | number) => {
      onChange(schema.key, optValue);
      setIsOpen(false);
    },
    [schema.key, onChange]
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          inputBaseStyles,
          "flex items-center justify-between text-left",
          disabled && "cursor-not-allowed"
        )}
      >
        <span className={!selectedOption ? "text-muted-foreground/40" : ""}>
          {selectedOption?.label ?? schema.placeholder ?? "Select..."}
        </span>
        <svg
          className={cn(
            "w-4 h-4 text-muted-foreground/50 transition-transform duration-150",
            isOpen && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute z-50 w-full mt-1 py-1 rounded-md",
              "bg-background/95 backdrop-blur-sm",
              "border border-foreground/[0.08]",
              "shadow-lg"
            )}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left",
                  "transition-colors duration-75",
                  option.value === value
                    ? "bg-foreground/[0.06] text-foreground"
                    : "text-foreground/80 hover:bg-foreground/[0.04]"
                )}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Multiselect Field
// ============================================================================

function MultiselectField({
  schema,
  value,
  onChange,
  disabled,
}: Omit<OptionFieldProps, "className">) {
  const selectedValues = Array.isArray(value) ? (value as (string | number)[]) : [];
  const options = schema.options ?? [];

  const handleToggle = useCallback(
    (optValue: string | number) => {
      if (disabled) return;

      const newValues = selectedValues.includes(optValue)
        ? selectedValues.filter((v) => v !== optValue)
        : [...selectedValues, optValue];
      onChange(schema.key, newValues);
    },
    [schema.key, selectedValues, onChange, disabled]
  );

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleToggle(option.value)}
            disabled={disabled}
            className={cn(
              "px-2.5 py-1 text-xs rounded-md",
              "transition-colors duration-100",
              "border",
              isSelected
                ? "bg-foreground/[0.08] border-foreground/[0.12] text-foreground"
                : "bg-foreground/[0.02] border-foreground/[0.04] text-foreground/60 hover:text-foreground/80 hover:bg-foreground/[0.04]",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Array Field (comma-separated)
// ============================================================================

function ArrayField({
  schema,
  value,
  onChange,
  disabled,
}: Omit<OptionFieldProps, "className">) {
  // Convert array to comma-separated string for display
  const arrayValue = Array.isArray(value) ? value : [];
  const stringValue = arrayValue.join(", ");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      // Parse comma-separated values, trim whitespace
      const newArray = inputValue
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      onChange(schema.key, newArray);
    },
    [schema.key, onChange]
  );

  return (
    <input
      type="text"
      value={stringValue}
      onChange={handleChange}
      placeholder={schema.placeholder ?? "value1, value2, value3"}
      disabled={disabled}
      className={inputBaseStyles}
    />
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function OptionField({
  schema,
  value,
  onChange,
  disabled = false,
  className,
}: OptionFieldProps) {
  // Render appropriate field based on type
  const renderField = () => {
    switch (schema.type) {
      case "text":
        return <TextField schema={schema} value={value} onChange={onChange} disabled={disabled} />;
      case "number":
        return <NumberField schema={schema} value={value} onChange={onChange} disabled={disabled} />;
      case "boolean":
        return <BooleanField schema={schema} value={value} onChange={onChange} disabled={disabled} />;
      case "select":
        return <SelectField schema={schema} value={value} onChange={onChange} disabled={disabled} />;
      case "multiselect":
        return <MultiselectField schema={schema} value={value} onChange={onChange} disabled={disabled} />;
      case "array":
        return <ArrayField schema={schema} value={value} onChange={onChange} disabled={disabled} />;
      default:
        return <TextField schema={schema} value={value} onChange={onChange} disabled={disabled} />;
    }
  };

  return (
    <div className={cn("mb-4", className)}>
      <label className={labelStyles}>{schema.label}</label>
      {renderField()}
      {schema.description && (
        <p className={descriptionStyles}>{schema.description}</p>
      )}
    </div>
  );
}

export default OptionField;
