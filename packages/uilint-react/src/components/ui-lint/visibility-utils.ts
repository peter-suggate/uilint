/**
 * Visibility utilities for detecting when elements are covered by overlays
 *
 * Used to hide UILint badges when app modals/overlays cover the underlying elements.
 */

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

    // Skip if it's the target element or a descendant of the target
    // (the badge is positioned relative to the target, so the target should be visible)
    if (el === element || element.contains(el)) continue;

    // IMPORTANT: If the element is a child/descendant of this overlay,
    // then the overlay is its container, not a cover. Don't hide badges in this case.
    if (el.contains(element)) continue;

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
