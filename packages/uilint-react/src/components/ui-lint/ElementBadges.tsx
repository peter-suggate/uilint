"use client";

/**
 * ElementBadges - Shows issue count badges on scanned elements
 *
 * Renders notification-style badges at the top-right corner of each
 * scanned element during auto-scan mode.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useUILintStore, type UILintStore } from "./store";
import type { ScannedElement, ElementIssue, InspectedElement } from "./types";
import { getUILintPortalHost } from "./portal-host";
import {
  BadgeLayoutBuilder,
  findNearbyBadges,
  type BadgePosition,
  type NudgedBadgePosition,
} from "./badge-layout";
import {
  getElementVisibleRect,
  isElementCoveredByOverlay,
} from "./visibility-utils";

/**
 * Design tokens - uses CSS variables for theme support
 */
const STYLES = {
  bg: "var(--uilint-backdrop)",
  success: "var(--uilint-success)",
  warning: "var(--uilint-warning)",
  error: "var(--uilint-error)",
  text: "var(--uilint-text-primary)",
  border: "var(--uilint-border)",
  highlight: "var(--uilint-accent)",
  font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  shadow: "var(--uilint-shadow)",
};

/**
 * Proximity scaling constants
 * Badges scale from MIN_SCALE at FAR_DISTANCE to MAX_SCALE at NEAR_DISTANCE
 */
const NEAR_DISTANCE = 0;
const FAR_DISTANCE = 150;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.0;

/**
 * Calculate scale factor based on distance from cursor
 */
function getScaleFromDistance(distance: number): number {
  if (distance <= NEAR_DISTANCE) return MAX_SCALE;
  if (distance >= FAR_DISTANCE) return MIN_SCALE;
  // Linear interpolation
  const t = (distance - NEAR_DISTANCE) / (FAR_DISTANCE - NEAR_DISTANCE);
  return MAX_SCALE - t * (MAX_SCALE - MIN_SCALE);
}

/**
 * Get badge color based on issue count
 */
function getBadgeColor(issueCount: number): string {
  if (issueCount === 0) return STYLES.success;
  return STYLES.warning; // Amber for all issues
}

/**
 * Format element label as "tag > Filename.tsx"
 */
function formatElementLabel(element: ScannedElement): string {
  const tag = element.tagName.toLowerCase();
  const source = element.source;

  if (source) {
    const fileName = source.fileName.split("/").pop() || "Unknown";
    return `${tag} > ${fileName}`;
  }

  return tag;
}

/**
 * Threshold for detecting nearby badges (for dropdown grouping)
 */
const NEARBY_THRESHOLD = 30;

/**
 * Minimum distance from window edge before snapping badge to be fully visible
 */
const WINDOW_EDGE_THRESHOLD = 20;

/**
 * Badge size for collision detection with window bounds
 */
const BADGE_SIZE = 18;

/**
 * Snap badge position to be fully visible within window bounds
 */
function snapToWindowBounds(x: number, y: number): { x: number; y: number } {
  const minX = WINDOW_EDGE_THRESHOLD;
  const maxX = window.innerWidth - BADGE_SIZE - WINDOW_EDGE_THRESHOLD;
  const minY = WINDOW_EDGE_THRESHOLD;
  const maxY = window.innerHeight - BADGE_SIZE - WINDOW_EDGE_THRESHOLD;

  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

/**
 * Determine if a badge should be shown based on its status and alt key state
 * - Green badges (no issues): never show (optimization: skip rendering entirely)
 * - Progress badges (scanning/pending): only show when alt/option is held
 * - Issue badges (error or issues > 0): always show
 */
function shouldShowBadge(
  issue: ElementIssue,
  isAltKeyPressed: boolean
): boolean {
  // Never show green badges (no issues) - optimization to skip rendering
  if (issue.status === "complete" && issue.issues.length === 0) {
    return false;
  }

  // Always show badges with issues
  if (issue.status === "error") return true;
  if (issue.status === "complete" && issue.issues.length > 0) return true;

  // Only show progress badges (scanning/pending) when alt/option is held
  if (issue.status === "scanning" || issue.status === "pending") {
    return isAltKeyPressed;
  }

  return false;
}

/**
 * Global CSS for badge animations (injected once)
 */
function BadgeAnimationStyles() {
  return (
    <style>{`
      @keyframes uilint-badge-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}</style>
  );
}

/**
 * Main ElementBadges component
 */
export function ElementBadges() {
  const autoScanState = useUILintStore((s: UILintStore) => s.autoScanState);
  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );
  const setInspectedElement = useUILintStore(
    (s: UILintStore) => s.setInspectedElement
  );
  const [mounted, setMounted] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [badgePositions, setBadgePositions] = useState<BadgePosition[]>([]);
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false);

  // Get file filtering state from store
  const hoveredFilePath = useUILintStore((s: UILintStore) => s.hoveredFilePath);
  const selectedFilePath = useUILintStore(
    (s: UILintStore) => s.selectedFilePath
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track alt/option key state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        setIsAltKeyPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) {
        setIsAltKeyPressed(false);
      }
    };
    const handleBlur = () => {
      // Reset alt key state when window loses focus
      setIsAltKeyPressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Track cursor position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Calculate badge positions
  useEffect(() => {
    if (autoScanState.status === "idle") {
      setBadgePositions([]);
      return;
    }

    const updatePositions = () => {
      const positions: BadgePosition[] = [];
      for (const element of autoScanState.elements) {
        const issue = elementIssuesCache.get(element.id);
        if (!issue) continue;
        if (!element.element || !document.contains(element.element)) continue;

        const rect = element.element.getBoundingClientRect();
        const visible = getElementVisibleRect(element.element);
        if (!visible) continue;

        // Badge is positioned near the top-right corner, but clamped to stay
        // within the visible (non-clipped) portion of the element.
        const desiredX = rect.right - 8;
        const desiredY = rect.top - 8;
        const x = Math.min(desiredX, visible.right - 8);
        const y = Math.max(visible.top + 2, desiredY);

        // Check if element is covered by an overlay (modal, popover, etc.)
        // Use a point INSIDE the visible portion of the element to avoid
        // false positives from backdrops behind modal containers.
        const testX = visible.left + Math.min(8, visible.width / 2);
        const testY = visible.top + Math.min(8, visible.height / 2);
        if (isElementCoveredByOverlay(element.element, testX, testY)) {
          continue;
        }

        // Use the visible rect for drawing/hover highlight so it matches what the
        // user can actually see when the element is clipped by overflow containers.
        const visibleRect = DOMRect.fromRect({
          x: visible.left,
          y: visible.top,
          width: visible.width,
          height: visible.height,
        });

        positions.push({ element, issue, x, y, rect: visibleRect });
      }
      setBadgePositions(positions);
    };

    let rafId: number | null = null;
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updatePositions();
      });
    };

    // Initial position calculation
    scheduleUpdate();

    // Recalculate on common viewport changes rather than every frame
    const handleScroll = () => scheduleUpdate();
    const handleResize = () => scheduleUpdate();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        scheduleUpdate();
      }
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [autoScanState.status, autoScanState.elements, elementIssuesCache]);

  // Handle badge selection
  const handleSelect = useCallback(
    (element: ScannedElement, issue: ElementIssue) => {
      const inspected: InspectedElement = {
        element: element.element,
        source: element.source,
        rect: element.element.getBoundingClientRect(),
        scannedElementId: element.id,
      };
      setInspectedElement(inspected);
    },
    [setInspectedElement]
  );

  // Apply force-directed nudging to separate overlapping badges
  const nudgedPositions = useMemo(
    () =>
      BadgeLayoutBuilder.create(badgePositions)
        .minDistance(24)
        .repulsion(50)
        .anchorStrength(0.3)
        .iterations(50)
        .compute(),
    [badgePositions]
  );

  // Filter badges based on visibility rules (must be before conditional returns)
  const visibleBadges = useMemo(() => {
    let filtered = nudgedPositions.filter((pos) =>
      shouldShowBadge(pos.issue, isAltKeyPressed)
    );

    // Filter by file if hovering or selecting a file
    const activeFilePath = selectedFilePath || hoveredFilePath;
    if (activeFilePath) {
      filtered = filtered.filter(
        (pos) => pos.element.source.fileName === activeFilePath
      );
    }

    return filtered;
  }, [nudgedPositions, isAltKeyPressed, selectedFilePath, hoveredFilePath]);

  // Event handlers to prevent UILint interactions from propagating to the app
  const handleUILintInteraction = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent | React.PointerEvent) => {
      e.stopPropagation();
    },
    []
  );

  if (!mounted) return null;
  if (autoScanState.status === "idle") return null;

  const content = (
    <div
      data-ui-lint
      onMouseDown={handleUILintInteraction}
      onPointerDown={handleUILintInteraction}
      onClick={handleUILintInteraction}
      onKeyDown={handleUILintInteraction}
      style={{ pointerEvents: "none" }}
    >
      <BadgeAnimationStyles />
      {visibleBadges
        // Defensive: in case upstream ever returns duplicate IDs, avoid
        // React duplicate-key warnings and layout duplication.
        .filter((pos, idx, arr) => {
          const id = pos.element.id;
          return arr.findIndex((p) => p.element.id === id) === idx;
        })
        .map((nudgedPos) => {
          const distance = Math.hypot(
            nudgedPos.nudgedX - cursorPos.x,
            nudgedPos.nudgedY - cursorPos.y
          );

          // Find nearby badges for potential dropdown grouping (only from visible badges)
          const nearbyBadges = findNearbyBadges(
            visibleBadges,
            nudgedPos.nudgedX,
            nudgedPos.nudgedY,
            NEARBY_THRESHOLD
          );

          return (
            <NudgedBadge
              key={nudgedPos.element.id}
              position={nudgedPos}
              distance={distance}
              nearbyBadges={nearbyBadges}
              cursorPos={cursorPos}
              onSelect={handleSelect}
            />
          );
        })}
    </div>
  );

  return createPortal(content, getUILintPortalHost());
}

/**
 * Badge at nudged position with optional dropdown for nearby badges
 */
interface NudgedBadgeProps {
  position: NudgedBadgePosition;
  distance: number;
  nearbyBadges: NudgedBadgePosition[];
  cursorPos: { x: number; y: number };
  onSelect: (element: ScannedElement, issue: ElementIssue) => void;
}

function NudgedBadge({
  position,
  distance,
  nearbyBadges,
  cursorPos,
  onSelect,
}: NudgedBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const closeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const { element, issue, rect, nudgedX, nudgedY } = position;
  const hasNearbyBadges = nearbyBadges.length > 1;

  // Snap badge position to stay within window bounds
  const snappedPosition = useMemo(
    () => snapToWindowBounds(nudgedX, nudgedY),
    [nudgedX, nudgedY]
  );

  // Calculate badge color based on issue status
  const badgeColor = useMemo(() => {
    if (issue.status === "error") return STYLES.error;
    if (issue.status === "scanning") return STYLES.highlight;
    if (issue.status === "pending") return "rgba(156, 163, 175, 0.7)";
    if (issue.status === "complete") {
      return getBadgeColor(issue.issues.length);
    }
    return STYLES.success;
  }, [issue]);

  const handleMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsExpanded(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
      setHoveredIndex(null);
    }, 150);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(element, issue);
    },
    [element, issue, onSelect]
  );

  // Get the hovered element's rect for highlighting
  const hoveredBadge = useMemo(() => {
    if (hoveredIndex === null) return null;
    return nearbyBadges[hoveredIndex] ?? null;
  }, [hoveredIndex, nearbyBadges]);

  // Position dropdown to avoid going off-screen
  const dropdownStyle = useMemo((): React.CSSProperties => {
    const preferRight = snappedPosition.x < window.innerWidth - 220;
    const preferBelow = snappedPosition.y < window.innerHeight - 200;

    return {
      position: "fixed",
      top: preferBelow ? snappedPosition.y + 12 : undefined,
      bottom: preferBelow
        ? undefined
        : window.innerHeight - snappedPosition.y + 12,
      left: preferRight ? snappedPosition.x - 8 : undefined,
      right: preferRight
        ? undefined
        : window.innerWidth - snappedPosition.x - 8,
      zIndex: 100000,
      backgroundColor: STYLES.bg,
      borderRadius: "8px",
      border: `1px solid ${STYLES.border}`,
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
      padding: "4px 0",
      minWidth: "200px",
      fontFamily: STYLES.font,
      pointerEvents: "auto", // Re-enable pointer events for interactive dropdown
    };
  }, [snappedPosition]);

  // Calculate scale based on distance (hover overrides to full scale)
  const scale = isExpanded ? 1.1 : getScaleFromDistance(distance);

  // Determine what to show in badge
  const issueCount = issue.status === "complete" ? issue.issues.length : 0;

  return (
    <>
      {/* Element highlight when badge is hovered (self or from dropdown) */}
      {isExpanded && !hoveredBadge && (
        <div
          style={{
            position: "fixed",
            top: rect.top - 2,
            left: rect.left - 2,
            width: rect.width + 4,
            height: rect.height + 4,
            border: `2px solid ${STYLES.highlight}`,
            borderRadius: "4px",
            pointerEvents: "none",
            zIndex: 99994,
            boxShadow: `0 0 0 1px rgba(59, 130, 246, 0.3)`,
          }}
          data-ui-lint
        />
      )}

      {/* Highlight for hovered element in dropdown */}
      {hoveredBadge && (
        <div
          style={{
            position: "fixed",
            top: hoveredBadge.rect.top - 2,
            left: hoveredBadge.rect.left - 2,
            width: hoveredBadge.rect.width + 4,
            height: hoveredBadge.rect.height + 4,
            border: `2px solid ${STYLES.highlight}`,
            borderRadius: "4px",
            pointerEvents: "none",
            zIndex: 99994,
            boxShadow: `0 0 0 1px rgba(59, 130, 246, 0.3)`,
          }}
          data-ui-lint
        />
      )}

      {/* Circle badge at nudged position */}
      <div
        style={{
          position: "fixed",
          top: snappedPosition.y - 0,
          left: snappedPosition.x - 0,
          zIndex: isExpanded ? 99999 : 99995,
          cursor: "pointer",
          transition: "transform 0.1s ease-out",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          pointerEvents: "auto", // Re-enable pointer events for interactive badge
        }}
        data-ui-lint
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            backgroundColor: badgeColor,
            boxShadow: STYLES.shadow,
            border: `1px solid ${STYLES.border}`,
          }}
        >
          {issue.status === "scanning" ? (
            <div
              style={{
                width: "10px",
                height: "10px",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                borderTopColor: "#FFFFFF",
                borderRadius: "50%",
                animation: "uilint-badge-spin 0.8s linear infinite",
              }}
            />
          ) : issue.status === "error" ? (
            <ExclamationIconTiny />
          ) : issue.status === "pending" ? (
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "rgba(255, 255, 255, 0.4)",
              }}
            />
          ) : issueCount === 0 ? (
            <CheckIconTiny />
          ) : (
            <span
              style={{
                color: STYLES.text,
                fontSize: "10px",
                fontWeight: 700,
                fontFamily: STYLES.font,
              }}
            >
              {issueCount > 9 ? "9+" : issueCount}
            </span>
          )}
        </div>
      </div>

      {/* Dropdown showing nearby badges when expanded and there are nearby ones */}
      {isExpanded && hasNearbyBadges && (
        <div
          style={dropdownStyle}
          data-ui-lint
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {nearbyBadges.map((badge, index) => (
            <DropdownItem
              key={badge.element.id}
              badge={badge}
              isHovered={hoveredIndex === index}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onSelect(badge.element, badge.issue)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Single item in dropdown menu
 */
interface DropdownItemProps {
  badge: NudgedBadgePosition;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

function DropdownItem({
  badge,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: DropdownItemProps) {
  const elementLabel = formatElementLabel(badge.element);

  const issueCount =
    badge.issue.status === "complete" ? badge.issue.issues.length : 0;
  const color = getBadgeColor(issueCount);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        cursor: "pointer",
        backgroundColor: isHovered ? "rgba(59, 130, 246, 0.15)" : "transparent",
        transition: "background-color 0.1s",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: color,
          }}
        />
        <span
          style={{
            fontSize: "12px",
            color: STYLES.text,
            maxWidth: "160px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {elementLabel}
        </span>
      </div>

      {badge.issue.status === "complete" &&
        (issueCount === 0 ? (
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              backgroundColor: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckIcon />
          </div>
        ) : (
          <div
            style={{
              minWidth: "16px",
              height: "16px",
              padding: "0 4px",
              borderRadius: "8px",
              backgroundColor: color,
              color: STYLES.text,
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {issueCount > 9 ? "9+" : issueCount}
          </div>
        ))}

      {badge.issue.status === "scanning" && (
        <div
          style={{
            width: "12px",
            height: "12px",
            border: "2px solid rgba(59, 130, 246, 0.3)",
            borderTopColor: STYLES.highlight,
            borderRadius: "50%",
            animation: "uilint-badge-spin 0.8s linear infinite",
          }}
        />
      )}

      {badge.issue.status === "error" && (
        <div
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            backgroundColor: STYLES.error,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ExclamationIcon />
        </div>
      )}

      {badge.issue.status === "pending" && (
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "rgba(156, 163, 175, 0.5)",
          }}
        />
      )}
    </div>
  );
}

// Icons

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6L9 17l-5-5"
        stroke={STYLES.text}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIconTiny() {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6L9 17l-5-5"
        stroke={STYLES.text}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExclamationIconTiny() {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8v4M12 16h.01"
        stroke={STYLES.text}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExclamationIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8v4M12 16h.01"
        stroke={STYLES.text}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
