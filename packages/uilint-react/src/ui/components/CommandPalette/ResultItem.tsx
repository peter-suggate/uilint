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
      style={{
        display: "flex",
        alignItems: "flex-start",
        padding: "10px 16px",
        cursor: "pointer",
        background: isSelected ? "#f3f4f6" : "transparent",
        gap: 12,
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <SeverityIcon size={16} color={severityColor} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14,
          color: "#111827",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {issue.message}
        </div>
        <div style={{
          fontSize: 12,
          color: "#6b7280",
          marginTop: 2,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <FileIcon size={12} />
            {fileName}:{issue.line}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <RuleIcon size={12} />
            {issue.ruleId}
          </span>
        </div>
      </div>
    </div>
  );
}
