"use client";

import React from "react";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  previousValue?: number;
  format?: "number" | "currency" | "percent";
}

/**
 * Statistics card showing a value with optional trend indicator
 * Uses imperative percentage calculation
 */
export function StatCard({ label, value, previousValue, format = "number" }: StatCardProps) {
  // Format value based on type
  let displayValue: string;
  if (format === "currency") {
    displayValue = "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2 });
  } else if (format === "percent") {
    displayValue = value.toFixed(1) + "%";
  } else {
    displayValue = value.toLocaleString("en-US");
  }

  // Calculate percentage change imperatively
  let changePercent: number | null = null;
  let isPositive = true;
  if (previousValue !== undefined && previousValue !== 0) {
    const diff = value - previousValue;
    changePercent = (diff / previousValue) * 100;
    isPositive = diff >= 0;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{displayValue}</span>
        {changePercent !== null && (
          <span
            className={`flex items-center text-sm font-medium ${
              isPositive ? "text-green-600" : "text-red-600"
            }`}
          >
            {isPositive ? (
              <ArrowUpIcon className="w-4 h-4" />
            ) : (
              <ArrowDownIcon className="w-4 h-4" />
            )}
            {Math.abs(changePercent).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
