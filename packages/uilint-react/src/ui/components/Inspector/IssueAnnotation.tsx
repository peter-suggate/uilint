/**
 * IssueAnnotation - Inline issue decoration below a code line
 *
 * Shows the issue message with severity indicator, displayed
 * directly below the code line that has the issue.
 *
 * Styled as a distinct "callout" card to differentiate from code.
 */
import React from "react";
import { motion } from "motion/react";
import { cn } from "../../../lib/utils";
import type { Issue } from "../../types";

// ============================================================================
// Types
// ============================================================================

export interface IssueAnnotationProps {
  /** The issue to display */
  issue: Issue;
  /** Whether this issue is selected */
  isSelected: boolean;
  /** Called when clicked */
  onSelect: () => void;
  /** Width of the line number gutter */
  gutterWidth?: number;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get CSS classes for severity styling
 */
function getSeverityClasses(severity: Issue["severity"]): {
  border: string;
  bg: string;
  icon: string;
  iconBg: string;
} {
  switch (severity) {
    case "error":
      return {
        border: "border-error/30",
        bg: "bg-error/[0.12]",
        icon: "text-error",
        iconBg: "bg-error/20",
      };
    case "warning":
      return {
        border: "border-warning/30",
        bg: "bg-warning/[0.12]",
        icon: "text-warning",
        iconBg: "bg-warning/20",
      };
    case "info":
      return {
        border: "border-info/30",
        bg: "bg-info/[0.12]",
        icon: "text-info",
        iconBg: "bg-info/20",
      };
  }
}

/**
 * Truncate rule ID for display
 */
function formatRuleId(ruleId: string): string {
  // Extract short name from namespaced rules like @typescript-eslint/no-unused-vars
  return ruleId.includes("/") ? ruleId.split("/").pop()! : ruleId;
}

/**
 * Severity icon component
 */
function SeverityIcon({ severity }: { severity: Issue["severity"] }) {
  if (severity === "error") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 4.5V8.5M8 11.5V11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (severity === "warning") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 1.5L14.5 13.5H1.5L8 1.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M8 6V9M8 11.5V11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  // info
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 7V11.5M8 4.5V5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

export function IssueAnnotation({
  issue,
  isSelected,
  onSelect,
  gutterWidth = 40,
  className,
}: IssueAnnotationProps) {
  const severityClasses = getSeverityClasses(issue.severity);

  return (
    <motion.div
      onClick={onSelect}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "flex items-start cursor-pointer",
        "mx-2 my-1.5",
        "rounded-md",
        "border",
        severityClasses.border,
        severityClasses.bg,
        isSelected && "ring-2 ring-foreground/20",
        "hover:brightness-95",
        "transition-all duration-100",
        className
      )}
      style={{ marginLeft: gutterWidth + 8 }}
    >
      {/* Icon container */}
      <div
        className={cn(
          "flex-shrink-0 flex items-center justify-center",
          "w-8 h-8",
          "rounded-l-md",
          severityClasses.iconBg,
          severityClasses.icon
        )}
      >
        <SeverityIcon severity={issue.severity} />
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0 py-1.5 px-2.5">
        <p
          className={cn(
            "text-[11px] leading-snug",
            "text-foreground/90",
            "font-sans font-medium",
            isSelected ? "line-clamp-none" : "line-clamp-2"
          )}
        >
          {issue.message}
        </p>

        {/* Rule ID badge */}
        <span
          className={cn(
            "inline-block mt-1",
            "px-1.5 py-0.5",
            "text-[9px] text-muted-foreground/70",
            "font-mono",
            "bg-foreground/[0.06] rounded",
            "transition-opacity duration-100"
          )}
        >
          {formatRuleId(issue.ruleId)}
        </span>
      </div>
    </motion.div>
  );
}

export default IssueAnnotation;
