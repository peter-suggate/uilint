/**
 * Header Section Renderer
 *
 * Renders a header with optional icon and subtitle.
 */

import React from "react";
import type { HeaderSection as HeaderSectionSchema } from "uilint-core";
import { resolveDynamicValue, type BindingContext } from "../binding-utils";
import { getIcon } from "../icon-map";

interface HeaderSectionProps {
  section: HeaderSectionSchema;
  ctx: BindingContext;
}

/**
 * Renders a header section
 */
export function HeaderSection({ section, ctx }: HeaderSectionProps) {
  const text = resolveDynamicValue(section.text, ctx);
  const subtitle = resolveDynamicValue(section.subtitle, ctx);
  const IconComponent = section.icon ? getIcon(section.icon) : null;

  const containerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
    marginBottom: "0.75rem",
    ...(section.sticky && {
      position: "sticky",
      top: 0,
      backgroundColor: "var(--uilint-surface)",
      padding: "0.5rem 0",
      zIndex: 10,
    }),
  };

  return (
    <div style={containerStyle}>
      {IconComponent && (
        <span style={{ color: "var(--uilint-text-muted)", flexShrink: 0, marginTop: "0.125rem" }}>
          <IconComponent size={16} />
        </span>
      )}
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--uilint-text-primary)",
          }}
        >
          {String(text ?? "")}
        </h3>
        {subtitle && (
          <p
            style={{
              margin: "0.25rem 0 0 0",
              fontSize: "0.75rem",
              color: "var(--uilint-text-muted)",
            }}
          >
            {String(subtitle)}
          </p>
        )}
      </div>
    </div>
  );
}
