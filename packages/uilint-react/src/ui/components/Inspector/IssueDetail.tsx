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
import { SourceViewer } from "./SourceViewer";
import { Badge } from "../primitives";
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
      {/* Header: Severity Badge + Message + Rule */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Badge
          variant={issue.severity === "error" ? "error" : issue.severity === "warning" ? "warning" : "info"}
          size="sm"
          disableAnimation
          style={{ flexShrink: 0, marginTop: 2 }}
        >
          <SeverityIcon
            size={12}
            color="currentColor"
            style={{ marginRight: 4 }}
          />
          {issue.severity}
        </Badge>
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
          <Badge
            variant="outline"
            size="sm"
            disableAnimation
            style={{
              marginTop: 6,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            }}
          >
            {issue.ruleId}
          </Badge>
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
