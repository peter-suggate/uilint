/**
 * IssuesSummaryCard - Elegant summary of issues displayed in initial state
 *
 * Inspired by Spotlight/Raycast: Shows overview instead of all items
 * for better performance and cleaner UX.
 */
import React from "react";
import { motion } from "motion/react";
import { ErrorIcon, WarningIcon, InfoIcon, FileIcon, ChevronRightIcon } from "../../icons";
import type { Issue } from "../../types";

interface IssuesSummaryCardProps {
  issues: Issue[];
  isSelected: boolean;
  onClick: () => void;
}

interface SeverityCount {
  errors: number;
  warnings: number;
  info: number;
}

export function IssuesSummaryCard({ issues, isSelected, onClick }: IssuesSummaryCardProps) {
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
      onClick={onClick}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        margin: "8px 12px",
        padding: "14px 16px",
        borderRadius: 12,
        cursor: "pointer",
        background: isSelected
          ? "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.06) 100%)"
          : "linear-gradient(135deg, rgba(249, 250, 251, 0.8) 0%, rgba(243, 244, 246, 0.6) 100%)",
        border: isSelected
          ? "1px solid rgba(59, 130, 246, 0.2)"
          : "1px solid rgba(0, 0, 0, 0.04)",
        boxShadow: isSelected
          ? "0 0 0 3px rgba(59, 130, 246, 0.1), 0 2px 8px rgba(0, 0, 0, 0.04)"
          : "0 1px 3px rgba(0, 0, 0, 0.04)",
        transition: "all 0.2s ease",
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
              background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 14 }}>📋</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
              All Issues
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              Type to search across all issues
            </div>
          </div>
        </div>
        <ChevronRightIcon
          size={16}
          style={{
            color: "#9ca3af",
            opacity: isSelected ? 1 : 0.5,
            transform: isSelected ? "translateX(2px)" : "none",
            transition: "all 0.15s ease",
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
          icon={null}
          label="Total"
          value={issues.length}
          color="#6366f1"
          bgColor="rgba(99, 102, 241, 0.08)"
        />

        {/* Errors */}
        {counts.errors > 0 && (
          <StatBadge
            icon={<ErrorIcon size={12} />}
            label="Errors"
            value={counts.errors}
            color="#ef4444"
            bgColor="rgba(239, 68, 68, 0.08)"
          />
        )}

        {/* Warnings */}
        {counts.warnings > 0 && (
          <StatBadge
            icon={<WarningIcon size={12} />}
            label="Warnings"
            value={counts.warnings}
            color="#f59e0b"
            bgColor="rgba(245, 158, 11, 0.08)"
          />
        )}

        {/* Files */}
        <StatBadge
          icon={<FileIcon size={12} />}
          label="Files"
          value={fileCount}
          color="#10b981"
          bgColor="rgba(16, 185, 129, 0.08)"
        />
      </div>
    </motion.div>
  );
}

function StatBadge({
  icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        background: bgColor,
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          marginBottom: 2,
        }}
      >
        {icon && <span style={{ color, display: "flex" }}>{icon}</span>}
        <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 500 }}>{label}</div>
    </div>
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
          color: "#9ca3af",
        }}
      >
        Top Issues
      </div>
      {topIssues.map((issue, idx) => (
        <TopIssueItem
          key={issue.id}
          issue={issue}
          isSelected={startIndex + idx === selectedIndex}
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
  onClick,
  index,
}: {
  issue: Issue;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}) {
  const SeverityIcon = issue.severity === "error" ? ErrorIcon : WarningIcon;
  const severityColor = issue.severity === "error" ? "#ef4444" : "#f59e0b";
  const fileName = issue.filePath.split("/").pop() || issue.filePath;

  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.2,
        delay: index * 0.03,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        cursor: "pointer",
        background: isSelected
          ? "linear-gradient(90deg, rgba(59, 130, 246, 0.08) 0%, transparent 100%)"
          : "transparent",
        borderLeft: isSelected ? "2px solid #3b82f6" : "2px solid transparent",
        transition: "all 0.15s ease",
      }}
    >
      <SeverityIcon size={14} color={severityColor} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            color: "#374151",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {issue.message}
        </div>
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
          {fileName}:{issue.line}
        </div>
      </div>
    </motion.div>
  );
}
