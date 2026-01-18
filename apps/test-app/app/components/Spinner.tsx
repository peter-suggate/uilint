"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface SpinnerProps {
  dimension?: "small" | "medium" | "large";
  variant?: "blue" | "gray" | "light";
}

/**
 * Loading indicator using Lucide icon with animation
 * NOTE: Visually identical to LoadingSpinner but uses icon-based approach
 */
export function Spinner({ dimension = "medium", variant = "blue" }: SpinnerProps) {
  const dimensionStyles: Record<string, string> = {
    small: "w-4 h-4",
    medium: "w-8 h-8",
    large: "w-12 h-12",
  };

  const variantStyles: Record<string, string> = {
    blue: "text-blue-600",
    gray: "text-gray-600",
    light: "text-white",
  };

  return (
    <Loader2
      className={`${dimensionStyles[dimension]} ${variantStyles[variant]} animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
}
