"use client";

import React, { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  current: number;
  baseline?: number;
  displayMode?: "raw" | "money" | "percentage";
}

// Formatting utilities
const formatters = {
  raw: (n: number) => n.toLocaleString("en-US"),
  money: (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }),
  percentage: (n: number) => n.toFixed(1) + "%",
};

// Hook for calculating trend
function useTrendCalculation(current: number, baseline?: number) {
  return useMemo(() => {
    if (baseline === undefined || baseline === 0) {
      return { trend: null, direction: "neutral" as const };
    }
    const delta = current - baseline;
    const percentChange = (delta / baseline) * 100;
    return {
      trend: percentChange,
      direction: delta >= 0 ? ("up" as const) : ("down" as const),
    };
  }, [current, baseline]);
}

/**
 * Metric display card with trend indicator
 * Same visual output as StatCard but uses hooks and memo for calculations
 * NOTE: Similar UI to StatCard but different implementation approach
 */
export function MetricCard({
  title,
  current,
  baseline,
  displayMode = "raw",
}: MetricCardProps) {
  const formatter = formatters[displayMode];
  const formattedValue = useMemo(() => formatter(current), [current, formatter]);
  const { trend, direction } = useTrendCalculation(current, baseline);

  const TrendIcon = direction === "up" ? TrendingUp : TrendingDown;
  const trendColorClass = direction === "up" ? "text-green-600" : "text-red-600";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{formattedValue}</span>
        {trend !== null && (
          <span className={`flex items-center text-sm font-medium ${trendColorClass}`}>
            <TrendIcon className="w-4 h-4" />
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
