/**
 * Card Section Renderer
 *
 * Renders a card display for list items.
 */

import React from "react";
import type { CardSection as CardSectionSchema } from "uilint-core";
import {
  resolveDynamicValue,
  resolveBinding,
  createActionPayload,
  type BindingContext,
} from "../binding-utils";
import { Card, CardHeader, CardTitle, CardDescription } from "../../card";
import { Badge } from "../../badge";
import { cn } from "../../../../lib/utils";

interface CardSectionProps {
  section: CardSectionSchema;
  ctx: BindingContext;
  onAction: (type: string, payload: Record<string, unknown>) => void;
}

/**
 * Renders a card section
 */
export function CardSection({ section, ctx, onAction }: CardSectionProps) {
  const title = resolveDynamicValue(section.title, ctx);
  const subtitle = resolveDynamicValue(section.subtitle, ctx);
  const thumbnail = section.thumbnail ? resolveBinding(section.thumbnail, ctx) : undefined;
  const badgeValue = section.badge
    ? resolveBinding(section.badge.value, ctx)
    : undefined;

  const handleClick = section.onClick
    ? () => {
        const payload = createActionPayload(
          section.onClick!.payload,
          section.onClick!.payloadBindings,
          ctx
        );
        onAction(section.onClick!.type, payload);
      }
    : undefined;

  return (
    <Card
      className={cn("mb-2", handleClick && "cursor-pointer")}
      onClick={handleClick}
      role={handleClick ? "button" : undefined}
      tabIndex={handleClick ? 0 : undefined}
    >
      <div className="flex items-start gap-3">
        {typeof thumbnail === "string" && thumbnail && (
          <img
            src={thumbnail}
            alt=""
            className="w-12 h-12 rounded object-cover shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <CardHeader className="px-3 pt-3 pb-0">
            <div className="flex justify-between items-start">
              <CardTitle className="text-sm mb-0">
                {String(title ?? "")}
              </CardTitle>
              {section.badge && badgeValue !== undefined && (
                <Badge variant={section.badge.variant === "severity" ? "warning" : "info"}>
                  {section.badge.label ? `${section.badge.label}: ` : ""}{String(badgeValue)}
                </Badge>
              )}
            </div>
            {subtitle && (
              <CardDescription className="text-xs mt-1">
                {String(subtitle)}
              </CardDescription>
            )}
          </CardHeader>
        </div>
      </div>
    </Card>
  );
}
