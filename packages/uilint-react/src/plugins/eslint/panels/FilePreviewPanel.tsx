/**
 * FilePreviewPanel - Preview pane content for a file search item
 *
 * Shows filename header + issue count, then renders FileSourceView
 * with inline issue annotations. Uses local state for issue selection.
 */

import React, { useState, useMemo, useCallback } from "react";
import { FileCode, AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { PluginServices } from "../../../core/plugin-system/types";
import { getAllIssues } from "../tile-provider";
import { FileSourceView } from "../../../ui/components/Inspector/FileSourceView";

// ============================================================================
// Types
// ============================================================================

export interface FilePreviewPanelProps {
  filePath: string;
  services: PluginServices;
}

// ============================================================================
// Main Component
// ============================================================================

export function FilePreviewPanel({ filePath, services }: FilePreviewPanelProps) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const allIssues = getAllIssues(services);

  const fileIssues = useMemo(
    () => allIssues.filter((i) => i.filePath === filePath),
    [allIssues, filePath]
  );

  const handleIssueSelect = useCallback((issueId: string) => {
    setSelectedIssueId(issueId);
  }, []);

  const fileName = filePath.split("/").pop() || filePath;

  // Severity summary
  const errors = fileIssues.filter((i) => i.severity === "error").length;
  const warnings = fileIssues.filter((i) => i.severity === "warning").length;
  const infos = fileIssues.filter((i) => i.severity === "info").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-foreground/[0.06]">
        <div className="flex items-center gap-2 mb-1">
          <FileCode size={14} className="text-muted-foreground/60 flex-shrink-0" />
          <h3 className="text-sm font-semibold text-foreground/90 truncate">
            {fileName}
          </h3>
        </div>

        <p className="text-[11px] text-muted-foreground/50 truncate mb-2">
          {filePath}
        </p>

        <div className="flex items-center gap-3 text-[10px]">
          {errors > 0 && (
            <span className="flex items-center gap-1 text-error/80">
              <AlertCircle size={10} />
              <span className="tabular-nums">{errors}</span>
            </span>
          )}
          {warnings > 0 && (
            <span className="flex items-center gap-1 text-warning/80">
              <AlertTriangle size={10} />
              <span className="tabular-nums">{warnings}</span>
            </span>
          )}
          {infos > 0 && (
            <span className="flex items-center gap-1 text-info/80">
              <Info size={10} />
              <span className="tabular-nums">{infos}</span>
            </span>
          )}
        </div>
      </div>

      {/* Source view */}
      <div className="flex-1 overflow-y-auto">
        {fileIssues.length > 0 ? (
          <FileSourceView
            filePath={filePath}
            issues={fileIssues}
            contextLines={2}
            selectedIssueId={selectedIssueId}
            onIssueSelect={handleIssueSelect}
          />
        ) : (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground/50">
            No issues in this file
          </div>
        )}
      </div>
    </div>
  );
}
