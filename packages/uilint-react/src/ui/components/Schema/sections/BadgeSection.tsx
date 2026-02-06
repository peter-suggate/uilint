/**
 * Badge Section Renderer
 *
 * Renders a badge/pill display for status, severity, similarity, etc.
 */

import React from "react";
import type { BadgeSection as BadgeSectionSchema } from "uilint-core";
import { resolveBinding, type BindingContext } from "../binding-utils";
import { Badge, StatBadge, CategoryBadge, CountBadge } from "../../badge";

interface BadgeSectionProps {
  section: BadgeSectionSchema;
  ctx: BindingContext;
}

/**
 * Gets color for similarity percentage
 */
function getSimilarityColor(similarity: number): string {
  if (similarity >= 85) return "error";
  if (similarity >= 70) return "warning";
  return "info";
}

/**
 * Gets label for similarity percentage
 */
function getSimilarityLabel(similarity: number): string {
  if (similarity >= 90) return "Very High";
  if (similarity >= 75) return "High";
  if (similarity >= 60) return "Moderate";
  return "Low";
}

/**
 * Renders a badge section
 */
export function BadgeSection({ section, ctx }: BadgeSectionProps) {
  const value = resolveBinding(section.value, ctx);

  const containerStyle: React.CSSProperties = section.centered
    ? { display: "flex", justifyContent: "center", marginBottom: "0.75rem" }
    : { marginBottom: "0.75rem" };

  switch (section.variant) {
    case "similarity": {
      const similarity = typeof value === "number" ? value : 0;
      const percent = Math.round(similarity * 100);
      const color = getSimilarityColor(percent);
      const label = getSimilarityLabel(percent);

      return (
        <div style={containerStyle}>
          <Badge variant={color as "error" | "warning" | "info"}>
            {percent}% Match - {label}
          </Badge>
        </div>
      );
    }

    case "severity": {
      const severity = String(value || "info");
      const variantMap: Record<string, "error" | "warning" | "success" | "info"> = {
        error: "error",
        warning: "warning",
        info: "info",
        success: "success",
      };
      const variant = variantMap[severity] || "info";

      return (
        <div style={containerStyle}>
          <Badge variant={variant}>
            {section.label ? `${section.label}: ` : ""}{severity}
          </Badge>
        </div>
      );
    }

    case "status": {
      const status = String(value || "unknown");
      const statusColors: Record<string, "error" | "warning" | "success" | "info"> = {
        ready: "success",
        indexing: "info",
        error: "error",
        idle: "info",
        loading: "info",
      };
      const variant = statusColors[status] || "info";

      return (
        <div style={containerStyle}>
          <Badge variant={variant}>
            {section.label ? `${section.label}: ` : ""}{status}
          </Badge>
        </div>
      );
    }

    case "category": {
      const category = String(value || "");
      return (
        <div style={containerStyle}>
          <CategoryBadge>{category}</CategoryBadge>
        </div>
      );
    }

    case "count": {
      const count = typeof value === "number" ? value : 0;
      return (
        <div style={containerStyle}>
          {section.label && (
            <span style={{ marginRight: "0.5rem", fontSize: "0.75rem", color: "var(--uilint-text-muted)" }}>
              {section.label}:
            </span>
          )}
          <CountBadge count={count} />
        </div>
      );
    }

    default:
      return null;
  }
}
