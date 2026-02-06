/**
 * Progress Section Renderer
 *
 * Renders a progress indicator with optional label.
 */

import React from "react";
import type { ProgressSection as ProgressSectionSchema } from "uilint-core";
import { resolveDynamicValue, type BindingContext } from "../binding-utils";

interface ProgressSectionProps {
  section: ProgressSectionSchema;
  ctx: BindingContext;
}

/**
 * Renders a progress section
 */
export function ProgressSection({ section, ctx }: ProgressSectionProps) {
  const value = resolveDynamicValue(section.value, ctx);
  const label = resolveDynamicValue(section.label, ctx);
  const percent = typeof value === "number" ? Math.min(100, Math.max(0, value)) : 0;

  return (
    <div style={{ marginBottom: "0.75rem" }}>
      {label && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--uilint-text-muted)",
            marginBottom: "0.25rem",
          }}
        >
          {String(label)}
        </div>
      )}
      <div
        style={{
          height: "6px",
          backgroundColor: "var(--uilint-surface)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        {section.indeterminate ? (
          <div
            style={{
              height: "100%",
              width: "30%",
              backgroundColor: "var(--uilint-accent)",
              borderRadius: "3px",
              animation: "progress-indeterminate 1.5s infinite linear",
            }}
          />
        ) : (
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              backgroundColor: "var(--uilint-accent)",
              borderRadius: "3px",
              transition: "width 0.3s ease",
            }}
          />
        )}
      </div>
      {!section.indeterminate && typeof value === "number" && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--uilint-text-muted)",
            marginTop: "0.25rem",
            textAlign: "right",
          }}
        >
          {percent}%
        </div>
      )}
    </div>
  );
}
