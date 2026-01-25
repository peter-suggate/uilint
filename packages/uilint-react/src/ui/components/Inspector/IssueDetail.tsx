/**
 * IssueDetail - Shows details for a single issue
 *
 * Clean, elegant UI with:
 * - Header: severity icon + message + rule ID
 * - Source code viewer with highlighted line
 * - Compact metadata footer
 */
import React from "react";
import { WarningIcon, ErrorIcon, InfoIcon } from "../../icons";
import { severityToColor } from "../../types";
import { SourceViewer } from "./SourceViewer";
import type { Issue } from "../../types";

interface IssueDetailProps {
  issue: Issue;
}

/**
 * Extract filename from path
 */
function getFileName(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}

export function IssueDetail({ issue }: IssueDetailProps) {
  const SeverityIcon =
    issue.severity === "error"
      ? ErrorIcon
      : issue.severity === "warning"
        ? WarningIcon
        : InfoIcon;

  return (
    <div
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Header: Message + Rule */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <SeverityIcon
          size={18}
          color={severityToColor(issue.severity)}
          style={{ marginTop: 2, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--uilint-text-primary)",
              lineHeight: 1.4,
            }}
          >
            {issue.message}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--uilint-text-muted)",
              marginTop: 4,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            }}
          >
            {issue.ruleId}
          </div>
        </div>
      </div>

      {/* Source Viewer */}
      <SourceViewer
        filePath={issue.filePath}
        line={issue.line}
        column={issue.column}
        contextLines={5}
      />

      {/* Compact Metadata Footer */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 12px",
          fontSize: 11,
          color: "var(--uilint-text-muted)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
        }}
      >
        <span title={issue.filePath}>
          {getFileName(issue.filePath)}:{issue.line}
          {issue.column ? `:${issue.column}` : ""}
        </span>
        <span style={{ opacity: 0.5 }}>|</span>
        <span>{issue.pluginId}</span>
      </div>
    </div>
  );
}
