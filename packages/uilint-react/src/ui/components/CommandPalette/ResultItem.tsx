/**
 * ResultItem - Single result row in command palette
 */
import React from "react";
import { FileIcon, RuleIcon, WarningIcon, ErrorIcon, InfoIcon } from "../../icons";
import { Badge } from "../primitives";
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

  const severityColor = issue.severity === "error" ? "var(--uilint-error)"
    : issue.severity === "warning" ? "var(--uilint-warning)"
    : "var(--uilint-info)";

  const severityVariant = issue.severity === "error" ? "error"
    : issue.severity === "warning" ? "warning"
    : "info";

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
        gap: 12,
        borderBottom: "1px solid var(--uilint-border)",
        background: isSelected ? "var(--uilint-surface-elevated)" : "transparent",
        transition: "background 0.1s ease",
      }}
    >
      <SeverityIcon size={16} color={severityColor} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: "var(--uilint-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {issue.message}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--uilint-text-muted)",
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <FileIcon size={12} />
            {fileName}:{issue.line}
          </span>
          <Badge variant={severityVariant} size="sm" disableAnimation>
            {issue.ruleId}
          </Badge>
        </div>
      </div>
    </div>
  );
}
