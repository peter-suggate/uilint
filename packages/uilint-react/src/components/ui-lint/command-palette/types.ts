/**
 * Types for Command Palette
 *
 * Unified search interface - all content in a single searchable list
 * organized by contextual categories.
 */

import type { ESLintIssue, ScannedElement, SourceFile, ScreenshotCapture } from "../types";
import type { VisionIssue } from "../../../scanner/vision-capture";

/**
 * Categories for organizing items in the unified list
 */
export type CategoryType = "settings" | "vision" | "actions" | "rules" | "captures" | "files" | "issues";

/**
 * Result types that can appear in search
 */
export type SearchResultType = "action" | "file" | "rule" | "element" | "issue" | "capture";

/**
 * Rule metadata from uilint-eslint (simplified for command palette)
 */
export interface RuleMeta {
  id: string;
  name: string;
  description: string;
  category: "static" | "semantic";
  defaultSeverity: "error" | "warn" | "off";
  docs?: string;
}

/**
 * A searchable item in the command palette
 */
export interface SearchableItem {
  type: SearchResultType;
  category: CategoryType;
  id: string;
  /** Text to search against */
  searchText: string;
  /** Primary display text */
  title: string;
  /** Secondary display text */
  subtitle?: string;
  /** Issue count for files/elements/rules */
  issueCount?: number;
  /** Original data for actions */
  data: ActionSearchData | FileSearchData | RuleSearchData | ElementSearchData | IssueSearchData | CaptureSearchData;
}

/**
 * Action types for suggested actions
 */
export type ActionType =
  | "connect"
  | "toggle-scan"
  | "start-scan"
  | "stop-scan"
  | "capture-full"
  | "capture-region";

/**
 * Action search result data
 */
export interface ActionSearchData {
  type: "action";
  actionType: ActionType;
  icon?: string;
}

/**
 * File search result data
 */
export interface FileSearchData {
  type: "file";
  sourceFile: SourceFile;
  issueCount: number;
}

/**
 * Rule search result data
 */
export interface RuleSearchData {
  type: "rule";
  rule: RuleMeta;
  enabled: boolean;
}

/**
 * Element search result data
 */
export interface ElementSearchData {
  type: "element";
  element: ScannedElement;
  issues: ESLintIssue[];
}

/**
 * Issue search result data
 */
export interface IssueSearchData {
  type: "issue";
  issue: ESLintIssue;
  elementId?: string;
  filePath: string;
  /** For file-level issues, the loc of the first element in the file (used for loc filter matching) */
  elementLoc?: string;
}

/**
 * Capture/screenshot search result data
 */
export interface CaptureSearchData {
  type: "capture";
  capture: ScreenshotCapture;
  issues: VisionIssue[];
}

/**
 * Search result with match score
 */
export interface ScoredSearchResult {
  item: SearchableItem;
  score: number;
  /** Matched indices for highlighting */
  matches?: number[];
}

/**
 * Props for keyboard navigation hook
 */
export interface KeyboardNavigationOptions {
  isOpen: boolean;
  itemCount: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * Grouped search results by category
 */
export interface GroupedSearchResults {
  settings: ScoredSearchResult[];
  vision: ScoredSearchResult[];
  rules: ScoredSearchResult[];
  captures: ScoredSearchResult[];
  files: ScoredSearchResult[];
  issues: ScoredSearchResult[];
}

/**
 * State for expanded items in the list
 */
export interface ExpandedItemState {
  /** ID of the currently expanded item (only one at a time) */
  expandedId: string | null;
}

/**
 * Item interaction callbacks
 */
export interface ItemCallbacks {
  onHover?: (itemId: string | null) => void;
  onClick?: (itemId: string) => void;
  onToggle?: (itemId: string, enabled: boolean) => void;
}

/**
 * Context for element inspection mode
 */
export interface ElementContext {
  element: Element;
  scannedElement?: ScannedElement;
  issues: ESLintIssue[];
  filePath: string;
  lineNumber: number;
}

/**
 * Filter chip for the command palette search
 * Allows filtering by rule, issue, loc (source location), file, or capture
 */
export interface CommandPaletteFilter {
  type: "rule" | "issue" | "loc" | "file" | "capture";
  value: string;
  label: string;
}
