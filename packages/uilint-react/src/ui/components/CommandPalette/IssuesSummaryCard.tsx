/**
 * IssuesSummaryCard - Elegant summary of issues displayed in initial state
 *
 * Inspired by Spotlight/Raycast: Shows overview instead of all items
 * for better performance and cleaner UX.
 */
import React from "react";
import { motion } from "motion/react";
import { ErrorIcon, WarningIcon, InfoIcon, FileIcon, ChevronRightIcon } from "../../icons";
import { StatBadge } from "../primitives";
import { useScrollTarget } from "./useScrollSelectedIntoView";
import type { Issue } from "../../types";

interface IssuesSummaryCardProps {
  issues: Issue[];
  isSelected: boolean;
  resultIndex?: number;
  onClick: () => void;
}

interface SeverityCount {
  errors: number;
  warnings: number;
  info: number;
}

export function IssuesSummaryCard({ issues, isSelected, resultIndex, onClick }: IssuesSummaryCardProps) {
  const scrollRef = useScrollTarget(resultIndex ?? -1);

  // Count issues by severity
  const counts: SeverityCount = React.useMemo(() => {
    return issues.reduce(
      (acc, issue) => {
        if (issue.severity === "error") acc.errors++;
        else if (issue.severity === "warning") acc.warnings++;
        else acc.info++;
        return acc;
      },
      { errors: 0, warnings: 0, info: 0 }
    );
  }, [issues]);

  // Count unique files
  const fileCount = React.useMemo(() => {
    return new Set(issues.map((i) => i.filePath)).size;
  }, [issues]);

  if (issues.length === 0) return null;

  return (
    <motion.div
      ref={resultIndex != null ? scrollRef : undefined}
      onClick={onClick}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
      style={{
        margin: "8px 12px",
        padding: "14px 16px",
        borderRadius: "var(--uilint-card-radius, 12px)",
        cursor: "pointer",
        background: isSelected
          ? "var(--uilint-info-bg)"
          : "var(--uilint-surface-elevated)",
        border: isSelected
          ? "1px solid var(--uilint-info)"
          : "1px solid var(--uilint-border)",
        boxShadow: isSelected
          ? "0 0 0 3px var(--uilint-info-bg), var(--uilint-card-shadow)"
          : "var(--uilint-card-shadow)",
        transition: "all 0.1s ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, var(--uilint-accent) 0%, var(--uilint-info) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 14 }}>📋</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--uilint-text-primary)" }}>
              All Issues
            </div>
            <div style={{ fontSize: 11, color: "var(--uilint-text-muted)" }}>
              Type to search across all issues
            </div>
          </div>
        </div>
        <ChevronRightIcon
          size={16}
          style={{
            color: "var(--uilint-text-disabled)",
            opacity: isSelected ? 1 : 0.5,
            transform: isSelected ? "translateX(2px)" : "none",
            transition: "all 0.1s ease",
          }}
        />
      </div>

      {/* Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
        }}
      >
        {/* Total */}
        <StatBadge
          label="Total"
          value={issues.length}
          variant="info"
          size="sm"
          disableAnimation
        />

        {/* Errors */}
        {counts.errors > 0 && (
          <StatBadge
            icon={<ErrorIcon size={12} />}
            label="Errors"
            value={counts.errors}
            variant="error"
            size="sm"
            disableAnimation
          />
        )}

        {/* Warnings */}
        {counts.warnings > 0 && (
          <StatBadge
            icon={<WarningIcon size={12} />}
            label="Warnings"
            value={counts.warnings}
            variant="warning"
            size="sm"
            disableAnimation
          />
        )}

        {/* Files */}
        <StatBadge
          icon={<FileIcon size={12} />}
          label="Files"
          value={fileCount}
          variant="success"
          size="sm"
          disableAnimation
        />
      </div>
    </motion.div>
  );
}

/**
 * TopIssuesPreview - Shows a few critical issues as a preview
 */
export function TopIssuesPreview({
  issues,
  onSelectIssue,
  startIndex,
  selectedIndex,
}: {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  startIndex: number;
  selectedIndex: number;
}) {
  // Show only top 3 errors or warnings
  const topIssues = React.useMemo(() => {
    return issues
      .filter((i) => i.severity === "error" || i.severity === "warning")
      .slice(0, 3);
  }, [issues]);

  if (topIssues.length === 0) return null;

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          padding: "8px 16px 4px",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--uilint-text-disabled)",
        }}
      >
        Top Issues
      </div>
      {topIssues.map((issue, idx) => (
        <TopIssueItem
          key={issue.id}
          issue={issue}
          isSelected={startIndex + idx === selectedIndex}
          resultIndex={startIndex + idx}
          onClick={() => onSelectIssue(issue)}
          index={idx}
        />
      ))}
    </div>
  );
}

function TopIssueItem({
  issue,
  isSelected,
  resultIndex,
  onClick,
  index,
}: {
  issue: Issue;
  isSelected: boolean;
  resultIndex: number;
  onClick: () => void;
  index: number;
}) {
  const scrollRef = useScrollTarget(resultIndex);
  const SeverityIcon = issue.severity === "error" ? ErrorIcon : WarningIcon;
  const severityColor = issue.severity === "error" ? "var(--uilint-error)" : "var(--uilint-warning)";
  const fileName = issue.filePath.split("/").pop() || issue.filePath;

  return (
    <motion.div
      ref={scrollRef}
      onClick={onClick}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.1,
        delay: index * 0.02,
        ease: [0.32, 0.72, 0, 1],
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        cursor: "pointer",
        background: isSelected
          ? "var(--uilint-info-bg)"
          : "transparent",
        borderLeft: isSelected ? "2px solid var(--uilint-accent)" : "2px solid transparent",
        transition: "all 0.1s ease",
      }}
    >
      <SeverityIcon size={14} color={severityColor} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--uilint-text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {issue.message}
        </div>
        <div style={{ fontSize: 10, color: "var(--uilint-text-disabled)", marginTop: 1 }}>
          {fileName}:{issue.line}
        </div>
      </div>
    </motion.div>
  );
}
