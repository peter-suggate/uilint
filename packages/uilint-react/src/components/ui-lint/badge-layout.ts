/**
 * Badge Layout - Force-directed algorithm for positioning badges
 *
 * Uses a force simulation to nudge overlapping badges apart while
 * keeping them anchored near their original positions.
 */

import type { ScannedElement, ElementIssue } from "./types";

/**
 * Input badge position (from DOM element positions)
 */
export interface BadgePosition {
  element: ScannedElement;
  issue: ElementIssue;
  x: number;
  y: number;
  rect: DOMRect;
}

/**
 * Output badge position with nudged coordinates
 */
export interface NudgedBadgePosition extends BadgePosition {
  nudgedX: number;
  nudgedY: number;
}

/**
 * Configuration for the layout algorithm
 */
export interface LayoutConfig {
  /** How strongly badges push apart (default: 50) */
  repulsionForce: number;
  /** How strongly badges stay near origin (default: 0.3) */
  anchorStrength: number;
  /** Minimum gap between badge centers (default: 24) */
  minDistance: number;
  /** Number of simulation steps (default: 50) */
  iterations: number;
  /** Velocity decay per step (default: 0.9) */
  damping: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: LayoutConfig = {
  repulsionForce: 50,
  anchorStrength: 0.3,
  minDistance: 24,
  iterations: 50,
  damping: 0.9,
};

/**
 * Internal state for simulation
 */
interface SimulationNode {
  position: BadgePosition;
  nudgedX: number;
  nudgedY: number;
  velocityX: number;
  velocityY: number;
}

/**
 * Run force-directed simulation to compute nudged positions
 */
function computeLayout(
  positions: BadgePosition[],
  config: LayoutConfig
): NudgedBadgePosition[] {
  if (positions.length === 0) return [];
  if (positions.length === 1) {
    return [
      { ...positions[0], nudgedX: positions[0].x, nudgedY: positions[0].y },
    ];
  }

  // Initialize simulation nodes at original locations
  const nodes: SimulationNode[] = positions.map((p) => ({
    position: p,
    nudgedX: p.x,
    nudgedY: p.y,
    velocityX: 0,
    velocityY: 0,
  }));

  // Run simulation iterations
  for (let iter = 0; iter < config.iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      let fx = 0;
      let fy = 0;

      // Calculate repulsion from other badges
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;

        const dx = nodes[i].nudgedX - nodes[j].nudgedX;
        const dy = nodes[i].nudgedY - nodes[j].nudgedY;
        const dist = Math.max(Math.hypot(dx, dy), 1);

        // Only apply repulsion when within minimum distance
        if (dist < config.minDistance) {
          const force = config.repulsionForce / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }
      }

      // Calculate anchor attraction (spring back to original position)
      const anchorDx = positions[i].x - nodes[i].nudgedX;
      const anchorDy = positions[i].y - nodes[i].nudgedY;
      fx += anchorDx * config.anchorStrength;
      fy += anchorDy * config.anchorStrength;

      // Apply forces with damping
      nodes[i].velocityX = (nodes[i].velocityX + fx) * config.damping;
      nodes[i].velocityY = (nodes[i].velocityY + fy) * config.damping;
      nodes[i].nudgedX += nodes[i].velocityX;
      nodes[i].nudgedY += nodes[i].velocityY;
    }
  }

  // Return nudged positions
  return nodes.map((node) => ({
    ...node.position,
    nudgedX: node.nudgedX,
    nudgedY: node.nudgedY,
  }));
}

/**
 * Builder class for configuring and running badge layout
 *
 * Example usage:
 * ```ts
 * const nudged = BadgeLayoutBuilder
 *   .create(positions)
 *   .minDistance(24)
 *   .repulsion(50)
 *   .anchorStrength(0.3)
 *   .iterations(50)
 *   .compute();
 * ```
 */
export class BadgeLayoutBuilder {
  private config: LayoutConfig;
  private positions: BadgePosition[];

  private constructor(positions: BadgePosition[]) {
    this.positions = positions;
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Create a new layout builder with badge positions
   */
  static create(positions: BadgePosition[]): BadgeLayoutBuilder {
    return new BadgeLayoutBuilder(positions);
  }

  /**
   * Set the repulsion force (how strongly badges push apart)
   * Higher values = badges spread more aggressively
   */
  repulsion(force: number): this {
    this.config.repulsionForce = force;
    return this;
  }

  /**
   * Set the anchor strength (how strongly badges stay near origin)
   * Higher values = badges stay closer to their original positions
   */
  anchorStrength(strength: number): this {
    this.config.anchorStrength = strength;
    return this;
  }

  /**
   * Set the minimum distance between badge centers
   * Badges closer than this will be pushed apart
   */
  minDistance(distance: number): this {
    this.config.minDistance = distance;
    return this;
  }

  /**
   * Set the number of simulation iterations
   * More iterations = more stable but slower
   */
  iterations(count: number): this {
    this.config.iterations = count;
    return this;
  }

  /**
   * Set the damping factor (velocity decay per step)
   * Lower values = system settles faster but may be less stable
   */
  damping(factor: number): this {
    this.config.damping = factor;
    return this;
  }

  /**
   * Run the simulation and return nudged positions
   */
  compute(): NudgedBadgePosition[] {
    return computeLayout(this.positions, this.config);
  }
}

/**
 * Find badges that are close to a given position
 * Useful for showing dropdowns when hovering near multiple badges
 */
export function findNearbyBadges(
  positions: NudgedBadgePosition[],
  x: number,
  y: number,
  threshold: number
): NudgedBadgePosition[] {
  return positions.filter((p) => {
    const dist = Math.hypot(p.nudgedX - x, p.nudgedY - y);
    return dist <= threshold;
  });
}
