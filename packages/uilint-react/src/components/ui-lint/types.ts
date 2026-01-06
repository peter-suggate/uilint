/**
 * Types for UILint Source Visualization
 */

/**
 * Source location from React Fiber _debugSource
 */
export interface SourceLocation {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

/**
 * Component information extracted from React Fiber
 */
export interface ComponentInfo {
  name: string;
  source: SourceLocation | null;
}

/**
 * A scanned DOM element with its React source information
 */
export interface ScannedElement {
  id: string;
  element: Element;
  tagName: string;
  className: string;
  source: SourceLocation | null;
  componentStack: ComponentInfo[];
  rect: DOMRect;
}

/**
 * A source file with all its associated elements
 */
export interface SourceFile {
  path: string;
  displayName: string;
  color: string;
  elements: ScannedElement[];
}

/**
 * User-configurable settings for the overlay
 */
export interface UILintSettings {
  hideNodeModules: boolean;
  autoScanEnabled: boolean;
}

/**
 * State for the auto-scan feature
 */
export interface AutoScanState {
  status: "idle" | "scanning" | "paused" | "complete";
  currentIndex: number;
  totalElements: number;
  elements: ScannedElement[];
}

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
 * Cached issue data for a scanned element
 */
export interface ElementIssue {
  elementId: string;
  /** ESLint rule violations from uilint-eslint (including semantic rule) */
  issues: ESLintIssue[];
  status: "pending" | "scanning" | "complete" | "error";
}

/**
 * Element detected under the cursor during Alt-key locator mode
 */
export interface LocatorTarget {
  element: Element;
  source: SourceLocation | null;
  componentStack: ComponentInfo[];
  rect: DOMRect;
  /** Index in the component stack (0 = current element, higher = parent) */
  stackIndex: number;
}

/**
 * Element being inspected in the sidebar
 */
export interface InspectedElement {
  element: Element;
  source: SourceLocation | null;
  componentStack: ComponentInfo[];
  rect: DOMRect;
  /** Optional ID from auto-scan to link to cached results */
  scannedElementId?: string;
}

/**
 * Context value provided by UILintProvider
 */
export interface UILintContextValue {
  settings: UILintSettings;
  updateSettings: (settings: Partial<UILintSettings>) => void;
  /** True when Alt/Option key is held down */
  altKeyHeld: boolean;
  /** Current element under cursor when Alt is held */
  locatorTarget: LocatorTarget | null;
  /** Navigate to parent component in locator mode */
  locatorGoUp: () => void;
  /** Navigate to child component in locator mode */
  locatorGoDown: () => void;
  /** Element currently being inspected in sidebar */
  inspectedElement: InspectedElement | null;
  /** Set the element to inspect (opens sidebar) */
  setInspectedElement: (element: InspectedElement | null) => void;
  /** Auto-scan state */
  autoScanState: AutoScanState;
  /** Cache of element issues from auto-scan */
  elementIssuesCache: Map<string, ElementIssue>;
  /** Start auto-scanning all page elements */
  startAutoScan: () => void;
  /** Pause the auto-scan */
  pauseAutoScan: () => void;
  /** Resume the auto-scan */
  resumeAutoScan: () => void;
  /** Stop and reset the auto-scan */
  stopAutoScan: () => void;
}

/**
 * Props for the UILintProvider component
 */
export interface UILintProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
}

/**
 * Response from the source API
 */
export interface SourceApiResponse {
  content: string;
  relativePath: string;
}

/**
 * Cached source file content
 */
export interface CachedSource {
  content: string;
  relativePath: string;
  fetchedAt: number;
}

/**
 * Color palette for source file differentiation
 */
export const FILE_COLORS = [
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#10B981", // emerald
  "#F59E0B", // amber
  "#06B6D4", // cyan
  "#EF4444", // red
  "#84CC16", // lime
  "#6366F1", // indigo
  "#F97316", // orange
  "#14B8A6", // teal
  "#A855F7", // purple
] as const;

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: UILintSettings = {
  hideNodeModules: true,
  autoScanEnabled: false,
};

/**
 * Default auto-scan state
 */
export const DEFAULT_AUTO_SCAN_STATE: AutoScanState = {
  status: "idle",
  currentIndex: 0,
  totalElements: 0,
  elements: [],
};

/**
 * Data attribute used to mark scanned elements
 */
export const DATA_UILINT_ID = "data-ui-lint-id";
