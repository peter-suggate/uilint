/**
 * ElementDetail - Shows issues for a specific element (dataLoc)
 */
import React from "react";
import { useIssues } from "../../hooks";
import { WarningIcon, ErrorIcon, InfoIcon } from "../../icons";
import { severityToColor } from "../../types";
import type { Issue } from "../../types";

interface ElementDetailProps {
  dataLoc: string;
  onSelectIssue: (issue: Issue) => void;
}

export function ElementDetail({ dataLoc, onSelectIssue }: ElementDetailProps) {
  const { getIssuesForDataLoc } = useIssues();
  const issues = getIssuesForDataLoc(dataLoc);

  if (issues.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>
        No issues for this element
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        color: "#111827",
        marginBottom: 12,
      }}>
        {issues.length} issue{issues.length !== 1 ? "s" : ""} at this location
      </div>

      <div style={{
        background: "#f9fafb",
        borderRadius: 8,
        overflow: "hidden",
      }}>
        {issues.map((issue, index) => {
          const SeverityIcon = issue.severity === "error" ? ErrorIcon
            : issue.severity === "warning" ? WarningIcon
            : InfoIcon;

          return (
            <div
              key={issue.id}
              onClick={() => onSelectIssue(issue)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 12,
                cursor: "pointer",
                borderBottom: index < issues.length - 1 ? "1px solid #e5e7eb" : undefined,
              }}
            >
              <SeverityIcon size={16} color={severityToColor(issue.severity)} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13,
                  color: "#111827",
                }}>
                  {issue.message}
                </div>
                <div style={{
                  fontSize: 11,
                  color: "#6b7280",
                  marginTop: 2,
                }}>
                  {issue.ruleId}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 12,
        fontSize: 11,
        color: "#9ca3af",
        wordBreak: "break-all",
      }}>
        {dataLoc}
      </div>
    </div>
  );
}
