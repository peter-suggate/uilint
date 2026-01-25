/**
 * ESLint Plugin Types
 *
 * Types extracted from the main store for ESLint-related functionality.
 */

/**
 * ESLint issue from WebSocket server (uilint serve)
 */
export interface ESLintIssue {
  /** Line number in source file */
  line: number;
  /** Column number */
  column?: number;
  /** Issue description */
  message: string;
  /** ESLint rule ID (e.g., "uilint/semantic", "uilint/no-arbitrary-tailwind") */
  ruleId?: string;
  /** data-loc value to match to DOM element */
  dataLoc?: string;
}

/**
 * Cached issue data for a source location (dataLoc)
 * Multiple DOM elements can share the same dataLoc (e.g., list items),
 * so we key by dataLoc (path:line:column) rather than element ID.
 */
export interface ElementIssue {
  /** The dataLoc key (format: "path:line:column") */
  dataLoc: string;
  /** ESLint rule violations from uilint-eslint (including semantic rule) */
  issues: ESLintIssue[];
  status: "pending" | "scanning" | "complete" | "error";
}

/**
 * Extended rule metadata with full configuration info
 */
export interface AvailableRule {
  id: string;
  name: string;
  description: string;
  category: "static" | "semantic";
  defaultSeverity: "error" | "warn" | "off";
  /** Current severity from ESLint config (may differ from default) */
  currentSeverity?: "error" | "warn" | "off";
  /** Current options from ESLint config */
  currentOptions?: Record<string, unknown>;
  docs?: string;
  optionSchema?: RuleOptionSchema;
  defaultOptions?: unknown[];
}

/**
 * Current configuration state for a rule
 */
export interface RuleConfig {
  severity: "error" | "warn" | "off";
  options?: Record<string, unknown>;
}

/**
 * Rule option schema for configuration
 */
export interface RuleOptionSchema {
  fields: OptionFieldSchema[];
}

/**
 * Option field schema for rule configuration UI
 */
export interface OptionFieldSchema {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "multiselect" | "array";
  defaultValue: unknown;
  placeholder?: string;
  options?: Array<{ value: string | number; label: string }>;
  description?: string;
}

/**
 * Auto-scan settings for ESLint and Vision analysis
 * Persisted to localStorage
 */
export interface AutoScanSettings {
  eslint: {
    /** Auto-scan when page first loads */
    onPageLoad: boolean;
    /** Re-scan when files change (existing behavior) */
    onFileChange: boolean;
  };
  vision: {
    /** Auto-capture and analyze on route change */
    onRouteChange: boolean;
    /** Auto-capture and analyze on initial page load */
    onInitialLoad: boolean;
  };
}

/**
 * A scanned DOM element with its source information
 */
export interface ScannedElement {
  /**
   * Unique per-instance ID derived from data-loc.
   * Format: "loc:path:line:column#occurrence"
   */
  id: string;
  element: Element;
  tagName: string;
  className: string;
  /** Source location (always present from data-loc) */
  source: SourceLocation;
  rect: DOMRect;
}

/**
 * Source location from data-loc attribute
 */
export interface SourceLocation {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

// Note: ScanStatus is defined in slice.ts. Use `import type { ScanStatus } from "./slice"`

/**
 * Default auto-scan settings
 */
export const DEFAULT_AUTO_SCAN_SETTINGS: AutoScanSettings = {
  eslint: {
    onPageLoad: false,
    onFileChange: true,
  },
  vision: {
    onRouteChange: false,
    onInitialLoad: false,
  },
};
