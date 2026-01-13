"use client";

import React from "react";
import { TOKENS } from "./tokens";

/**
 * Shared UI components for toolbar
 */

export const PillContainer = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    glow?: string;
    style?: React.CSSProperties;
  }
>(({ children, glow, style }, ref) => (
  <div
    ref={ref}
    style={{
      display: "inline-flex",
      alignItems: "center",
      height: TOKENS.pillHeight,
      borderRadius: TOKENS.pillRadius,
      border: `1px solid ${TOKENS.border}`,
      backgroundColor: TOKENS.bgBase,
      backdropFilter: TOKENS.blur,
      WebkitBackdropFilter: TOKENS.blur,
      boxShadow: glow
        ? `${TOKENS.shadowMd}, ${TOKENS.shadowGlow(glow)}`
        : TOKENS.shadowMd,
      overflow: "hidden",
      transition: `box-shadow ${TOKENS.transitionBase}`,
      ...style,
    }}
  >
    {children}
  </div>
));
PillContainer.displayName = "PillContainer";

export function Divider() {
  return (
    <div
      style={{
        width: "1px",
        height: "20px",
        backgroundColor: TOKENS.border,
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
}
