"use client";

/**
 * ElementBadges - Shows issue count badges on scanned elements
 *
 * Renders notification-style badges at the top-right corner of each
 * scanned element during auto-scan mode.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import type { ScannedElement, ElementIssue, InspectedElement } from "./types";
import {
  BadgeLayoutBuilder,
  findNearbyBadges,
  type BadgePosition,
  type NudgedBadgePosition,
} from "./badge-layout";

/**
 * Design tokens
 */
const STYLES = {
  bg: "rgba(17, 24, 39, 0.95)",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  text: "#FFFFFF",
  border: "rgba(255, 255, 255, 0.2)",
  highlight: "#3B82F6",
  font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  shadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
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
  if (issueCount <= 2) return STYLES.warning;
  return STYLES.error;
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

  const componentName = element.componentStack[0]?.name;
  return componentName ? `${tag} > ${componentName}` : tag;
}

/**
 * Threshold for detecting nearby badges (for dropdown grouping)
 */
const NEARBY_THRESHOLD = 30;

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
  const { autoScanState, elementIssuesCache, setInspectedElement } =
    useUILintContext();
  const [mounted, setMounted] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [badgePositions, setBadgePositions] = useState<BadgePosition[]>([]);

  useEffect(() => {
    setMounted(true);
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
        // Badge is positioned at top-right corner
        const x = rect.right - 8;
        const y = rect.top - 8;

        // Skip if off-screen
        if (rect.top < -50 || rect.top > window.innerHeight + 50) continue;
        if (rect.left < -50 || rect.left > window.innerWidth + 50) continue;

        positions.push({ element, issue, x, y, rect });
      }
      setBadgePositions(positions);
    };

    updatePositions();

    // Update on animation frame for smooth tracking
    let rafId: number;
    const loop = () => {
      updatePositions();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  }, [autoScanState, elementIssuesCache]);

  // Handle badge selection
  const handleSelect = useCallback(
    (element: ScannedElement, issue: ElementIssue) => {
      const inspected: InspectedElement = {
        element: element.element,
        source: element.source,
        componentStack: element.componentStack,
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

  if (!mounted) return null;
  if (autoScanState.status === "idle") return null;

  const content = (
    <div data-ui-lint>
      <BadgeAnimationStyles />
      {nudgedPositions.map((nudgedPos) => {
        const distance = Math.hypot(
          nudgedPos.nudgedX - cursorPos.x,
          nudgedPos.nudgedY - cursorPos.y
        );

        // Find nearby badges for potential dropdown grouping
        const nearbyBadges = findNearbyBadges(
          nudgedPositions,
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

  return createPortal(content, document.body);
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
    const preferRight = nudgedX < window.innerWidth - 220;
    const preferBelow = nudgedY < window.innerHeight - 200;

    return {
      position: "fixed",
      top: preferBelow ? nudgedY + 12 : undefined,
      bottom: preferBelow ? undefined : window.innerHeight - nudgedY + 12,
      left: preferRight ? nudgedX - 8 : undefined,
      right: preferRight ? undefined : window.innerWidth - nudgedX - 8,
      zIndex: 100000,
      backgroundColor: STYLES.bg,
      borderRadius: "8px",
      border: `1px solid ${STYLES.border}`,
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
      padding: "4px 0",
      minWidth: "200px",
      fontFamily: STYLES.font,
    };
  }, [nudgedX, nudgedY]);

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
          top: nudgedY - 9,
          left: nudgedX - 9,
          zIndex: isExpanded ? 99999 : 99995,
          cursor: "pointer",
          transition:
            "transform 0.1s ease-out, top 0.15s ease-out, left 0.15s ease-out",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
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
