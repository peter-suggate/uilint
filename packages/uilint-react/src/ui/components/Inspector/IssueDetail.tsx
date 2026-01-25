/**
 * IssueDetail - Shows details for a single issue
 */
import React from "react";
import { WarningIcon, ErrorIcon, InfoIcon, FileIcon, RuleIcon } from "../../icons";
import { severityToColor } from "../../types";
import type { Issue } from "../../types";

interface IssueDetailProps {
  issue: Issue;
}

export function IssueDetail({ issue }: IssueDetailProps) {
  const SeverityIcon = issue.severity === "error" ? ErrorIcon
    : issue.severity === "warning" ? WarningIcon
    : InfoIcon;

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        marginBottom: 16,
      }}>
        <SeverityIcon size={24} color={severityToColor(issue.severity)} />
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--uilint-text-primary)",
          }}>
            {issue.message}
          </div>
          <div style={{
            fontSize: 12,
            color: "var(--uilint-text-muted)",
            marginTop: 4,
          }}>
            {issue.severity.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Details */}
      <div style={{
        background: "var(--uilint-surface-elevated)",
        borderRadius: 8,
        padding: 12,
      }}>
        <DetailRow icon={<FileIcon size={14} />} label="File" value={issue.filePath} />
        <DetailRow icon={<span>📍</span>} label="Line" value={`${issue.line}${issue.column ? `:${issue.column}` : ""}`} />
        <DetailRow icon={<RuleIcon size={14} />} label="Rule" value={issue.ruleId} />
        <DetailRow icon={<span>🔌</span>} label="Plugin" value={issue.pluginId} />
      </div>

      {/* Data Loc */}
      {issue.dataLoc && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "var(--uilint-text-muted)", marginBottom: 4 }}>
            Data Location
          </div>
          <code style={{
            display: "block",
            padding: 8,
            background: "var(--uilint-background)",
            color: "var(--uilint-text-primary)",
            border: "1px solid var(--uilint-border)",
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "monospace",
            wordBreak: "break-all",
          }}>
            {issue.dataLoc}
          </code>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 0",
      borderBottom: "1px solid var(--uilint-border)",
    }}>
      {icon}
      <span style={{ fontSize: 12, color: "var(--uilint-text-muted)", width: 50 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--uilint-text-primary)", flex: 1, wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
}
