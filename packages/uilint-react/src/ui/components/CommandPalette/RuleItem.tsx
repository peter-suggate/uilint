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
  const options: Array<{ value: "error" | "warning" | "off"; label: string; activeClass: string }> = [
    { value: "error", label: "E", activeClass: "bg-red-500 text-white" },
    { value: "warning", label: "W", activeClass: "bg-amber-500 text-white" },
    { value: "off", label: "Off", activeClass: "bg-gray-500 text-white" },
  ];

  return (
    <div className="flex gap-0.5" onClick={onClick}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={(e) => {
            e.stopPropagation();
            onChange(opt.value);
          }}
          className={`px-1.5 py-0.5 text-[10px] font-medium border-none rounded cursor-pointer ${
            value === opt.value ? opt.activeClass : "bg-transparent text-gray-400"
          }`}
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

  const iconBgClass = rule.severity === "error"
    ? "bg-red-50 text-red-500"
    : rule.severity === "warning"
    ? "bg-amber-50 text-amber-500"
    : "bg-gray-100 text-gray-500";

  return (
    <div
      onClick={onClick}
      className={`px-4 py-2.5 cursor-pointer border-b border-gray-100 flex items-center gap-3 ${
        isSelected ? "bg-gray-100" : "bg-transparent"
      }`}
    >
      {/* Icon */}
      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${iconBgClass}`}>
        <RuleIcon size={14} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          className={`text-[13px] font-medium mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap ${
            rule.severity === "off" ? "text-gray-400" : "text-gray-900"
          }`}
        >
          {rule.name}
        </div>
        <div className="text-[11px] text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap">
          {rule.id}
        </div>
      </div>

      {/* Issue count badge */}
      {issueCount > 0 && (
        <span className="text-[10px] font-semibold bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full min-w-5 text-center">
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
