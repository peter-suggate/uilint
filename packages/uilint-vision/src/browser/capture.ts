/**
 * Screenshot Capture
 *
 * Captures screenshots using html-to-image.
 * Browser-only - no React.
 */

import type { CaptureRegion } from "../types.js";

// Lazy import html-to-image to avoid issues in Node.js
let toCanvas: typeof import("html-to-image").toCanvas | null = null;

async function getToCanvas() {
  if (!toCanvas) {
    const htmlToImage = await import("html-to-image");
    toCanvas = htmlToImage.toCanvas;
  }
  return toCanvas;
}

/**
 * Capture full page screenshot
 *
 * @returns Base64 data URL of the screenshot
 */
export async function captureScreenshot(): Promise<string> {
  const toCanvasFn = await getToCanvas();

  const canvas = await toCanvasFn(document.body, {
    backgroundColor: "#ffffff",
    pixelRatio: window.devicePixelRatio || 1,
    skipFonts: true,
    filter: (node) => {
      // Skip the UILint overlay itself
      if (node instanceof HTMLElement) {
        if (node.id === "uilint-root" || node.id === "uilint-overlay") {
          return false;
        }
        // Skip shadow DOM hosts that might be our overlay
        if (node.tagName === "UILINT-OVERLAY") {
          return false;
        }
      }
      return true;
    },
  });

  return canvas.toDataURL("image/png");
}

/**
 * Capture a specific region of the page
 *
 * @param region - Region bounds to capture
 * @returns Base64 data URL of the screenshot
 */
export async function captureRegion(region: CaptureRegion): Promise<string> {
  const toCanvasFn = await getToCanvas();

  const canvas = await toCanvasFn(document.body, {
    backgroundColor: "#ffffff",
    pixelRatio: window.devicePixelRatio || 1,
    skipFonts: true,
    filter: (node) => {
      if (node instanceof HTMLElement) {
        if (node.id === "uilint-root" || node.id === "uilint-overlay") {
          return false;
        }
        if (node.tagName === "UILINT-OVERLAY") {
          return false;
        }
      }
      return true;
    },
  });

  // Create a new canvas for the cropped region
  const croppedCanvas = document.createElement("canvas");
  const pixelRatio = window.devicePixelRatio || 1;

  croppedCanvas.width = region.width * pixelRatio;
  croppedCanvas.height = region.height * pixelRatio;

  const ctx = croppedCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Draw the cropped region
  ctx.drawImage(
    canvas,
    region.x * pixelRatio,
    region.y * pixelRatio,
    region.width * pixelRatio,
    region.height * pixelRatio,
    0,
    0,
    region.width * pixelRatio,
    region.height * pixelRatio
  );

  return croppedCanvas.toDataURL("image/png");
}
