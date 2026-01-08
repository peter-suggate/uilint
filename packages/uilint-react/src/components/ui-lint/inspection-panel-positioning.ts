export type RectLike = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type Size = { width: number; height: number };
export type Viewport = { width: number; height: number };

export type PopoverPosition = {
  top: number;
  left: number;
  placement: "right" | "left" | "bottom" | "top";
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function overflowScore(
  left: number,
  top: number,
  size: Size,
  viewport: Viewport,
  padding: number
): number {
  const right = left + size.width;
  const bottom = top + size.height;

  const oLeft = Math.max(0, padding - left);
  const oTop = Math.max(0, padding - top);
  const oRight = Math.max(0, right - (viewport.width - padding));
  const oBottom = Math.max(0, bottom - (viewport.height - padding));

  // Weight horizontal overflow a little more because it tends to be more noticeable.
  return oLeft * 2 + oRight * 2 + oTop + oBottom;
}

function intersectionArea(
  a: { left: number; top: number; right: number; bottom: number },
  b: RectLike
): number {
  const x1 = Math.max(a.left, b.left);
  const y1 = Math.max(a.top, b.top);
  const x2 = Math.min(a.right, b.right);
  const y2 = Math.min(a.bottom, b.bottom);
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  return w * h;
}

/**
 * Compute a robust popover position anchored to the element's badge area.
 *
 * Strategy:
 * - Treat the badge anchor as (rect.right, rect.top)
 * - Evaluate 4 placements (right/left/bottom/top)
 * - Clamp each candidate into the viewport (with padding)
 * - Pick the candidate with the lowest overflow; tie-break by closeness to badge
 *
 * Note: The popover is constrained to the browser viewport, NOT to modal boundaries.
 * If an element is inside a modal, the popover can extend beyond the modal's edges
 * as long as it stays within the viewport.
 */
export function computeInspectionPanelPosition(params: {
  rect: RectLike;
  popover: Size;
  viewport: Viewport;
  padding?: number;
}): PopoverPosition {
  const { rect, popover, viewport } = params;
  const padding = params.padding ?? 12;

  const badge = { x: rect.right, y: rect.top };

  const xMax = viewport.width - popover.width - padding;
  const yMax = viewport.height - popover.height - padding;

  const rawCandidates: Array<PopoverPosition> = [
    {
      placement: "right",
      left: rect.right + padding,
      top: rect.top,
    },
    {
      // keep close to the badge by aligning the right edge to rect.right
      placement: "left",
      left: rect.right - popover.width - padding,
      top: rect.top,
    },
    {
      placement: "bottom",
      left: rect.right - popover.width,
      top: rect.bottom + padding,
    },
    {
      placement: "top",
      left: rect.right - popover.width,
      top: rect.top - popover.height - padding,
    },
  ];

  const candidates = rawCandidates.map((c) => ({
    raw: c,
    clamped: {
      ...c,
      left: clamp(c.left, padding, xMax),
      top: clamp(c.top, padding, yMax),
    },
  }));

  const distanceToBadge = (pos: PopoverPosition): number => {
    // Choose the nearest point on the popover box to the badge point (distance to rect).
    const nearestX = clamp(badge.x, pos.left, pos.left + popover.width);
    const nearestY = clamp(badge.y, pos.top, pos.top + popover.height);
    const dx = badge.x - nearestX;
    const dy = badge.y - nearestY;
    return dx * dx + dy * dy;
  };

  const score = (raw: PopoverPosition, pos: PopoverPosition) => {
    const overflow = overflowScore(
      pos.left,
      pos.top,
      popover,
      viewport,
      padding
    );
    const clampDelta =
      Math.abs(raw.left - pos.left) + Math.abs(raw.top - pos.top);
    const box = {
      left: pos.left,
      top: pos.top,
      right: pos.left + popover.width,
      bottom: pos.top + popover.height,
    };
    const overlap = intersectionArea(box, rect);
    const dist = distanceToBadge(pos);

    // Overflow dominates, then prefer minimal clamping (means "fits"), then avoid covering the element,
    // then stay visually close to the badge.
    return overflow * 1000000 + clampDelta * 1000 + overlap * 10 + dist;
  };

  let best = candidates[0]!.clamped;
  let bestScore = score(candidates[0]!.raw, candidates[0]!.clamped);

  for (const c of candidates.slice(1)) {
    const s = score(c.raw, c.clamped);
    if (s < bestScore) {
      best = c.clamped;
      bestScore = s;
    }
  }

  return best;
}
