/**
 * Code Comparison Section Renderer
 *
 * Renders a side-by-side or stacked code comparison.
 */

import React from "react";
import type { CodeComparisonSection as CodeComparisonSectionSchema } from "uilint-core";
import type { BindingContext } from "../binding-utils";
import { CodeViewerSection } from "./CodeViewerSection";

interface CodeComparisonSectionProps {
  section: CodeComparisonSectionSchema;
  ctx: BindingContext;
  onAction: (type: string, payload: Record<string, unknown>) => void;
  onFetch?: (type: string, params: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Renders a code comparison section
 */
export function CodeComparisonSection({
  section,
  ctx,
  onAction,
  onFetch,
}: CodeComparisonSectionProps) {
  const isStackedMode = section.mode === "stacked";

  const containerStyle: React.CSSProperties = isStackedMode
    ? {
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        marginBottom: "0.75rem",
      }
    : {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1rem",
        marginBottom: "0.75rem",
      };

  // Convert source/target configs to CodeViewerSection props
  const sourceSection = {
    type: "code-viewer" as const,
    label: section.source.label,
    icon: section.source.icon,
    code: section.source.code,
    location: section.source.location,
    diffHighlighting: section.computeDiff,
    maxHeight: section.maxHeight,
  };

  const targetSection = {
    type: "code-viewer" as const,
    label: section.target.label,
    icon: section.target.icon,
    code: section.target.code,
    location: section.target.location,
    diffHighlighting: section.computeDiff,
    maxHeight: section.maxHeight,
  };

  return (
    <div style={containerStyle}>
      <CodeViewerSection
        section={sourceSection}
        ctx={ctx}
        onAction={onAction}
        onFetch={onFetch}
      />
      <CodeViewerSection
        section={targetSection}
        ctx={ctx}
        onAction={onAction}
        onFetch={onFetch}
      />
    </div>
  );
}
