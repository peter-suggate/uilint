/**
 * Visibility utilities for detecting when elements are covered by overlays
 *
 * Used to hide UILint badges when app modals/overlays cover the underlying elements.
 */

type Rect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

function rectFromLTRB(
  left: number,
  top: number,
  right: number,
  bottom: number
): Rect {
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return { left, top, right, bottom, width, height };
}

function intersectRects(a: Rect, b: Rect): Rect | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  if (right <= left || bottom <= top) return null;
  return rectFromLTRB(left, top, right, bottom);
}

function isOverflowClipping(style: CSSStyleDeclaration): boolean {
  const vals = [style.overflow, style.overflowX, style.overflowY];
  // "visible" means no clipping, everything else can clip to some extent.
  return vals.some((v) => v && v !== "visible");
}

/**
 * Compute the visible portion of an element in viewport coordinates.
 *
 * This accounts for:
 * - viewport bounds
 * - ancestor overflow clipping (scroll/hidden/auto/clip)
 *
 * Returns null when no visible area remains.
 */
export function getElementVisibleRect(element: Element): Rect | null {
  const el = element as HTMLElement;
  const base = el.getBoundingClientRect();
  let visible: Rect | null = rectFromLTRB(
    base.left,
    base.top,
    base.right,
    base.bottom
  );

  // Intersect with viewport
  const viewport = rectFromLTRB(0, 0, window.innerWidth, window.innerHeight);
  visible = intersectRects(visible, viewport);
  if (!visible) return null;

  // Intersect with overflow clipping ancestors
  let cur: HTMLElement | null = el.parentElement;
  while (cur) {
    const style = window.getComputedStyle(cur);
    if (isOverflowClipping(style)) {
      const r = cur.getBoundingClientRect();
      const clip = rectFromLTRB(r.left, r.top, r.right, r.bottom);
      visible = intersectRects(visible, clip);
      if (!visible) return null;
    }
    cur = cur.parentElement;
  }

  return visible;
}

/**
 * Check if an element is covered by an overlay (modal, popover, etc.)
 * at a specific point (typically the badge position).
 *
 * Uses elementsFromPoint() to detect all elements at the given coordinates
 * and checks if any non-UILint overlay element is covering the target.
 *
 * IMPORTANT: Elements that are children/descendants of an overlay are NOT considered
 * "covered" - they should show badges since the overlay is their container, not a cover.
 *
 * @param element - The target element that should be checked for coverage
 * @param badgeX - X coordinate of the badge position (in viewport coordinates)
 * @param badgeY - Y coordinate of the badge position (in viewport coordinates)
 * @returns true if the element is covered by an overlay, false otherwise
 */
export function isElementCoveredByOverlay(
  element: Element,
  badgeX: number,
  badgeY: number
): boolean {
  // Get all elements at this point, ordered from front to back
  const elementsAtPoint = document.elementsFromPoint(badgeX, badgeY);

  for (const el of elementsAtPoint) {
    // Skip UILint elements - they shouldn't hide badges
    if (el.hasAttribute("data-ui-lint")) continue;

    // If we hit the element itself, a descendant, or an ancestor container,
    // then anything further "behind" in the stack cannot be covering it.
    //
    // This is critical for modal dialogs: the backdrop is often behind the dialog,
    // but still shows up in elementsFromPoint(). We must stop before we reach it.
    if (el === element || element.contains(el) || el.contains(element)) {
      return false;
    }

    // Check if this element is an overlay
    // Overlays typically have fixed/absolute positioning with a z-index
    const style = window.getComputedStyle(el);
    const position = style.position;
    const zIndex = parseInt(style.zIndex, 10);

    // Consider it an overlay if:
    // 1. It's positioned (fixed or absolute) - these are commonly used for overlays
    // 2. It has a positive z-index (or auto/inherit which might still stack)
    // 3. It's not static positioned (which wouldn't create a stacking context)
    const isOverlay =
      (position === "fixed" || position === "absolute") &&
      (zIndex > 0 || style.zIndex === "auto" || style.zIndex === "inherit");

    if (isOverlay) {
      return true;
    }
  }

  return false;
}
