/**
 * DuplicateSimilarityBadge - Color-coded similarity percentage indicator
 *
 * Visual indicator showing how similar two code blocks are:
 * - 85-100%: Red (high similarity - likely duplicate)
 * - 70-85%: Orange (moderate similarity)
 * - <70%: Yellow (lower similarity)
 */
import React from "react";

interface DuplicateSimilarityBadgeProps {
  /** Similarity score as a decimal (0-1) or percentage (0-100) */
  similarity: number;
  /** Optional custom className */
  className?: string;
}

/**
 * Get color based on similarity percentage
 */
export function getSimilarityColor(percentage: number): {
  bg: string;
  text: string;
  border: string;
} {
  if (percentage >= 85) {
    return {
      bg: "rgba(239, 68, 68, 0.15)",
      text: "#dc2626",
      border: "rgba(239, 68, 68, 0.3)",
    };
  }
  if (percentage >= 70) {
    return {
      bg: "rgba(245, 158, 11, 0.15)",
      text: "#d97706",
      border: "rgba(245, 158, 11, 0.3)",
    };
  }
  return {
    bg: "rgba(234, 179, 8, 0.15)",
    text: "#ca8a04",
    border: "rgba(234, 179, 8, 0.3)",
  };
}

/**
 * Get label based on similarity percentage
 */
export function getSimilarityLabel(percentage: number): string {
  if (percentage >= 85) return "Very High";
  if (percentage >= 70) return "High";
  return "Moderate";
}

export function DuplicateSimilarityBadge({
  similarity,
  className,
}: DuplicateSimilarityBadgeProps) {
  // Normalize to percentage (handle both 0-1 and 0-100 inputs)
  const percentage = similarity <= 1 ? Math.round(similarity * 100) : Math.round(similarity);
  const colors = getSimilarityColor(percentage);
  const label = getSimilarityLabel(percentage);

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 6,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        fontSize: 12,
        fontWeight: 600,
        color: colors.text,
      }}
    >
      <span
        style={{
          fontSize: 14,
        }}
      >
        {percentage}%
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          opacity: 0.9,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default DuplicateSimilarityBadge;
