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
 * Cluster threshold for grouping nearby badges (in pixels)
 */
const CLUSTER_THRESHOLD = 24;

/**
 * Get badge color based on issue count
 */
function getBadgeColor(issueCount: number): string {
  if (issueCount === 0) return STYLES.success;
  if (issueCount <= 2) return STYLES.warning;
  return STYLES.error;
}

/**
 * Badge for a single element
 */
interface ElementBadgeProps {
  element: ScannedElement;
  issue: ElementIssue;
  distance: number;
  onSelect: (element: ScannedElement, issue: ElementIssue) => void;
}

function ElementBadge({
  element,
  issue,
  distance,
  onSelect,
}: ElementBadgeProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Update rect on mount and on scroll/resize
  useEffect(() => {
    const updateRect = () => {
      if (element.element && document.contains(element.element)) {
        setRect(element.element.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };

    updateRect();

    // Use requestAnimationFrame for smooth updates
    let rafId: number;
    const handleUpdate = () => {
      updateRect();
      rafId = requestAnimationFrame(handleUpdate);
    };

    // Start watching
    rafId = requestAnimationFrame(handleUpdate);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [element.element]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(element, issue);
    },
    [element, issue, onSelect]
  );

  if (!rect) return null;

  // Don't show badges for elements that are not visible
  if (rect.top < -50 || rect.top > window.innerHeight + 50) return null;
  if (rect.left < -50 || rect.left > window.innerWidth + 50) return null;

  // Calculate scale based on distance (hover overrides to full scale)
  const scale = isHovered ? 1.1 : getScaleFromDistance(distance);

  // Position at top-right corner of element
  const badgeStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.top - 8,
    left: rect.right - 8,
    zIndex: isHovered ? 99999 : 99995,
    cursor: "pointer",
    transition: "transform 0.1s ease-out",
    transform: `scale(${scale})`,
    transformOrigin: "center center",
  };

  return (
    <>
      {/* Element highlight when badge is hovered */}
      {isHovered && (
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

      {/* Badge - always show full version, scale based on proximity */}
      <div
        style={badgeStyle}
        data-ui-lint
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
        {issue.status === "scanning" && <ScanningBadge />}
        {issue.status === "complete" && (
          <IssueBadge count={issue.issues.length} />
        )}
        {issue.status === "error" && <ErrorBadge />}
        {issue.status === "pending" && <PendingBadge />}
      </div>
    </>
  );
}

/**
 * Badge showing issue count or checkmark
 */
function IssueBadge({ count }: { count: number }) {
  const color = getBadgeColor(count);

  if (count === 0) {
    // Checkmark badge
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: STYLES.shadow,
          border: `1px solid ${STYLES.border}`,
        }}
      >
        <CheckIcon />
      </div>
    );
  }

  // Number badge
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "18px",
        height: "18px",
        padding: "0 5px",
        borderRadius: "9px",
        backgroundColor: color,
        color: STYLES.text,
        fontSize: "10px",
        fontWeight: 700,
        fontFamily: STYLES.font,
        boxShadow: STYLES.shadow,
        border: `1px solid ${STYLES.border}`,
      }}
    >
      {count > 9 ? "9+" : count}
    </div>
  );
}

/**
 * Spinning badge for scanning state
 */
function ScanningBadge() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        backgroundColor: STYLES.bg,
        boxShadow: STYLES.shadow,
        border: `1px solid ${STYLES.border}`,
      }}
    >
      <style>{`
        @keyframes uilint-badge-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          width: "10px",
          height: "10px",
          border: "2px solid rgba(59, 130, 246, 0.3)",
          borderTopColor: "#3B82F6",
          borderRadius: "50%",
          animation: "uilint-badge-spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}

/**
 * Small gray badge for pending state
 */
function PendingBadge() {
  return (
    <div
      style={{
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        backgroundColor: "rgba(156, 163, 175, 0.5)",
        boxShadow: STYLES.shadow,
      }}
    />
  );
}

/**
 * Error badge
 */
function ErrorBadge() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        backgroundColor: STYLES.error,
        boxShadow: STYLES.shadow,
        border: `1px solid ${STYLES.border}`,
      }}
    >
      <ExclamationIcon />
    </div>
  );
}

/**
 * Badge position data for clustering
 */
interface BadgePosition {
  element: ScannedElement;
  issue: ElementIssue;
  x: number;
  y: number;
  rect: DOMRect;
}

/**
 * Badge cluster data
 */
interface BadgeCluster {
  id: string;
  badges: BadgePosition[];
  centroidX: number;
  centroidY: number;
}

/**
 * Union-Find data structure for clustering
 */
class UnionFind {
  parent: Map<string, string> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const px = this.find(x);
    const py = this.find(y);
    if (px !== py) {
      this.parent.set(px, py);
    }
  }
}

/**
 * Cluster badges that are close together
 */
function clusterBadges(
  positions: BadgePosition[],
  threshold: number
): BadgeCluster[] {
  if (positions.length === 0) return [];

  const uf = new UnionFind();

  // Find overlapping badges
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dist = Math.hypot(
        positions[i].x - positions[j].x,
        positions[i].y - positions[j].y
      );
      if (dist <= threshold) {
        uf.union(positions[i].element.id, positions[j].element.id);
      }
    }
  }

  // Group by cluster
  const clusters = new Map<string, BadgePosition[]>();
  for (const pos of positions) {
    const root = uf.find(pos.element.id);
    if (!clusters.has(root)) {
      clusters.set(root, []);
    }
    clusters.get(root)!.push(pos);
  }

  // Create cluster objects with centroids
  return Array.from(clusters.entries()).map(([id, badges]) => {
    const centroidX = badges.reduce((sum, b) => sum + b.x, 0) / badges.length;
    const centroidY = badges.reduce((sum, b) => sum + b.y, 0) / badges.length;
    return { id, badges, centroidX, centroidY };
  });
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

  // Cluster badges
  const clusters = useMemo(
    () => clusterBadges(badgePositions, CLUSTER_THRESHOLD),
    [badgePositions]
  );

  if (!mounted) return null;
  if (autoScanState.status === "idle") return null;

  const content = (
    <div data-ui-lint>
      {clusters.map((cluster) => {
        if (cluster.badges.length === 1) {
          // Single badge - render normally
          const { element, issue, x, y } = cluster.badges[0];
          const distance = Math.hypot(x - cursorPos.x, y - cursorPos.y);

          return (
            <ElementBadge
              key={element.id}
              element={element}
              issue={issue}
              distance={distance}
              onSelect={handleSelect}
            />
          );
        } else {
          // Clustered badges
          const distance = Math.hypot(
            cluster.centroidX - cursorPos.x,
            cluster.centroidY - cursorPos.y
          );

          return (
            <ClusteredBadge
              key={cluster.id}
              cluster={cluster}
              distance={distance}
              onSelect={handleSelect}
            />
          );
        }
      })}
    </div>
  );

  return createPortal(content, document.body);
}

/**
 * Clustered badge - shows multiple overlapping badges
 */
interface ClusteredBadgeProps {
  cluster: BadgeCluster;
  distance: number;
  onSelect: (element: ScannedElement, issue: ElementIssue) => void;
}

function ClusteredBadge({ cluster, distance, onSelect }: ClusteredBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const closeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Calculate badge segments for display
  const badgeSegments = useMemo(() => {
    return cluster.badges.map(({ issue }) => {
      if (issue.status === "complete") {
        const count = issue.issues.length;
        return {
          type: "count" as const,
          count,
          color: getBadgeColor(count),
        };
      } else if (issue.status === "error") {
        return { type: "error" as const, color: STYLES.error };
      } else if (issue.status === "scanning") {
        return { type: "scanning" as const, color: STYLES.highlight };
      } else {
        return { type: "pending" as const, color: "rgba(156, 163, 175, 0.5)" };
      }
    });
  }, [cluster.badges]);

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

  // Get the hovered element's rect for highlighting
  const hoveredBadge =
    hoveredIndex !== null ? cluster.badges[hoveredIndex] : null;

  // Position dropdown to avoid going off-screen
  const dropdownStyle = useMemo((): React.CSSProperties => {
    const preferRight = cluster.centroidX < window.innerWidth - 200;
    const preferBelow = cluster.centroidY < window.innerHeight - 200;

    return {
      position: "fixed",
      top: preferBelow ? cluster.centroidY + 12 : undefined,
      bottom: preferBelow
        ? undefined
        : window.innerHeight - cluster.centroidY + 12,
      left: preferRight ? cluster.centroidX - 8 : undefined,
      right: preferRight
        ? undefined
        : window.innerWidth - cluster.centroidX - 8,
      zIndex: 100000,
      backgroundColor: STYLES.bg,
      borderRadius: "8px",
      border: `1px solid ${STYLES.border}`,
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
      padding: "4px 0",
      minWidth: "180px",
      fontFamily: STYLES.font,
    };
  }, [cluster.centroidX, cluster.centroidY]);

  return (
    <>
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

      {/* Cluster badge - always show full version, scale based on proximity */}
      <div
        style={{
          position: "fixed",
          top: cluster.centroidY - 9,
          left: cluster.centroidX - 9,
          zIndex: isExpanded ? 99999 : 99995,
          cursor: "pointer",
          transition: "transform 0.1s ease-out",
          transform: `scale(${
            isExpanded ? 1.1 : getScaleFromDistance(distance)
          })`,
          transformOrigin: "center center",
        }}
        data-ui-lint
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "20px",
            borderRadius: "10px",
            backgroundColor: STYLES.bg,
            boxShadow: STYLES.shadow,
            border: `1px solid ${STYLES.border}`,
            overflow: "hidden",
          }}
        >
          {badgeSegments.map((segment, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "18px",
                height: "100%",
                padding: "0 4px",
                backgroundColor: segment.color,
                borderRight:
                  index < badgeSegments.length - 1
                    ? `1px solid rgba(0, 0, 0, 0.2)`
                    : undefined,
              }}
            >
              {segment.type === "count" &&
                (segment.count === 0 ? (
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
                    {segment.count > 9 ? "9+" : segment.count}
                  </span>
                ))}
              {segment.type === "error" && <ExclamationIconTiny />}
              {segment.type === "scanning" && (
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    border: "1.5px solid rgba(255, 255, 255, 0.3)",
                    borderTopColor: "#FFFFFF",
                    borderRadius: "50%",
                    animation: "uilint-badge-spin 0.8s linear infinite",
                  }}
                />
              )}
              {segment.type === "pending" && (
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(255, 255, 255, 0.4)",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Expanded dropdown */}
      {isExpanded && (
        <div
          style={dropdownStyle}
          data-ui-lint
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {cluster.badges.map((badge, index) => (
            <ClusterDropdownItem
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
 * Single item in cluster dropdown
 */
interface ClusterDropdownItemProps {
  badge: BadgePosition;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

function ClusterDropdownItem({
  badge,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: ClusterDropdownItemProps) {
  const componentName =
    badge.element.componentStack[0]?.name ||
    badge.element.tagName.toLowerCase();

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
            maxWidth: "120px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {componentName}
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
