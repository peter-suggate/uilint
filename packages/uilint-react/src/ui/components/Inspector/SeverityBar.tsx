/**
 * SeverityBar - Proportional horizontal bar showing severity distribution.
 *
 * A thin bar segmented by severity (red | amber | blue) with proportional widths.
 * Think GitHub language bar but for issue severity.
 */
import React from "react";
import { motion } from "motion/react";
import { cn } from "../../../lib/utils";
import type { IssueSeverity } from "../../types";

export interface SeverityBarProps {
  segments: Array<{
    id: string;
    count: number;
    severity: IssueSeverity;
  }>;
  className?: string;
}

export function SeverityBar({ segments, className }: SeverityBarProps) {
  const visibleSegments = segments.filter((segment) => segment.count > 0);
  const total = visibleSegments.reduce(
    (sum, segment) => sum + segment.count,
    0
  );
  if (total === 0) return null;

  return (
    <div
      className={cn(
        "flex h-1.5 w-full rounded-full overflow-hidden bg-foreground/4",
        className
      )}
    >
      {visibleSegments.map((segment, index) => {
        const widthPct = (segment.count / total) * 100;
        return (
          <motion.div
            key={segment.id}
            className={cn(
              "relative",
              segment.severity === "error" && "bg-error",
              segment.severity === "warning" && "bg-warning",
              segment.severity === "info" && "bg-info"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${widthPct}%` }}
            transition={{
              duration: 0.4,
              ease: [0.25, 0.1, 0.25, 1],
              delay: Math.min(index * 0.02, 0.2),
            }}
            style={{ minWidth: widthPct > 0 ? "2px" : undefined }}
            title={`${segment.id}: ${segment.count}`}
          >
            {/* Rule boundary to keep per-rule contributions readable */}
            {index < visibleSegments.length - 1 && (
              <span className="absolute inset-y-0 right-0 w-px bg-background/65" />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
