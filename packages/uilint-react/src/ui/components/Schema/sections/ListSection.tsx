/**
 * List Section Renderer
 *
 * Renders an array of items using a template layout.
 */

import React from "react";
import type { ListSection as ListSectionSchema, PanelSection } from "uilint-core";
import { resolveBinding, type BindingContext } from "../binding-utils";

interface ListSectionProps {
  section: ListSectionSchema;
  ctx: BindingContext;
  renderSection: (section: PanelSection, index: number, itemCtx?: BindingContext) => React.ReactNode;
}

/**
 * Renders a list section
 */
export function ListSection({ section, ctx, renderSection }: ListSectionProps) {
  const items = resolveBinding(section.items, ctx);

  if (!Array.isArray(items) || items.length === 0) {
    if (section.emptyMessage) {
      return (
        <div
          style={{
            padding: "1rem",
            textAlign: "center",
            color: "var(--uilint-text-muted)",
            fontSize: "0.875rem",
          }}
        >
          {section.emptyMessage}
        </div>
      );
    }
    return null;
  }

  return (
    <div style={{ marginBottom: "0.75rem" }}>
      {items.map((item, itemIndex) => {
        // Create an item context with "item" prefix
        const itemCtx: BindingContext = {
          ...ctx,
          data: {
            ...ctx.data,
            item,
            itemIndex,
          },
        };

        return (
          <div key={itemIndex} style={{ marginBottom: "0.5rem" }}>
            {section.itemLayout.map((childSection, layoutIndex) =>
              renderSection(childSection, layoutIndex, itemCtx)
            )}
          </div>
        );
      })}
    </div>
  );
}
