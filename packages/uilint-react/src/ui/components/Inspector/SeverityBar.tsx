/**
 * SeverityBar - Proportional horizontal bar showing severity distribution.
 *
 * A thin bar segmented by severity (red | amber | blue) with proportional widths.
 * Think GitHub language bar but for issue severity.
 */
import React from "react";
import { motion } from "motion/react";
import { cn } from "../../../lib/utils";

export interface SeverityBarProps {
  error: number;
  warning: number;
  info: number;
  className?: string;
}

export function SeverityBar({ error, warning, info, className }: SeverityBarProps) {
  const total = error + warning + info;
  if (total === 0) return null;

  const errorPct = (error / total) * 100;
  const warningPct = (warning / total) * 100;
  const infoPct = (info / total) * 100;

  return (
    <div
      className={cn(
        "flex h-1.5 w-full rounded-full overflow-hidden bg-foreground/[0.04]",
        className
      )}
    >
      {error > 0 && (
        <motion.div
          className="bg-error"
          initial={{ width: 0 }}
          animate={{ width: `${errorPct}%` }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        />
      )}
      {warning > 0 && (
        <motion.div
          className="bg-warning"
          initial={{ width: 0 }}
          animate={{ width: `${warningPct}%` }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1], delay: 0.05 }}
        />
      )}
      {info > 0 && (
        <motion.div
          className="bg-info"
          initial={{ width: 0 }}
          animate={{ width: `${infoPct}%` }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
        />
      )}
    </div>
  );
}
