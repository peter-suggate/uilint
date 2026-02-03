"use client";

import React, { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "success" | "warning" | "error" | "info";
  size?: "sm" | "md" | "lg";
}

const variantStyles = {
  success: "bg-green-100 text-green-800 border-green-200",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  error: "bg-red-100 text-red-800 border-red-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
};

/**
 * Badge component for status indicators
 */
export function Badge({ children, variant = "info", size = "md" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
}

/**
 * Status indicator badge
 * NOTE: Same as Badge but with a dot indicator
 */
export function StatusBadge({ children, variant = "info", size = "md" }: BadgeProps) {
  const dotColors = {
    success: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotColors[variant]}`} />
      {children}
    </span>
  );
}
