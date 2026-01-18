"use client";

import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: "primary" | "secondary" | "white";
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

const colorClasses = {
  primary: "border-blue-600",
  secondary: "border-gray-600",
  white: "border-white",
};

/**
 * Loading spinner using CSS animation
 * Uses border-based spinner technique
 */
export function LoadingSpinner({ size = "md", color = "primary" }: LoadingSpinnerProps) {
  return (
    <div
      className={`${sizeClasses[size]} ${colorClasses[color]} border-2 border-t-transparent rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
}
