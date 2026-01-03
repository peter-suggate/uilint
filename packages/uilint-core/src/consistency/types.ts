/**
 * Types for UI consistency analysis
 */

/**
 * Relevant computed styles for consistency checking
 */
export interface StyleSnapshot {
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  padding?: string;
  borderRadius?: string;
  border?: string;
  boxShadow?: string;
  gap?: string;
}

/**
 * Element roles for grouping and analysis
 */
export type ElementRole =
  | "button"
  | "link"
  | "heading"
  | "input"
  | "card"
  | "container"
  | "text"
  | "other";

/**
 * Snapshot of a single DOM element with its styles and context
 */
export interface ElementSnapshot {
  /** Unique ID mapping to data-elements attribute, e.g. "el-47" */
  id: string;
  /** HTML tag name */
  tag: string;
  /** Inferred semantic role */
  role: ElementRole;
  /** Truncated innerText (max 50 chars) */
  text: string;
  /** From data-ui-component attribute if present */
  component?: string;
  /** Ancestor context like "header > nav" */
  context: string;
  /** Relevant computed styles */
  styles: StyleSnapshot;
  /** Element dimensions */
  rect: { width: number; height: number };
}

/**
 * Elements grouped by role for batch analysis
 */
export interface GroupedSnapshot {
  buttons: ElementSnapshot[];
  headings: ElementSnapshot[];
  cards: ElementSnapshot[];
  links: ElementSnapshot[];
  inputs: ElementSnapshot[];
  containers: ElementSnapshot[];
}

/**
 * Violation categories detected by consistency analysis
 */
export type ViolationCategory =
  | "spacing"
  | "color"
  | "typography"
  | "sizing"
  | "borders"
  | "shadows";

/**
 * Severity levels for violations
 */
export type ViolationSeverity = "error" | "warning" | "info";

/**
 * A consistency violation detected between similar elements
 */
export interface Violation {
  /** Element IDs involved in the violation, e.g. ["el-3", "el-7"] */
  elementIds: string[];
  /** Category of the inconsistency */
  category: ViolationCategory;
  /** Severity level */
  severity: ViolationSeverity;
  /** Human-readable description */
  message: string;
  /** Detailed information about the violation */
  details: {
    /** The CSS property that differs */
    property: string;
    /** The differing values found */
    values: string[];
    /** Optional suggestion for fixing */
    suggestion?: string;
  };
}

/**
 * Result of consistency analysis
 */
export interface ConsistencyResult {
  violations: Violation[];
  /** Number of elements analyzed */
  elementCount: number;
  /** Time taken in milliseconds */
  analysisTime: number;
}
