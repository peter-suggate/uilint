/**
 * RulePanel - Inspector panel for viewing and configuring ESLint rules
 *
 * Uses CSS variables from the design system for consistent theming
 * with the devtools overlay.
 */
import React, { useCallback } from "react";
import type { InspectorPanelProps } from "../../../core/plugin-system/types";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import { useComposedStore } from "../../../core/store";
import type { AvailableRule } from "../types";
import type { ESLintPluginSlice } from "../slice";

/**
 * Severity toggle component
 */
function SeverityToggle({
  value,
  onChange,
  disabled,
}: {
  value: "error" | "warning" | "off";
  onChange: (severity: "error" | "warning" | "off") => void;
  disabled?: boolean;
}) {
  const options: Array<{ value: "error" | "warning" | "off"; label: string; color: string }> = [
    { value: "error", label: "E", color: "#ef4444" },
    { value: "warning", label: "W", color: "#f59e0b" },
    { value: "off", label: "Off", color: "#6b7280" },
  ];

  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          style={{
            padding: "4px 8px",
            fontSize: 12,
            fontWeight: 500,
            border: "none",
            borderRadius: 4,
            cursor: disabled ? "not-allowed" : "pointer",
            background: value === opt.value ? opt.color : "var(--uilint-surface-elevated)",
            color: value === opt.value ? "white" : "var(--uilint-text-disabled)",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function RulePanel({ data }: InspectorPanelProps) {
  const ruleId = data?.ruleId as string | undefined;

  // Get rule data from store
  const rule = useComposedStore((s) => {
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.availableRules) return null;
    return eslintState.availableRules.find((r: AvailableRule) => r.id === ruleId);
  });

  const config = useComposedStore((s) => {
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.ruleConfigs) return null;
    return eslintState.ruleConfigs.get(ruleId || "");
  });

  const isUpdating = useComposedStore((s) => {
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.ruleConfigUpdating) return false;
    return eslintState.ruleConfigUpdating.get(ruleId || "") ?? false;
  });

  // Get issue count for this rule
  const issueCount = useComposedStore((s) => {
    const eslintState = s.plugins?.eslint as ESLintPluginSlice | undefined;
    if (!eslintState?.issues) return 0;
    let count = 0;
    eslintState.issues.forEach((issues) => {
      count += issues.filter((issue) => issue.ruleId === ruleId).length;
    });
    return count;
  });

  const handleSeverityChange = useCallback(
    (severity: "error" | "warning" | "off") => {
      if (!ruleId) return;
      pluginRegistry.setRuleSeverity(ruleId, severity);
    },
    [ruleId]
  );

  if (!ruleId) {
    return (
      <div style={{ padding: 16, color: "var(--uilint-text-muted)", textAlign: "center" }}>
        No rule selected
      </div>
    );
  }

  if (!rule) {
    return (
      <div style={{ padding: 16, color: "var(--uilint-text-muted)", textAlign: "center" }}>
        Rule not found: {ruleId}
      </div>
    );
  }

  // Map ESLint severity to display value
  const currentSeverity = config?.severity
    ? config.severity === "warn"
      ? "warning"
      : config.severity
    : rule.currentSeverity === "warn"
    ? "warning"
    : rule.currentSeverity ?? "off";

  return (
    <div style={{ padding: 16 }}>
      {/* Rule header */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--uilint-text-primary)",
            marginBottom: 4,
          }}
        >
          {rule.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--uilint-text-muted)",
            fontFamily: "monospace",
          }}
        >
          {rule.id}
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 14,
          color: "var(--uilint-text-secondary)",
          marginBottom: 16,
          lineHeight: 1.5,
        }}
      >
        {rule.description}
      </div>

      {/* Category and issue count */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            background: rule.category === "semantic"
              ? "rgba(59, 130, 246, 0.1)"
              : "var(--uilint-surface-elevated)",
            color: rule.category === "semantic"
              ? "var(--uilint-accent)"
              : "var(--uilint-text-muted)",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          {rule.category}
        </span>
        {issueCount > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              background: "rgba(239, 68, 68, 0.1)",
              color: "#dc2626",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            {issueCount} issue{issueCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Severity control */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--uilint-text-muted)",
            marginBottom: 8,
          }}
        >
          Severity
        </div>
        <SeverityToggle
          value={currentSeverity as "error" | "warning" | "off"}
          onChange={handleSeverityChange}
          disabled={isUpdating}
        />
        {isUpdating && (
          <div style={{ fontSize: 11, color: "var(--uilint-text-muted)", marginTop: 4 }}>
            Updating...
          </div>
        )}
      </div>

      {/* Documentation link */}
      {rule.docs && (
        <div style={{ marginTop: 16 }}>
          <a
            href={rule.docs}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              color: "var(--uilint-accent)",
              textDecoration: "none",
            }}
          >
            View documentation
          </a>
        </div>
      )}
    </div>
  );
}
