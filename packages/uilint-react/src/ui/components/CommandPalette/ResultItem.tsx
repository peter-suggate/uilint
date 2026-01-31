/**
 * ResultItem - Single result row in command palette
 */
import React from "react";
import { WarningIcon, ErrorIcon, InfoIcon } from "../../icons";
import { Badge } from "../primitives";
import { useComposedStore } from "../../../core/store";
import type { Issue } from "../../types";

interface ResultItemProps {
  issue: Issue;
  isSelected: boolean;
  onClick: () => void;
}

export function ResultItem({ issue, isSelected, onClick }: ResultItemProps) {
  const isMobile = useComposedStore((s) => s.mobile.isMobile);

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
        padding: isMobile ? "12px 16px" : "10px 16px",
        cursor: "pointer",
        gap: 10,
        borderBottom: "1px solid var(--uilint-border)",
        background: isSelected ? "var(--uilint-surface-elevated)" : "transparent",
        transition: "background 0.1s ease",
      }}
    >
      <SeverityIcon size={16} color={severityColor} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: isMobile ? 15 : 14,
            lineHeight: 1.4,
            color: "var(--uilint-text-primary)",
            wordBreak: "break-word",
          }}
        >
          {issue.message}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--uilint-text-muted)",
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
