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
    <div className="mb-3">
      {label && (
        <div className="text-xs text-muted-foreground mb-1">
          {String(label)}
        </div>
      )}
      <div className="h-1.5 bg-surface rounded-sm overflow-hidden">
        {section.indeterminate ? (
          <div
            className="h-full w-[30%] bg-accent rounded-sm"
            style={{ animation: "progress-indeterminate 1.5s infinite linear" }}
          />
        ) : (
          <div
            className="h-full bg-accent rounded-sm transition-[width] duration-300 ease-in-out"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
      {!section.indeterminate && typeof value === "number" && (
        <div className="text-xs text-muted-foreground mt-1 text-right">
          {percent}%
        </div>
      )}
    </div>
  );
}
