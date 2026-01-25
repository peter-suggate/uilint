/**
 * RuleItem - Single rule row in command palette with severity toggle
 */
import React, { useCallback } from "react";
import { RuleIcon } from "../../icons";
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
  const options: Array<{ value: "error" | "warning" | "off"; label: string; color: string }> = [
    { value: "error", label: "E", color: "#ef4444" },
    { value: "warning", label: "W", color: "#f59e0b" },
    { value: "off", label: "Off", color: "#6b7280" },
  ];

  return (
    <div
      style={{ display: "flex", gap: 2 }}
      onClick={onClick}
    >
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
            borderRadius: 3,
            cursor: "pointer",
            background: value === opt.value ? opt.color : "transparent",
            color: value === opt.value ? "white" : "#9ca3af",
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
  const handleSeverityChange = useCallback(
    (severity: "error" | "warning" | "off") => {
      onSeverityChange(rule.id, severity);
    },
    [rule.id, onSeverityChange]
  );

  const handleToggleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 16px",
        cursor: "pointer",
        background: isSelected ? "#f3f4f6" : "transparent",
        borderBottom: "1px solid #f3f4f6",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background:
            rule.severity === "error"
              ? "#fef2f2"
              : rule.severity === "warning"
              ? "#fffbeb"
              : "#f3f4f6",
          color:
            rule.severity === "error"
              ? "#ef4444"
              : rule.severity === "warning"
              ? "#f59e0b"
              : "#6b7280",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <RuleIcon size={14} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: rule.severity === "off" ? "#9ca3af" : "#111827",
            marginBottom: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {rule.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#6b7280",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
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
            background: "#fef2f2",
            color: "#dc2626",
            padding: "2px 6px",
            borderRadius: 10,
            minWidth: 20,
            textAlign: "center",
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
