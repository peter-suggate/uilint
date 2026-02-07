/**
 * Image Section Renderer
 *
 * Renders an image with optional highlight region.
 */

import React from "react";
import type { ImageSection as ImageSectionSchema } from "uilint-core";
import { resolveBinding, type BindingContext } from "../binding-utils";

interface ImageSectionProps {
  section: ImageSectionSchema;
  ctx: BindingContext;
}

interface HighlightRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Renders an image section
 */
export function ImageSection({ section, ctx }: ImageSectionProps) {
  const src = resolveBinding(section.src, ctx);
  const highlightRegion = section.highlightRegion
    ? (resolveBinding(section.highlightRegion, ctx) as HighlightRegion | undefined)
    : undefined;

  if (!src || typeof src !== "string") {
    return null;
  }

  return (
    <div
      style={{
        position: "relative",
        marginBottom: "0.75rem",
        maxHeight: section.maxHeight,
        overflow: "hidden",
      }}
    >
      <img
        src={src}
        alt={section.alt || "Image"}
        style={{
          width: "100%",
          height: "auto",
          maxHeight: section.maxHeight,
          objectFit: "contain",
          borderRadius: "4px",
          border: "1px solid var(--uilint-border)",
        }}
      />
      {highlightRegion && (
        <div
          style={{
            position: "absolute",
            left: `${highlightRegion.x}px`,
            top: `${highlightRegion.y}px`,
            width: `${highlightRegion.width}px`,
            height: `${highlightRegion.height}px`,
            border: "2px solid var(--uilint-accent)",
            borderRadius: "4px",
            backgroundColor: "rgba(var(--uilint-accent-rgb), 0.1)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
