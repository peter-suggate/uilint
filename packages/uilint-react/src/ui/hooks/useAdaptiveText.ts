/**
 * useAdaptiveText - Hook for measuring text and calculating dynamic font scaling
 *
 * Provides utilities for ensuring text fits within available space while
 * remaining readable, particularly useful for tile components.
 */
import { useLayoutEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface AdaptiveTextConfig {
  /** Base font size in pixels */
  baseFontSize: number;
  /** Minimum font size in pixels (never scale below this) */
  minFontSize: number;
  /** Maximum width available for text in pixels */
  maxWidth: number;
  /** Font weight for accurate measurement */
  fontWeight?: string;
  /** Font family for accurate measurement */
  fontFamily?: string;
  /** Letter spacing (tracking) for accurate measurement */
  letterSpacing?: string;
}

export interface AdaptiveTextResult {
  /** Calculated font size in pixels */
  fontSize: number;
  /** Scale factor relative to base font size (0.0 - 1.0) */
  scale: number;
  /** Whether the text was scaled down */
  isScaled: boolean;
  /** Whether text will need truncation even at minimum size */
  needsTruncation: boolean;
}

// ============================================================================
// Text Measurement Utilities
// ============================================================================

// Canvas for measuring text (created lazily)
let measureCanvas: HTMLCanvasElement | null = null;

/**
 * Get or create the canvas context for text measurement
 */
function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;

  if (!measureCanvas) {
    measureCanvas = document.createElement("canvas");
  }
  return measureCanvas.getContext("2d");
}

/**
 * Measure text width using canvas API
 */
export function measureTextWidth(
  text: string,
  fontSize: number,
  fontWeight = "300",
  fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  letterSpacing = "-0.025em"
): number {
  const ctx = getMeasureContext();
  if (!ctx) {
    // Fallback: estimate width as average character width * length
    return text.length * fontSize * 0.5;
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  // Measure base width
  const metrics = ctx.measureText(text);
  let width = metrics.width;

  // Adjust for letter spacing
  if (letterSpacing) {
    const spacingMatch = letterSpacing.match(/(-?[\d.]+)(em|px)/);
    if (spacingMatch) {
      const value = parseFloat(spacingMatch[1]);
      const unit = spacingMatch[2];
      const spacingPx = unit === "em" ? value * fontSize : value;
      // Letter spacing applies between characters (n-1 spaces for n characters)
      width += spacingPx * Math.max(0, text.length - 1);
    }
  }

  return width;
}

/**
 * Calculate the optimal font size for text to fit within a given width
 */
export function calculateAdaptiveFontSize(
  text: string,
  config: AdaptiveTextConfig
): AdaptiveTextResult {
  const {
    baseFontSize,
    minFontSize,
    maxWidth,
    fontWeight = "300",
    fontFamily,
    letterSpacing = "-0.025em",
  } = config;

  // Measure at base font size
  const baseWidth = measureTextWidth(text, baseFontSize, fontWeight, fontFamily, letterSpacing);

  // If it fits at base size, no scaling needed
  if (baseWidth <= maxWidth) {
    return {
      fontSize: baseFontSize,
      scale: 1,
      isScaled: false,
      needsTruncation: false,
    };
  }

  // Calculate required scale factor
  const requiredScale = maxWidth / baseWidth;
  const scaledFontSize = baseFontSize * requiredScale;

  // Clamp to minimum font size
  if (scaledFontSize >= minFontSize) {
    return {
      fontSize: Math.round(scaledFontSize * 10) / 10, // Round to 1 decimal
      scale: requiredScale,
      isScaled: true,
      needsTruncation: false,
    };
  }

  // At minimum size, check if truncation is needed
  const minWidth = measureTextWidth(text, minFontSize, fontWeight, fontFamily, letterSpacing);

  return {
    fontSize: minFontSize,
    scale: minFontSize / baseFontSize,
    isScaled: true,
    needsTruncation: minWidth > maxWidth,
  };
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Hook for adaptive text sizing within a container
 *
 * @param text - The text to measure
 * @param config - Configuration for adaptive sizing
 * @returns Adaptive text result with calculated font size
 *
 * @example
 * ```tsx
 * const { fontSize, isScaled } = useAdaptiveText(label, {
 *   baseFontSize: 15,
 *   minFontSize: 11,
 *   maxWidth: containerWidth - padding * 2,
 * });
 *
 * return <span style={{ fontSize: `${fontSize}px` }}>{label}</span>;
 * ```
 */
export function useAdaptiveText(
  text: string,
  config: AdaptiveTextConfig
): AdaptiveTextResult {
  const [result, setResult] = useState<AdaptiveTextResult>(() =>
    calculateAdaptiveFontSize(text, config)
  );

  // Track previous values to avoid unnecessary recalculations
  const prevRef = useRef({ text, config });

  useLayoutEffect(() => {
    const prev = prevRef.current;
    const configChanged =
      prev.config.baseFontSize !== config.baseFontSize ||
      prev.config.minFontSize !== config.minFontSize ||
      prev.config.maxWidth !== config.maxWidth;

    if (prev.text !== text || configChanged) {
      prevRef.current = { text, config };
      setResult(calculateAdaptiveFontSize(text, config));
    }
  }, [text, config]);

  return result;
}

/**
 * Hook for adaptive text with a ref-based container measurement
 *
 * Automatically measures the container width and calculates font scaling.
 *
 * @param text - The text to measure
 * @param baseFontSize - Base font size in pixels
 * @param minFontSize - Minimum font size in pixels
 * @param padding - Horizontal padding to subtract from container width
 * @returns Object with ref to attach to container and adaptive text result
 *
 * @example
 * ```tsx
 * const { containerRef, fontSize, isScaled } = useAdaptiveTextWithRef(
 *   label,
 *   15,
 *   11,
 *   32 // 16px padding on each side
 * );
 *
 * return (
 *   <div ref={containerRef}>
 *     <span style={{ fontSize: `${fontSize}px` }}>{label}</span>
 *   </div>
 * );
 * ```
 */
export function useAdaptiveTextWithRef(
  text: string,
  baseFontSize: number,
  minFontSize: number,
  padding = 0
): AdaptiveTextResult & { containerRef: React.RefObject<HTMLDivElement | null> } {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(200); // Reasonable default

  useLayoutEffect(() => {
    if (containerRef.current) {
      const width = containerRef.current.offsetWidth;
      if (width > 0) {
        setContainerWidth(width);
      }
    }
  }, []);

  // Also observe resize
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setContainerWidth(width);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const result = useAdaptiveText(text, {
    baseFontSize,
    minFontSize,
    maxWidth: Math.max(0, containerWidth - padding),
  });

  return { ...result, containerRef };
}

// ============================================================================
// Tile-Specific Helpers
// ============================================================================

/**
 * Font size configurations for each tile bucket
 */
export const TILE_FONT_CONFIG = {
  xs: { base: 15, min: 11, weight: "300" },
  sm: { base: 17, min: 12, weight: "300" },
  md: { base: 20, min: 14, weight: "300" },
  lg: { base: 24, min: 16, weight: "300" },
  xl: { base: 28, min: 18, weight: "300" },
} as const;

/**
 * Padding values for each tile bucket (horizontal padding per side)
 */
export const TILE_PADDING = {
  xs: 16,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 24,
} as const;

export type TileBucketSize = keyof typeof TILE_FONT_CONFIG;

/**
 * Hook specifically designed for tile label text
 *
 * @param label - The tile label text
 * @param bucket - Tile size bucket
 * @param tileWidth - Width of the tile in pixels
 * @returns Adaptive text result optimized for tile rendering
 */
export function useTileAdaptiveText(
  label: string,
  bucket: TileBucketSize,
  tileWidth: number
): AdaptiveTextResult {
  const fontConfig = TILE_FONT_CONFIG[bucket];
  const padding = TILE_PADDING[bucket];

  // Account for icon space (~24px) and open-in-inspector button space (~28px)
  const iconSpace = 24 + 8; // icon + gap
  const buttonSpace = 28; // approximate button width
  const availableWidth = Math.max(0, tileWidth - padding * 2 - iconSpace - buttonSpace);

  return useAdaptiveText(label, {
    baseFontSize: fontConfig.base,
    minFontSize: fontConfig.min,
    maxWidth: availableWidth,
    fontWeight: fontConfig.weight,
    letterSpacing: "-0.025em",
  });
}
