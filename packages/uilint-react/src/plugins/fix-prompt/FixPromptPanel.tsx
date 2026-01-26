/**
 * FixPromptPanel - Inspector panel for displaying copyable fix prompts
 *
 * Generates a prompt that can be copied to Cursor or Claude Code
 * to fix all lint issues on the current page.
 */

/* eslint-disable uilint/consistent-dark-mode -- theming handled via CSS custom properties */
import React, { useMemo, useState, useCallback } from "react";
import type { InspectorPanelProps } from "../../core/plugin-system/types";
import type { Issue } from "../../ui/types";

/**
 * Group issues by file path
 */
function groupIssuesByFile(issues: Issue[]): Map<string, Issue[]> {
  const grouped = new Map<string, Issue[]>();

  for (const issue of issues) {
    const filePath = issue.filePath || "unknown";
    const existing = grouped.get(filePath) || [];
    existing.push(issue);
    grouped.set(filePath, existing);
  }

  // Sort issues within each file by line number
  for (const [filePath, fileIssues] of grouped) {
    grouped.set(
      filePath,
      fileIssues.sort((a, b) => a.line - b.line)
    );
  }

  return grouped;
}

/**
 * Generate the fix prompt text
 * @param issuesByFile Map of file paths to issues
 * @param workspaceRoot Workspace root path for relative paths
 * @param hookAvailable Whether post-tool-use hook is configured (enables condensed format)
 */
function generateFixPrompt(
  issuesByFile: Map<string, Issue[]>,
  workspaceRoot: string | null,
  hookAvailable: boolean
): string {
  const totalIssues = Array.from(issuesByFile.values()).reduce(
    (sum, issues) => sum + issues.length,
    0
  );
  const fileCount = issuesByFile.size;

  if (totalIssues === 0) {
    return "No lint issues found on the current page.";
  }

  const lines: string[] = [];

  // Header
  lines.push(`# Fix Lint Issues`);
  lines.push(``);
  lines.push(`There are **${totalIssues} lint issue${totalIssues === 1 ? "" : "s"}** across **${fileCount} file${fileCount === 1 ? "" : "s"}** that need to be fixed.`);
  lines.push(``);

  // Instructions
  lines.push(`## Instructions`);
  lines.push(``);
  lines.push(`1. Fix ALL of the lint issues in the files listed below`);
  lines.push(`2. Do NOT ignore or suppress any issues with eslint-disable comments`);
  lines.push(`3. Do NOT skip any issues - each one must be properly addressed`);
  lines.push(`4. Run the linter after fixing to verify all issues are resolved`);
  lines.push(`5. If an issue cannot be fixed without breaking functionality, explain why and propose an alternative solution`);
  lines.push(``);

  if (hookAvailable) {
    // CONDENSED FORMAT: Only list affected files (hook will provide details on edit)
    lines.push(`## Affected Files`);
    lines.push(``);
    lines.push(`The following files have lint issues. When you edit each file, you will receive the specific lint errors automatically.`);
    lines.push(``);

    for (const [filePath, issues] of issuesByFile) {
      const displayPath = workspaceRoot && filePath.startsWith(workspaceRoot)
        ? filePath.slice(workspaceRoot.length + 1)
        : filePath;
      lines.push(`- \`${displayPath}\` (${issues.length} issue${issues.length === 1 ? "" : "s"})`);
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(``);
    lines.push(`Open each file above and fix all reported lint issues. The linter will provide specific error details when you edit each file.`);
  } else {
    // DETAILED FORMAT: List all issues with locations and messages
    lines.push(`## Affected Files`);
    lines.push(``);

    for (const [filePath, issues] of issuesByFile) {
      // Show relative path if we have workspace root
      const displayPath = workspaceRoot && filePath.startsWith(workspaceRoot)
        ? filePath.slice(workspaceRoot.length + 1)
        : filePath;

      lines.push(`### ${displayPath}`);
      lines.push(``);

      for (const issue of issues) {
        const location = issue.column
          ? `Line ${issue.line}, Column ${issue.column}`
          : `Line ${issue.line}`;

        const severity = issue.severity === "error" ? "ERROR" : "WARNING";
        const ruleId = issue.ruleId ? ` (${issue.ruleId})` : "";

        lines.push(`- **[${severity}]** ${location}${ruleId}`);
        lines.push(`  ${issue.message}`);
      }

      lines.push(``);
    }

    // Summary
    lines.push(`---`);
    lines.push(``);
    lines.push(`Please fix all ${totalIssues} issues listed above. Do not use eslint-disable comments or any other method to suppress warnings. Each issue must be properly resolved.`);
  }

  return lines.join("\n");
}

/**
 * Copy button with feedback
 */
function CopyButton({ text, onCopy }: { text: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [text, onCopy]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-4 py-2 text-white border-none rounded-md cursor-pointer font-medium text-sm transition-colors"
      style={{
        background: copied ? "var(--uilint-success)" : "var(--uilint-primary)",
      }}
    >
      {copied ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy to Clipboard
        </>
      )}
    </button>
  );
}

/**
 * FixPromptPanel component
 */
export function FixPromptPanel({ data }: InspectorPanelProps) {
  const issues = (data?.issues as Issue[]) || [];
  const workspaceRoot = (data?.workspaceRoot as string) || null;
  const hookAvailable = (data?.hookAvailable as boolean) || false;

  const issuesByFile = useMemo(() => groupIssuesByFile(issues), [issues]);
  const promptText = useMemo(
    () => generateFixPrompt(issuesByFile, workspaceRoot, hookAvailable),
    [issuesByFile, workspaceRoot, hookAvailable]
  );

  const totalIssues = issues.length;
  const fileCount = issuesByFile.size;

  return (
    <div className="flex flex-col h-full">
      {/* Header stats */}
      <div
        className="p-4 border-b"
        style={{
          borderColor: "var(--uilint-border)",
          background: "var(--uilint-surface)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div
              className="text-sm mb-1"
              style={{ color: "var(--uilint-text-muted)" }}
            >
              {totalIssues === 0
                ? "No issues found"
                : `${totalIssues} issue${totalIssues === 1 ? "" : "s"} in ${fileCount} file${fileCount === 1 ? "" : "s"}`}
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--uilint-text-muted)" }}
            >
              {hookAvailable
                ? "Condensed format - hook will provide issue details"
                : "Copy this prompt to Cursor or Claude Code"}
            </div>
          </div>
          {totalIssues > 0 && (
            <CopyButton text={promptText} onCopy={() => {}} />
          )}
        </div>
      </div>

      {/* Prompt preview */}
      <div className="flex-1 overflow-auto p-4">
        <pre
          className="m-0 p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap break-words font-mono"
          style={{
            background: "var(--uilint-code-bg, #1e1e1e)",
            color: "var(--uilint-code-text, #d4d4d4)",
          }}
        >
          {promptText}
        </pre>
      </div>

      {/* Footer with instructions */}
      <div
        className="px-4 py-3 border-t text-xs"
        style={{
          borderColor: "var(--uilint-border)",
          background: "var(--uilint-surface-elevated)",
          color: "var(--uilint-text-muted)",
        }}
      >
        <strong>Tip:</strong> Paste this prompt into Cursor, Claude Code, or any AI assistant to get help fixing these lint issues.
      </div>
    </div>
  );
}

export default FixPromptPanel;
