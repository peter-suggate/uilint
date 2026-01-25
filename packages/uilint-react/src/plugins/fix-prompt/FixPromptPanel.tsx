/**
 * FixPromptPanel - Inspector panel for displaying copyable fix prompts
 *
 * Generates a prompt that can be copied to Cursor or Claude Code
 * to fix all lint issues on the current page.
 */

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
 */
function generateFixPrompt(issuesByFile: Map<string, Issue[]>, workspaceRoot: string | null): string {
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
  lines.push(`1. Fix ALL of the lint issues listed below`);
  lines.push(`2. Do NOT ignore or suppress any issues with eslint-disable comments`);
  lines.push(`3. Do NOT skip any issues - each one must be properly addressed`);
  lines.push(`4. Run the linter after fixing to verify all issues are resolved`);
  lines.push(`5. If an issue cannot be fixed without breaking functionality, explain why and propose an alternative solution`);
  lines.push(``);

  // Files and issues
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 16px",
        background: copied ? "var(--uilint-success)" : "var(--uilint-primary)",
        color: "white",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        fontWeight: 500,
        fontSize: 14,
        transition: "background 0.2s",
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

  const issuesByFile = useMemo(() => groupIssuesByFile(issues), [issues]);
  const promptText = useMemo(
    () => generateFixPrompt(issuesByFile, workspaceRoot),
    [issuesByFile, workspaceRoot]
  );

  const totalIssues = issues.length;
  const fileCount = issuesByFile.size;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header stats */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid var(--uilint-border)",
          background: "var(--uilint-surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, color: "var(--uilint-text-muted)", marginBottom: 4 }}>
              {totalIssues === 0
                ? "No issues found"
                : `${totalIssues} issue${totalIssues === 1 ? "" : "s"} in ${fileCount} file${fileCount === 1 ? "" : "s"}`}
            </div>
            <div style={{ fontSize: 12, color: "var(--uilint-text-muted)" }}>
              Copy this prompt to Cursor or Claude Code
            </div>
          </div>
          {totalIssues > 0 && (
            <CopyButton text={promptText} onCopy={() => {}} />
          )}
        </div>
      </div>

      {/* Prompt preview */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px",
        }}
      >
        <pre
          style={{
            margin: 0,
            padding: "16px",
            background: "var(--uilint-code-bg, #1e1e1e)",
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--uilint-code-text, #d4d4d4)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
          {promptText}
        </pre>
      </div>

      {/* Footer with instructions */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--uilint-border)",
          background: "var(--uilint-surface-elevated)",
          fontSize: 12,
          color: "var(--uilint-text-muted)",
        }}
      >
        <strong>Tip:</strong> Paste this prompt into Cursor, Claude Code, or any AI assistant to get help fixing these lint issues.
      </div>
    </div>
  );
}

export default FixPromptPanel;
