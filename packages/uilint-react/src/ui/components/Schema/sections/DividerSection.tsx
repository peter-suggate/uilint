/**
 * Divider Section Renderer
 *
 * Renders a visual divider with configurable spacing.
 */

import React from "react";
import type { DividerSection as DividerSectionSchema } from "uilint-core";

interface DividerSectionProps {
  section: DividerSectionSchema;
}

/**
 * Gets margin for spacing variant
 */
function getSpacingMargin(spacing?: string): string {
  switch (spacing) {
    case "small":
      return "0.5rem 0";
    case "large":
      return "1.5rem 0";
    case "medium":
    default:
      return "1rem 0";
  }
}

/**
 * Renders a divider section
 */
export function DividerSection({ section }: DividerSectionProps) {
  const margin = getSpacingMargin(section.spacing);

  return (
    <hr
      style={{
        margin,
        border: "none",
        borderTop: "1px solid var(--uilint-border)",
      }}
    />
  );
}
