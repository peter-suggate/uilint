/**
 * Actions Section Renderer
 *
 * Renders a group of action buttons.
 */

import React from "react";
import type { ActionsSection as ActionsSectionSchema, ActionButton } from "uilint-core";
import {
  resolveValue,
  resolveBinding,
  evaluateCondition,
  createActionPayload,
  isConditionalValue,
  type BindingContext,
} from "../binding-utils";
import { getIcon } from "../icon-map";
import { Button } from "../../button";

interface ActionsSectionProps {
  section: ActionsSectionSchema;
  ctx: BindingContext;
  onAction: (type: string, payload: Record<string, unknown>) => void;
}

/**
 * Maps button variant to Button component variant
 */
function mapVariant(variant?: string): "default" | "outline" | "ghost" | "destructive" {
  switch (variant) {
    case "primary":
      return "default";
    case "secondary":
      return "outline";
    case "ghost":
      return "ghost";
    case "danger":
      return "destructive";
    default:
      return "default";
  }
}

/**
 * Renders a single action button
 */
function ActionButtonRenderer({
  button,
  ctx,
  onAction,
}: {
  button: ActionButton;
  ctx: BindingContext;
  onAction: (type: string, payload: Record<string, unknown>) => void;
}) {
  // Check visibility
  if (button.visible) {
    const isVisible = Boolean(resolveBinding(button.visible, ctx));
    if (!isVisible) return null;
  }

  // Check disabled state
  const isDisabled = button.disabled
    ? Boolean(resolveBinding(button.disabled, ctx))
    : false;

  // Resolve label
  let label: string;
  if (isConditionalValue(button.label)) {
    label = String(resolveValue(button.label, ctx) ?? "");
  } else {
    label = String(resolveValue(button.label, ctx) ?? "");
  }

  // Get icon
  const IconComponent = button.icon ? getIcon(button.icon) : null;

  // Handle click
  const handleClick = () => {
    const payload = createActionPayload(
      button.action.payload,
      button.action.payloadBindings,
      ctx
    );
    onAction(button.action.type, payload);
  };

  return (
    <Button
      variant={mapVariant(button.variant)}
      size="sm"
      disabled={isDisabled}
      onClick={handleClick}
    >
      {IconComponent && <IconComponent size={14} style={{ marginRight: "0.25rem" }} />}
      {label}
    </Button>
  );
}

/**
 * Renders an actions section
 */
export function ActionsSection({ section, ctx, onAction }: ActionsSectionProps) {
  const isRow = section.direction !== "column";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isRow ? "row" : "column",
        gap: "0.5rem",
        marginBottom: "0.75rem",
        ...(isRow && { flexWrap: "wrap" }),
      }}
    >
      {section.actions.map((button) => (
        <ActionButtonRenderer
          key={button.id}
          button={button}
          ctx={ctx}
          onAction={onAction}
        />
      ))}
    </div>
  );
}
