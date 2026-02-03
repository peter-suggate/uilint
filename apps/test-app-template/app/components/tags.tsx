"use client";

import React, { ReactNode } from "react";

interface TagProps {
  children: ReactNode;
  type?: "positive" | "caution" | "negative" | "neutral";
  dimension?: "small" | "medium" | "large";
}

const typeColors = {
  positive: "bg-green-100 text-green-800 border-green-200",
  caution: "bg-yellow-100 text-yellow-800 border-yellow-200",
  negative: "bg-red-100 text-red-800 border-red-200",
  neutral: "bg-blue-100 text-blue-800 border-blue-200",
};

const dimensionClasses = {
  small: "px-2 py-0.5 text-xs",
  medium: "px-2.5 py-1 text-sm",
  large: "px-3 py-1.5 text-base",
};

/**
 * Tag component for labeling items
 * NOTE: This is a DUPLICATE of Badge - same visual output, different naming
 */
export function Tag({ children, type = "neutral", dimension = "medium" }: TagProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${typeColors[type]} ${dimensionClasses[dimension]}`}
    >
      {children}
    </span>
  );
}

/**
 * Tag with status dot indicator
 * NOTE: This is a DUPLICATE of StatusBadge - same visual output, different naming
 */
export function StatusTag({ children, type = "neutral", dimension = "medium" }: TagProps) {
  const indicatorColors = {
    positive: "bg-green-500",
    caution: "bg-yellow-500",
    negative: "bg-red-500",
    neutral: "bg-blue-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${typeColors[type]} ${dimensionClasses[dimension]}`}
    >
      <span className={`w-2 h-2 rounded-full ${indicatorColors[type]}`} />
      {children}
    </span>
  );
}
