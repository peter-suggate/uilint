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
      className="relative mb-3 overflow-hidden"
      style={{ maxHeight: section.maxHeight }}
    >
      <img
        src={src}
        alt={section.alt || "Image"}
        className="w-full h-auto object-contain rounded border border-border"
        style={{ maxHeight: section.maxHeight }}
      />
      {highlightRegion && (
        <div
          className="absolute border-2 border-accent rounded bg-accent/10 pointer-events-none"
          style={{
            left: `${highlightRegion.x}px`,
            top: `${highlightRegion.y}px`,
            width: `${highlightRegion.width}px`,
            height: `${highlightRegion.height}px`,
          }}
        />
      )}
    </div>
  );
}
