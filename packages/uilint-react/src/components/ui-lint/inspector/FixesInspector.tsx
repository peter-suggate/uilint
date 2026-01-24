"use client";

import React, { useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "../command-palette/icons";
import { useUILintStore, type UILintStore } from "../store";
import { groupBySourceFile } from "../dom-utils";

/**
 * FixesInspector - shows a copyable prompt for fixing all issues
 * Lists all files with visible issues and provides a prompt to fix them
 */
export function FixesInspector() {
  const [copied, setCopied] = useState(false);

  const autoScanState = useUILintStore((s: UILintStore) => s.autoScanState);
  const elementIssuesCache = useUILintStore((s: UILintStore) => s.elementIssuesCache);
  const fileIssuesCache = useUILintStore((s: UILintStore) => s.fileIssuesCache);

  // Get files with issues
  const filesWithIssues = useMemo(() => {
    const sourceFiles = groupBySourceFile(autoScanState.elements);
    const fileIssueMap = new Map<string, number>();

    // Count element issues per file
    for (const file of sourceFiles) {
      let issueCount = 0;
      for (const el of file.elements) {
        const cached = elementIssuesCache.get(el.id);
        if (cached) {
          issueCount += cached.issues.length;
        }
      }
      if (issueCount > 0) {
        fileIssueMap.set(file.path, issueCount);
      }
    }

    // Add file-level issues
    for (const [filePath, issues] of fileIssuesCache) {
      const existing = fileIssueMap.get(filePath) || 0;
      fileIssueMap.set(filePath, existing + issues.length);
    }

    // Convert to array and sort by issue count (most issues first)
    return Array.from(fileIssueMap.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count);
  }, [autoScanState.elements, elementIssuesCache, fileIssuesCache]);

  // Generate the prompt
  const prompt = useMemo(() => {
    if (filesWithIssues.length === 0) {
      return "";
    }

    const fileList = filesWithIssues.map((f) => `- ${f.path}`).join("\n");

    return `Please fix all lint warnings and errors in the following files and don't stop until the files are clean:

${fileList}`;
  }, [filesWithIssues]);

  // Total issue count
  const totalIssues = useMemo(() => {
    return filesWithIssues.reduce((sum, f) => sum + f.count, 0);
  }, [filesWithIssues]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!prompt) return;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  }, [prompt]);

  if (filesWithIssues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center" data-ui-lint>
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
            "bg-green-100 dark:bg-green-900/40"
          )}
        >
          <Icons.CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-sm font-medium text-foreground mb-1">No issues found</h3>
        <p className="text-xs text-muted-foreground">
          All visible files are clean
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-ui-lint>
      {/* Header */}
      <div className="flex flex-col gap-3 p-4 border-b border-border">
        {/* Icon and title */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              "bg-violet-100 dark:bg-violet-900/40"
            )}
          >
            <Icons.Wand className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-snug">
              Fix Prompt
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filesWithIssues.length} {filesWithIssues.length === 1 ? "file" : "files"} with {totalIssues} {totalIssues === 1 ? "issue" : "issues"}
            </p>
          </div>
        </div>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md",
            "bg-accent text-accent-foreground",
            "hover:bg-accent/90 transition-colors",
            "text-sm font-medium w-full"
          )}
          data-ui-lint
        >
          {copied ? (
            <>
              <Icons.Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Icons.Copy className="w-4 h-4" />
              Copy Prompt
            </>
          )}
        </button>
      </div>

      {/* Prompt preview */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div
          className={cn(
            "rounded-lg p-3",
            "bg-muted/50 border border-border",
            "font-mono text-xs text-foreground",
            "whitespace-pre-wrap"
          )}
        >
          {prompt}
        </div>
      </div>

      {/* Files list */}
      <div className="border-t border-border p-4">
        <h4 className="text-xs font-medium text-muted-foreground mb-2">
          Files with issues
        </h4>
        <div className="space-y-1 max-h-32 overflow-auto">
          {filesWithIssues.map((file) => (
            <div
              key={file.path}
              className="flex items-center justify-between text-xs"
            >
              <span className="truncate font-mono text-foreground">
                {file.path.split("/").pop()}
              </span>
              <span className="text-muted-foreground flex-shrink-0 ml-2">
                {file.count} {file.count === 1 ? "issue" : "issues"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
