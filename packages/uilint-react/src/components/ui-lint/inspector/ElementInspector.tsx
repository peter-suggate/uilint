"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "../command-palette/icons";
import { FullFileViewer } from "./FullFileViewer";
import { useUILintStore, type UILintStore } from "../store";

interface ElementInspectorProps {
  elementId: string;
}

/**
 * Element inspector - shows element details and all its issues
 */
export function ElementInspector({ elementId }: ElementInspectorProps) {
  const elementIssuesCache = useUILintStore((s: UILintStore) => s.elementIssuesCache);
  const autoScanState = useUILintStore((s: UILintStore) => s.autoScanState);
  const setInspectorIssue = useUILintStore((s: UILintStore) => s.setInspectorIssue);

  // Find the element
  const element = useMemo(
    () => autoScanState.elements.find((el) => el.id === elementId),
    [autoScanState.elements, elementId]
  );

  // Get issues for this element
  const elementData = elementIssuesCache.get(elementId);
  const issues = elementData?.issues ?? [];

  // Extract element source info
  const filePath = element?.source.fileName ?? "";
  const lineNumber = element?.source.lineNumber;
  const columnNumber = element?.source.columnNumber;
  const fileName = filePath.split("/").pop() || filePath;

  if (!element) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <Icons.AlertTriangle className="w-6 h-6 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Element not found</p>
        <p className="text-xs text-muted-foreground font-mono mt-1 max-w-[200px] truncate">
          {elementId}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-ui-lint>
      {/* Header */}
      <div className="flex flex-col gap-3 p-4 border-b border-border">
        {/* Element info */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent/10">
            <Icons.Code className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Element
            </p>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {element.tagName || "Unknown"}
            </p>
          </div>
          {issues.length > 0 && (
            <span
              className={cn(
                "inline-flex items-center justify-center",
                "min-w-[20px] h-5 px-1.5",
                "text-[10px] font-semibold",
                "rounded-full",
                "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
              )}
            >
              {issues.length}
            </span>
          )}
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icons.File className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate font-mono text-[11px]">{fileName}</span>
          {lineNumber && (
            <>
              <span className="text-text-disabled">:</span>
              <span className="font-mono">{lineNumber}</span>
            </>
          )}
          {columnNumber && (
            <>
              <span className="text-text-disabled">:</span>
              <span className="font-mono">{columnNumber}</span>
            </>
          )}
        </div>
      </div>

      {/* Issues list - if any */}
      {issues.length > 0 && (
        <div className="p-4 border-b border-border">
          <label className="text-xs font-medium text-text-secondary mb-2 block">
            Issues ({issues.length})
          </label>
          <div className="space-y-1">
            {issues.map((issue, idx) => (
              <button
                key={`${issue.ruleId}-${issue.line}-${idx}`}
                type="button"
                onClick={() => {
                  setInspectorIssue(issue, elementId, filePath);
                }}
                className={cn(
                  "w-full text-left p-2 rounded-md text-xs",
                  "bg-muted/50 hover:bg-muted",
                  "transition-colors"
                )}
                data-ui-lint
              >
                <p className="text-foreground line-clamp-2">{issue.message}</p>
                <p className="text-muted-foreground font-mono mt-0.5">
                  {issue.ruleId}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Full file viewer */}
      <div className="flex-1 min-h-0">
        <FullFileViewer
          filePath={filePath}
          highlightLine={lineNumber}
          highlightColumn={columnNumber}
          className="h-full"
        />
      </div>
    </div>
  );
}
