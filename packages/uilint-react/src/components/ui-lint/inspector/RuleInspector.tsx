"use client";

import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icons } from "../command-palette/icons";
import { useUILintStore, type UILintStore, type AvailableRule, type RuleConfig, type OptionFieldSchema } from "../store";
import { MarkdownRenderer } from "./MarkdownRenderer";

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
 * Option field renderer
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

interface RuleInspectorProps {
  ruleId: string;
  onIssueClick?: (issueId: string) => void;
}

/**
 * Rule inspector - shows rule details with configuration options
 */
export function RuleInspector({ ruleId, onIssueClick }: RuleInspectorProps) {
  const availableRules = useUILintStore((s: UILintStore) => s.availableRules);
  const ruleConfigs = useUILintStore((s: UILintStore) => s.ruleConfigs);
  const ruleConfigUpdating = useUILintStore((s: UILintStore) => s.ruleConfigUpdating);
  const setRuleConfig = useUILintStore((s: UILintStore) => s.setRuleConfig);
  const eslintIssuesCache = useUILintStore((s: UILintStore) => s.eslintIssuesCache);
  const setInspectorIssue = useUILintStore((s: UILintStore) => s.setInspectorIssue);

  // Find the rule
  const rule = useMemo(
    () => availableRules.find((r) => r.id === ruleId || `uilint/${r.id}` === ruleId),
    [availableRules, ruleId]
  );

  const currentConfig = ruleConfigs.get(rule?.id ?? ruleId);
  const isUpdating = ruleConfigUpdating.get(rule?.id ?? ruleId) ?? false;

  const [severity, setSeverity] = useState<"error" | "warn" | "off">(
    currentConfig?.severity ?? rule?.defaultSeverity ?? "error"
  );
  const [options, setOptions] = useState<Record<string, unknown>>(
    currentConfig?.options ?? {}
  );

  // Sync with external changes
  useEffect(() => {
    if (currentConfig) {
      setSeverity(currentConfig.severity);
      setOptions(currentConfig.options ?? {});
    } else if (rule) {
      setSeverity(rule.defaultSeverity ?? "error");
      setOptions({});
    }
  }, [currentConfig, rule]);

  // Find issues for this rule
  const ruleIssues = useMemo(() => {
    const issues: Array<{
      id: string;
      message: string;
      filePath: string;
      line: number;
      column?: number;
    }> = [];
    const fullRuleId = `uilint/${rule?.id ?? ruleId}`;

    for (const [filePath, fileIssues] of eslintIssuesCache.entries()) {
      for (const issue of fileIssues) {
        if (issue.ruleId === fullRuleId) {
          issues.push({
            id: `${filePath}:${issue.line}:${issue.column}:${issue.ruleId}`,
            message: issue.message,
            filePath,
            line: issue.line,
            column: issue.column,
          });
        }
      }
    }

    return issues;
  }, [eslintIssuesCache, rule?.id, ruleId]);

  const handleSave = () => {
    if (!rule) return;
    const hasOptions = rule.optionSchema && Object.keys(options).length > 0;
    setRuleConfig(rule.id, severity, hasOptions ? options : undefined);
  };

  const hasChanges =
    severity !== (currentConfig?.severity ?? rule?.defaultSeverity ?? "error") ||
    JSON.stringify(options) !== JSON.stringify(currentConfig?.options ?? {});

  const hasOptions = rule?.optionSchema && rule.optionSchema.fields.length > 0;

  if (!rule) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <Icons.AlertTriangle className="w-6 h-6 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Rule not found</p>
        <p className="text-xs text-muted-foreground font-mono mt-1">{ruleId}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-ui-lint>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-border">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            rule.category === "semantic"
              ? "bg-purple-100 dark:bg-purple-900/40"
              : "bg-blue-100 dark:bg-blue-900/40"
          )}
        >
          <span
            className={cn(
              "text-[10px] font-bold",
              rule.category === "semantic"
                ? "text-purple-700 dark:text-purple-300"
                : "text-blue-700 dark:text-blue-300"
            )}
          >
            {rule.category === "semantic" ? "AI" : "STC"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {rule.name}
            </h2>
            {ruleIssues.length > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center",
                  "min-w-[20px] h-5 px-1.5",
                  "text-[10px] font-semibold",
                  "rounded-full",
                  severity === "error"
                    ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                    : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                )}
              >
                {ruleIssues.length}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rule.description}
          </p>
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Severity selector */}
        <div>
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
        {hasOptions && (
          <div className="space-y-3">
            <label className="text-xs font-medium text-text-secondary">
              Options
            </label>
            {rule.optionSchema!.fields.map((field) => (
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

        {/* Save button */}
        {hasChanges && (
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={isUpdating}
            className="w-full"
          >
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        )}

        {/* Documentation */}
        {rule.docs && (
          <div className="pt-2 border-t border-border">
            <label className="text-xs font-medium text-text-secondary mb-2 block">
              Documentation
            </label>
            <MarkdownRenderer content={rule.docs} />
          </div>
        )}

        {/* Issues for this rule */}
        {ruleIssues.length > 0 && (
          <div>
            <label className="text-xs font-medium text-text-secondary mb-2 block">
              Issues ({ruleIssues.length})
            </label>
            <div className="space-y-1">
              {ruleIssues.map((issue) => {
                const fileName = issue.filePath.split("/").pop() || issue.filePath;
                return (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => {
                      // Navigate to issue in inspector
                      const eslintIssue = {
                        message: issue.message,
                        line: issue.line,
                        column: issue.column,
                        ruleId: `uilint/${rule.id}`,
                        severity: severity === "error" ? 2 : 1,
                      };
                      setInspectorIssue(eslintIssue as any, undefined, issue.filePath);
                    }}
                    className={cn(
                      "w-full text-left p-2 rounded-md text-xs",
                      "bg-muted/50 hover:bg-muted",
                      "transition-colors"
                    )}
                    data-ui-lint
                  >
                    <p className="text-foreground line-clamp-1">{issue.message}</p>
                    <p className="text-muted-foreground font-mono mt-0.5">
                      {fileName}:{issue.line}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer with rule ID */}
      <div className="px-4 py-2 border-t border-border bg-muted/50">
        <code className="text-[10px] font-mono text-muted-foreground">
          uilint/{rule.id}
        </code>
      </div>
    </div>
  );
}
