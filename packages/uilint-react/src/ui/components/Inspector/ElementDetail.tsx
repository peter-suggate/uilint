/**
 * ElementDetail - Shows issues for a specific element (dataLoc)
 */
import React from "react";
import { useIssues } from "../../hooks";
import { WarningIcon, ErrorIcon, InfoIcon } from "../../icons";
import { Badge, Card } from "../primitives";
import { cn } from "../../../lib/utils";
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
      <div className="p-4 text-center text-text-muted">
        No issues for this element
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="text-sm font-semibold text-text-primary mb-3">
        {issues.length} issue{issues.length !== 1 ? "s" : ""} at this location
      </div>

      <Card variant="elevated" className="overflow-hidden">
        {issues.map((issue, index) => {
          const SeverityIcon = issue.severity === "error" ? ErrorIcon
            : issue.severity === "warning" ? WarningIcon
            : InfoIcon;

          return (
            <div
              key={issue.id}
              onClick={() => onSelectIssue(issue)}
              className={cn(
                "flex items-start gap-2.5 p-3 cursor-pointer",
                index < issues.length - 1 && "border-b border-border"
              )}
            >
              <Badge
                variant={issue.severity === "error" ? "error" : issue.severity === "warning" ? "warning" : "info"}
                size="sm"
                disableAnimation
                className="shrink-0"
              >
                <SeverityIcon size={12} color="currentColor" />
              </Badge>
              <div className="flex-1">
                <div className="text-[13px] text-text-primary">
                  {issue.message}
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {issue.ruleId}
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      <div className="mt-3 text-[11px] text-text-disabled break-all">
        {dataLoc}
      </div>
    </div>
  );
}
