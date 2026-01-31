/**
 * RuleItem - Single rule row in command palette with severity toggle
 *
 * Uses inline styles with CSS variables to match the devtools overlay design system.
 */
import React, { useCallback } from "react";
import { useComposedStore } from "../../../core/store";
import type { RuleDefinition } from "../../../core/plugin-system/types";

interface RuleItemProps {
  rule: RuleDefinition;
  issueCount: number;
  isSelected: boolean;
  onSeverityChange: (ruleId: string, severity: "error" | "warning" | "off") => void;
  onClick: () => void;
}

/**
 * Inline severity toggle with E/W/Off buttons
 */
function SeverityToggle({
  value,
  onChange,
  onClick,
}: {
  value: "error" | "warning" | "off";
  onChange: (severity: "error" | "warning" | "off") => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const options: Array<{
    value: "error" | "warning" | "off";
    label: string;
    activeColor: string;
  }> = [
    { value: "error", label: "E", activeColor: "#ef4444" },
    { value: "warning", label: "W", activeColor: "#f59e0b" },
    { value: "off", label: "Off", activeColor: "#6b7280" },
  ];

  return (
    <div style={{ display: "flex", gap: 2 }} onClick={onClick}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={(e) => {
            e.stopPropagation();
            onChange(opt.value);
          }}
          style={{
            padding: "2px 6px",
            fontSize: 10,
            fontWeight: 500,
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            background: value === opt.value ? opt.activeColor : "transparent",
            color: value === opt.value ? "white" : "var(--uilint-text-disabled)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function RuleItem({
  rule,
  issueCount,
  isSelected,
  onSeverityChange,
  onClick,
}: RuleItemProps) {
  const isMobile = useComposedStore((s) => s.mobile.isMobile);

  const handleSeverityChange = useCallback(
    (severity: "error" | "warning" | "off") => {
      onSeverityChange(rule.id, severity);
    },
    [rule.id, onSeverityChange]
  );

  const handleToggleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Severity indicator color
  const severityColor =
    rule.severity === "error"
      ? "#ef4444"
      : rule.severity === "warning"
      ? "#f59e0b"
      : "var(--uilint-text-disabled)";

  return (
    <div
      onClick={onClick}
      style={{
        padding: isMobile ? "12px 16px" : "10px 16px",
        cursor: "pointer",
        borderBottom: "1px solid var(--uilint-border)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: isSelected ? "var(--uilint-surface-elevated)" : "transparent",
      }}
    >
      {/* Severity indicator dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: severityColor,
          flexShrink: 0,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: isMobile ? 15 : 13,
            fontWeight: 500,
            marginBottom: 2,
            lineHeight: 1.3,
            color: rule.severity === "off"
              ? "var(--uilint-text-disabled)"
              : "var(--uilint-text-primary)",
          }}
        >
          {rule.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--uilint-text-muted)",
          }}
        >
          {rule.id}
        </div>
      </div>

      {/* Issue count badge */}
      {issueCount > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            background: "rgba(239, 68, 68, 0.1)",
            color: "#dc2626",
            padding: "2px 6px",
            borderRadius: 10,
            minWidth: 20,
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          {issueCount}
        </span>
      )}

      {/* Severity toggle */}
      <SeverityToggle
        value={rule.severity}
        onChange={handleSeverityChange}
        onClick={handleToggleClick}
      />
    </div>
  );
}
