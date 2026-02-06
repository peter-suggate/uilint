/**
 * Text Section Renderer
 *
 * Renders plain text content with various styling variants.
 */

import React from "react";
import type { TextSection as TextSectionSchema } from "uilint-core";
import { resolveDynamicValue, type BindingContext } from "../binding-utils";

interface TextSectionProps {
  section: TextSectionSchema;
  ctx: BindingContext;
}

/**
 * Gets CSS styles for text variant
 */
function getVariantStyles(variant?: string): React.CSSProperties {
  const base: React.CSSProperties = {
    marginBottom: "0.5rem",
    lineHeight: 1.5,
  };

  switch (variant) {
    case "caption":
      return {
        ...base,
        fontSize: "0.75rem",
        color: "var(--uilint-text-muted)",
      };
    case "muted":
      return {
        ...base,
        fontSize: "0.875rem",
        color: "var(--uilint-text-muted)",
      };
    case "error":
      return {
        ...base,
        fontSize: "0.875rem",
        color: "var(--uilint-error)",
      };
    case "success":
      return {
        ...base,
        fontSize: "0.875rem",
        color: "var(--uilint-success)",
      };
    case "body":
    default:
      return {
        ...base,
        fontSize: "0.875rem",
        color: "var(--uilint-text-primary)",
      };
  }
}

/**
 * Renders a text section
 */
export function TextSection({ section, ctx }: TextSectionProps) {
  const content = resolveDynamicValue(section.content, ctx);

  if (content === undefined || content === null) {
    return null;
  }

  const styles = getVariantStyles(section.variant);

  return <p style={styles}>{String(content)}</p>;
}
