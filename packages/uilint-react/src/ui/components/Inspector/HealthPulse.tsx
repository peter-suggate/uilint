/**
 * HealthPulse - At-a-glance severity summary for the inspector.
 *
 * Shows a severity distribution bar, summary text, and clickable severity chips.
 * Always visible at the top of the inspector. Minimal, borderless styling.
 */
import React, { useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "../../../lib/utils";
import {
  useComposedStore,
  selectFileGroupsSummary,
  selectRuleCards,
  selectRuleContributionSegments,
} from "../../../core/store";
import { SeverityBar } from "./SeverityBar";
import type { IssueSeverity } from "../../types";

export interface HealthPulseProps {
  className?: string;
}

function SeverityChip({
  severity,
  count,
  isActive,
  onClick,
}: {
  severity: IssueSeverity;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={`Filter by ${severity} (${count})`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
        "text-[10px] font-medium tabular-nums",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/25 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "transition-colors duration-75",
        severity === "error" &&
          (isActive
            ? "text-error bg-error/15"
            : "text-error/60 bg-error/5 hover:bg-error/10"),
        severity === "warning" &&
          (isActive
            ? "text-warning bg-warning/15"
            : "text-warning/60 bg-warning/5 hover:bg-warning/10"),
        severity === "info" &&
          (isActive
            ? "text-info bg-info/15"
            : "text-info/60 bg-info/5 hover:bg-info/10")
      )}
    >
      {severity === "error" && <AlertCircle size={10} />}
      {severity === "warning" && <AlertTriangle size={10} />}
      {severity === "info" && <Info size={10} />}
      {count}
    </button>
  );
}

export function HealthPulse({ className }: HealthPulseProps) {
  const summary = useComposedStore(selectFileGroupsSummary);
  const ruleCards = useComposedStore(selectRuleCards);
  const activeFilter = useComposedStore(
    (s) => s.inspector.healthPulseSeverityFilter
  );
  const setFilter = useComposedStore((s) => s.setHealthPulseSeverityFilter);

  const handleChipClick = useCallback(
    (severity: IssueSeverity) => {
      // Toggle: click again to clear
      setFilter(activeFilter === severity ? null : severity);
    },
    [activeFilter, setFilter]
  );

  const matchingRulesCount = useMemo(() => {
    if (!activeFilter) return 0;
    return ruleCards.filter((card) => card.severityCounts[activeFilter] > 0)
      .length;
  }, [activeFilter, ruleCards]);
  const ruleContributionSegments = useComposedStore(
    selectRuleContributionSegments
  );

  if (summary.totalIssues === 0) return null;

  const issuePlural = summary.totalIssues === 1 ? "issue" : "issues";
  const rulePlural = summary.totalRules === 1 ? "rule" : "rules";
  const filePlural = summary.totalFiles === 1 ? "file" : "files";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn("px-3 py-2.5", "border-b border-foreground/6", className)}
    >
      <SeverityBar segments={ruleContributionSegments} className="mb-2" />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground/60">
          All issues: {summary.totalIssues} {issuePlural} · {summary.totalRules}{" "}
          {rulePlural} · {summary.totalFiles} {filePlural}
        </span>

        <div className="flex items-center gap-1">
          <SeverityChip
            severity="error"
            count={summary.severityCounts.error}
            isActive={activeFilter === "error"}
            onClick={() => handleChipClick("error")}
          />
          <SeverityChip
            severity="warning"
            count={summary.severityCounts.warning}
            isActive={activeFilter === "warning"}
            onClick={() => handleChipClick("warning")}
          />
          <SeverityChip
            severity="info"
            count={summary.severityCounts.info}
            isActive={activeFilter === "info"}
            onClick={() => handleChipClick("info")}
          />
        </div>
      </div>
      {activeFilter && (
        <div className="mt-2 text-[11px] text-muted-foreground/65">
          Filtering rules by{" "}
          <span className="text-foreground/80">{activeFilter}</span> · showing{" "}
          <span className="text-foreground/80">{matchingRulesCount}</span>{" "}
          matching {matchingRulesCount === 1 ? "rule" : "rules"}
        </div>
      )}
    </motion.div>
  );
}
