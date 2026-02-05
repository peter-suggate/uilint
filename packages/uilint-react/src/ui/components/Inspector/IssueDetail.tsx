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
    <div className="p-4 flex flex-col gap-4">
      {/* Header: Severity Badge + Message + Rule */}
      <div className="flex items-start gap-2.5">
        <Badge
          variant={issue.severity === "error" ? "error" : issue.severity === "warning" ? "warning" : "info"}
          size="sm"
          disableAnimation
          className="shrink-0 mt-0.5"
        >
          <SeverityIcon
            size={12}
            color="currentColor"
            className="mr-1"
          />
          {issue.severity}
        </Badge>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary leading-snug">
            {issue.message}
          </div>
          <Badge
            variant="outline"
            size="sm"
            disableAnimation
            className="mt-1.5 font-mono"
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
      <div className="flex flex-wrap gap-y-1 gap-x-3 text-[11px] text-text-muted font-mono">
        <span title={issue.filePath}>
          {getFileName(issue.filePath)}:{issue.line}
          {issue.column ? `:${issue.column}` : ""}
        </span>
        <span className="opacity-50">|</span>
        <span>{issue.pluginId}</span>
      </div>
    </div>
  );
}
