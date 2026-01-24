"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "../command-palette/icons";
import { FullFileViewer } from "./FullFileViewer";
import { useUILintStore, type UILintStore } from "../store";
import type { ESLintIssue } from "../types";

interface IssueInspectorProps {
  issue: ESLintIssue;
  elementId?: string;
  filePath: string;
}

/**
 * Issue inspector - shows issue details with full file viewer
 */
export function IssueInspector({ issue, elementId, filePath }: IssueInspectorProps) {
  const setInspectorRule = useUILintStore((s: UILintStore) => s.setInspectorRule);
  const availableRules = useUILintStore((s: UILintStore) => s.availableRules);

  // Get rule info if available
  const ruleId = issue.ruleId?.replace(/^uilint\//, "");
  const rule = useMemo(
    () => availableRules.find((r) => r.id === ruleId),
    [availableRules, ruleId]
  );

  // Build cursor:// URL for opening in Cursor
  const cursorUrl =
    filePath && issue.line
      ? `cursor://file/${filePath}:${issue.line}${issue.column ? `:${issue.column}` : ""}`
      : null;

  // Extract filename for display
  const fileName = filePath?.split("/").pop() || filePath;

  return (
    <div className="flex flex-col h-full" data-ui-lint>
      {/* Header */}
      <div className="flex flex-col gap-3 p-4 border-b border-border">
        {/* Issue icon and message */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              "bg-amber-100 dark:bg-amber-900/40"
            )}
          >
            <Icons.AlertTriangle
              className="w-4 h-4 text-amber-600 dark:text-amber-400"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-snug">
              {issue.message}
            </p>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icons.File className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate font-mono text-[11px]">{fileName}</span>
          <span className="text-text-disabled">:</span>
          <span className="font-mono">{issue.line}</span>
          {issue.column && (
            <>
              <span className="text-text-disabled">:</span>
              <span className="font-mono">{issue.column}</span>
            </>
          )}
        </div>

        {/* Rule badge and actions */}
        <div className="flex items-center justify-between gap-2">
          {issue.ruleId && (
            <button
              type="button"
              onClick={() => setInspectorRule(ruleId || issue.ruleId!)}
              className={cn(
                "text-[11px] font-mono text-muted-foreground px-2 py-1 rounded",
                "bg-muted hover:bg-hover transition-colors",
                "flex items-center gap-1"
              )}
              data-ui-lint
            >
              <span>{issue.ruleId}</span>
              <Icons.ChevronRight className="w-3 h-3" />
            </button>
          )}
          {cursorUrl && (
            <a
              href={cursorUrl}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md",
                "bg-accent text-accent-foreground",
                "hover:bg-accent/90 transition-colors",
                "text-xs font-medium"
              )}
            >
              <Icons.ExternalLink className="w-3 h-3" />
              Open in Cursor
            </a>
          )}
        </div>
      </div>

      {/* Full file viewer */}
      <div className="flex-1 min-h-0">
        <FullFileViewer
          filePath={filePath}
          highlightLine={issue.line}
          highlightColumn={issue.column}
          className="h-full"
        />
      </div>
    </div>
  );
}
