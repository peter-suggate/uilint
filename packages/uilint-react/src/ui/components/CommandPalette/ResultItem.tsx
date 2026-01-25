/**
 * ResultItem - Single result row in command palette
 */
import React from "react";
import { FileIcon, RuleIcon, WarningIcon, ErrorIcon, InfoIcon } from "../../icons";
import type { Issue } from "../../types";

interface ResultItemProps {
  issue: Issue;
  isSelected: boolean;
  onClick: () => void;
}

export function ResultItem({ issue, isSelected, onClick }: ResultItemProps) {
  const SeverityIcon = issue.severity === "error" ? ErrorIcon
    : issue.severity === "warning" ? WarningIcon
    : InfoIcon;

  const severityColor = issue.severity === "error" ? "#ef4444"
    : issue.severity === "warning" ? "#f59e0b"
    : "#3b82f6";

  // Extract filename from path
  const fileName = issue.filePath.split("/").pop() || issue.filePath;

  return (
    <div
      onClick={onClick}
      className={`flex items-start px-4 py-2.5 cursor-pointer gap-3 border-b border-gray-100 ${
        isSelected ? "bg-gray-100" : "bg-transparent"
      }`}
    >
      <SeverityIcon size={16} color={severityColor} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-900 overflow-hidden text-ellipsis whitespace-nowrap">
          {issue.message}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
          <span className="flex items-center gap-1">
            <FileIcon size={12} />
            {fileName}:{issue.line}
          </span>
          <span className="flex items-center gap-1">
            <RuleIcon size={12} />
            {issue.ruleId}
          </span>
        </div>
      </div>
    </div>
  );
}
