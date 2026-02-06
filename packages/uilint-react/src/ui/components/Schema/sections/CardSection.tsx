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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../card";
import { Badge } from "../../badge";

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

  const cardStyle: React.CSSProperties = {
    marginBottom: "0.5rem",
    ...(handleClick && { cursor: "pointer" }),
  };

  return (
    <Card
      style={cardStyle}
      onClick={handleClick}
      role={handleClick ? "button" : undefined}
      tabIndex={handleClick ? 0 : undefined}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        {typeof thumbnail === "string" && thumbnail && (
          <img
            src={thumbnail}
            alt=""
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "4px",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <CardHeader style={{ padding: "0.75rem 0.75rem 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <CardTitle style={{ fontSize: "0.875rem", marginBottom: 0 }}>
                {String(title ?? "")}
              </CardTitle>
              {section.badge && badgeValue !== undefined && (
                <Badge variant={section.badge.variant === "severity" ? "warning" : "info"}>
                  {section.badge.label ? `${section.badge.label}: ` : ""}{String(badgeValue)}
                </Badge>
              )}
            </div>
            {subtitle && (
              <CardDescription style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                {String(subtitle)}
              </CardDescription>
            )}
          </CardHeader>
        </div>
      </div>
    </Card>
  );
}
