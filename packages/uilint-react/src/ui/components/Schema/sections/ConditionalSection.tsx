/**
 * Conditional Section Renderer
 *
 * Renders sections conditionally based on a binding or expression.
 */

import React from "react";
import type { ConditionalSection as ConditionalSectionSchema, PanelSection } from "uilint-core";
import { evaluateCondition, type BindingContext } from "../binding-utils";

interface ConditionalSectionProps {
  section: ConditionalSectionSchema;
  ctx: BindingContext;
  renderSection: (section: PanelSection, index: number) => React.ReactNode;
}

/**
 * Renders a conditional section
 */
export function ConditionalSection({
  section,
  ctx,
  renderSection,
}: ConditionalSectionProps) {
  const conditionMet = evaluateCondition(section.condition, ctx);

  const sectionsToRender = conditionMet ? section.then : section.else;

  if (!sectionsToRender || sectionsToRender.length === 0) {
    return null;
  }

  return (
    <>
      {sectionsToRender.map((childSection, index) => (
        <React.Fragment key={index}>
          {renderSection(childSection, index)}
        </React.Fragment>
      ))}
    </>
  );
}
