/**
 * Schema Panel Renderer
 *
 * Renders a PanelDefinition from uilint-core as React components.
 * This is the main entry point for declarative panel rendering.
 */

import React from "react";
import type { PanelDefinition, PanelSection } from "uilint-core";
import {
  resolveDynamicValue,
  evaluateCondition,
  type BindingContext,
} from "./binding-utils";
import { getIcon } from "./icon-map";
import {
  HeaderSection,
  CodeViewerSection,
  CodeComparisonSection,
  BadgeSection,
  TextSection,
  ActionsSection,
  DividerSection,
  ConditionalSection,
  ListSection,
  ImageSection,
  CardSection,
  ProgressSection,
} from "./sections";

export interface SchemaPanelProps {
  /** Panel definition from plugin */
  panel: PanelDefinition;
  /** Data passed to the panel (e.g., from inspector) */
  data: Record<string, unknown>;
  /** Plugin state */
  state: Record<string, unknown>;
  /** Computed values from plugin state definition */
  computed?: Record<string, unknown>;
  /** Handler for action execution */
  onAction: (type: string, payload: Record<string, unknown>) => void;
  /** Handler for data fetching (e.g., source code) */
  onFetch?: (type: string, params: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Renders a panel definition as React components
 */
export function SchemaPanel({
  panel,
  data,
  state,
  computed = {},
  onAction,
  onFetch,
}: SchemaPanelProps) {
  // Create binding context
  const ctx: BindingContext = {
    data,
    state,
    computed,
  };

  // Check loading state
  if (panel.loading) {
    const isLoading = evaluateCondition(panel.loading.when, ctx);
    if (isLoading) {
      return (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--uilint-text-muted)",
          }}
        >
          <div
            style={{
              marginBottom: "0.5rem",
              animation: "spin 1s linear infinite",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="31.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div style={{ fontSize: "0.875rem" }}>
            {panel.loading.message || "Loading..."}
          </div>
          {panel.loading.submessage && (
            <div style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
              {panel.loading.submessage}
            </div>
          )}
        </div>
      );
    }
  }

  // Check empty state
  if (panel.empty) {
    const isEmpty = evaluateCondition(panel.empty.when, ctx);
    if (isEmpty) {
      const IconComponent = panel.empty.icon ? getIcon(panel.empty.icon) : null;
      return (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--uilint-text-muted)",
          }}
        >
          {IconComponent && (
            <div style={{ marginBottom: "0.5rem" }}>
              <IconComponent size={32} strokeWidth={1.5} />
            </div>
          )}
          <div style={{ fontSize: "0.875rem" }}>{panel.empty.message}</div>
          {panel.empty.submessage && (
            <div style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
              {panel.empty.submessage}
            </div>
          )}
        </div>
      );
    }
  }

  // Render section based on type
  const renderSection = (
    section: PanelSection,
    index: number,
    overrideCtx?: BindingContext
  ): React.ReactNode => {
    const sectionCtx = overrideCtx || ctx;
    const key = `section-${index}`;

    switch (section.type) {
      case "header":
        return <HeaderSection key={key} section={section} ctx={sectionCtx} />;

      case "code-viewer":
        return (
          <CodeViewerSection
            key={key}
            section={section}
            ctx={sectionCtx}
            onAction={onAction}
            onFetch={onFetch}
          />
        );

      case "code-comparison":
        return (
          <CodeComparisonSection
            key={key}
            section={section}
            ctx={sectionCtx}
            onAction={onAction}
            onFetch={onFetch}
          />
        );

      case "badge":
        return <BadgeSection key={key} section={section} ctx={sectionCtx} />;

      case "text":
        return <TextSection key={key} section={section} ctx={sectionCtx} />;

      case "actions":
        return (
          <ActionsSection
            key={key}
            section={section}
            ctx={sectionCtx}
            onAction={onAction}
          />
        );

      case "divider":
        return <DividerSection key={key} section={section} />;

      case "conditional":
        return (
          <ConditionalSection
            key={key}
            section={section}
            ctx={sectionCtx}
            renderSection={renderSection}
          />
        );

      case "list":
        return (
          <ListSection
            key={key}
            section={section}
            ctx={sectionCtx}
            renderSection={renderSection}
          />
        );

      case "image":
        return <ImageSection key={key} section={section} ctx={sectionCtx} />;

      case "card":
        return (
          <CardSection
            key={key}
            section={section}
            ctx={sectionCtx}
            onAction={onAction}
          />
        );

      case "progress":
        return <ProgressSection key={key} section={section} ctx={sectionCtx} />;

      default:
        console.warn(
          `[SchemaPanel] Unknown section type: ${(section as { type: string }).type}`
        );
        return null;
    }
  };

  // Resolve panel title
  const title = resolveDynamicValue(panel.title, ctx);

  return (
    <div style={{ padding: "1rem" }}>
      {title && (
        <h2
          style={{
            margin: "0 0 1rem 0",
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--uilint-text-primary)",
          }}
        >
          {String(title)}
        </h2>
      )}
      {panel.layout.map((section, index) => renderSection(section, index))}
    </div>
  );
}
