/**
 * Header Section Renderer
 *
 * Renders a header with optional icon and subtitle.
 */

import React from "react";
import type { HeaderSection as HeaderSectionSchema } from "uilint-core";
import { resolveDynamicValue, type BindingContext } from "../binding-utils";
import { getIcon } from "../icon-map";
import { cn } from "../../../../lib/utils";

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

  return (
    <div
      className={cn(
        "flex items-start gap-2 mb-3",
        section.sticky && "sticky top-0 bg-surface py-2 z-10"
      )}
    >
      {IconComponent && (
        <span className="text-muted-foreground shrink-0 mt-0.5">
          <IconComponent size={16} />
        </span>
      )}
      <div>
        <h3 className="m-0 text-sm font-semibold text-text-primary">
          {String(text ?? "")}
        </h3>
        {subtitle && (
          <p className="mt-1 mb-0 text-xs text-muted-foreground">
            {String(subtitle)}
          </p>
        )}
      </div>
    </div>
  );
}
