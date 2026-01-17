"use client";

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type {
  AvailableRule,
  RuleConfig,
  OptionFieldSchema,
} from "../store";

interface RuleEditorProps {
  rule: AvailableRule;
  currentConfig: RuleConfig;
  onSave: (
    severity: "error" | "warn" | "off",
    options?: Record<string, unknown>
  ) => void;
  onClose: () => void;
  isUpdating: boolean;
}

/**
 * Severity selector - 3-state toggle (Error/Warn/Off)
 */
function SeveritySelector({
  value,
  onChange,
  disabled,
}: {
  value: "error" | "warn" | "off";
  onChange: (severity: "error" | "warn" | "off") => void;
  disabled: boolean;
}) {
  const options: Array<{
    value: "error" | "warn" | "off";
    label: string;
    activeClass: string;
  }> = [
    {
      value: "error",
      label: "Error",
      activeClass: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
    },
    {
      value: "warn",
      label: "Warn",
      activeClass: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
    },
    {
      value: "off",
      label: "Off",
      activeClass: "bg-zinc-500/20 text-zinc-600 dark:text-muted-foreground border-zinc-500/30",
    },
  ];

  return (
    <div className="flex items-center gap-1 p-0.5 bg-white/30 dark:bg-white/10 rounded-md">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => {
            if (opt.value !== value && !disabled) {
              onChange(opt.value);
            }
          }}
          disabled={disabled}
          className={cn(
            "px-3 py-1 rounded text-xs font-medium transition-all border",
            value === opt.value
              ? opt.activeClass
              : "border-transparent text-muted-foreground hover:bg-hover",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          data-ui-lint
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Option field renderer - renders appropriate input based on field type
 */
function OptionField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: OptionFieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
}) {
  const baseInputClass = cn(
    "w-full px-3 py-1.5 text-sm rounded-md border",
    "bg-white/50 dark:bg-white/5",
    "border-border",
    "focus:outline-none focus:ring-2 focus:ring-border focus:border-transparent",
    disabled && "opacity-50 cursor-not-allowed"
  );

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">
            {field.label}
          </label>
          {field.description && (
            <p className="text-[10px] text-muted-foreground">
              {field.description}
            </p>
          )}
          <input
            type="text"
            value={(value as string) ?? field.defaultValue ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className={baseInputClass}
            data-ui-lint
          />
        </div>
      );

    case "number":
      return (
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">
            {field.label}
          </label>
          {field.description && (
            <p className="text-[10px] text-muted-foreground">
              {field.description}
            </p>
          )}
          <input
            type="number"
            value={(value as number) ?? field.defaultValue ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
            className={baseInputClass}
            data-ui-lint
          />
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(value ?? field.defaultValue)}
            onClick={() => onChange(!value)}
            disabled={disabled}
            className={cn(
              "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2",
              value ? "bg-foreground" : "bg-white/20 dark:bg-white/10",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            data-ui-lint
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform",
                value ? "translate-x-[18px]" : "translate-x-0.5"
              )}
            />
          </button>
          <div>
            <label className="text-xs font-medium text-text-secondary">
              {field.label}
            </label>
            {field.description && (
              <p className="text-[10px] text-muted-foreground">
                {field.description}
              </p>
            )}
          </div>
        </div>
      );

    case "select":
      return (
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">
            {field.label}
          </label>
          {field.description && (
            <p className="text-[10px] text-muted-foreground">
              {field.description}
            </p>
          )}
          <select
            value={(value as string) ?? field.defaultValue ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClass}
            data-ui-lint
          >
            {field.options?.map((opt) => (
              <option key={String(opt.value)} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "array":
      // Render as comma-separated text input
      const arrayValue = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">
            {field.label}
          </label>
          {field.description && (
            <p className="text-[10px] text-muted-foreground">
              {field.description}
            </p>
          )}
          <input
            type="text"
            value={arrayValue.join(", ")}
            onChange={(e) => {
              const items = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              onChange(items);
            }}
            placeholder={field.placeholder ?? "item1, item2, item3"}
            disabled={disabled}
            className={baseInputClass}
            data-ui-lint
          />
          <p className="text-[10px] text-muted-foreground">Comma-separated values</p>
        </div>
      );

    default:
      return null;
  }
}

/**
 * Rule editor panel - shown when expanding a rule item
 */
export function RuleEditor({
  rule,
  currentConfig,
  onSave,
  onClose,
  isUpdating,
}: RuleEditorProps) {
  const [severity, setSeverity] = useState<"error" | "warn" | "off">(
    currentConfig.severity
  );
  const [options, setOptions] = useState<Record<string, unknown>>(
    currentConfig.options ?? {}
  );
  const [showDocs, setShowDocs] = useState(false);

  // Sync with external changes
  useEffect(() => {
    setSeverity(currentConfig.severity);
    setOptions(currentConfig.options ?? {});
  }, [currentConfig]);

  const handleSave = () => {
    const hasOptions = rule.optionSchema && Object.keys(options).length > 0;
    onSave(severity, hasOptions ? options : undefined);
  };

  const hasChanges =
    severity !== currentConfig.severity ||
    JSON.stringify(options) !== JSON.stringify(currentConfig.options ?? {});

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "mx-2 my-1 rounded-lg overflow-hidden p-4",
        "border border-border",
        "bg-white/40 dark:bg-white/5"
      )}
      data-ui-lint
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {rule.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rule.description}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
          data-ui-lint
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Severity selector */}
      <div className="mb-4">
        <label className="text-xs font-medium text-text-secondary mb-2 block">
          Severity
        </label>
        <SeveritySelector
          value={severity}
          onChange={setSeverity}
          disabled={isUpdating}
        />
      </div>

      {/* Options form */}
      {rule.optionSchema && rule.optionSchema.fields.length > 0 && (
        <div className="space-y-4 mb-4">
          <label className="text-xs font-medium text-text-secondary">
            Options
          </label>
          {rule.optionSchema.fields.map((field) => (
            <OptionField
              key={field.key}
              field={field}
              value={options[field.key]}
              onChange={(val) =>
                setOptions((prev) => ({ ...prev, [field.key]: val }))
              }
              disabled={isUpdating}
            />
          ))}
        </div>
      )}

      {/* Documentation toggle */}
      {rule.docs && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowDocs(!showDocs)}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1 transition-colors"
            data-ui-lint
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                "transition-transform",
                showDocs && "rotate-90"
              )}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {showDocs ? "Hide" : "Show"} documentation
          </button>
          {showDocs && (
            <div className="mt-2 p-3 bg-white/30 dark:bg-white/5 rounded-md border border-border text-xs text-text-secondary max-h-48 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-mono">{rule.docs}</pre>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={isUpdating}
        >
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={isUpdating || !hasChanges}
        >
          {isUpdating ? "Saving..." : "Save"}
        </Button>
      </div>
    </motion.div>
  );
}

export { SeveritySelector };
