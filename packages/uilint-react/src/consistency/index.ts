/**
 * Consistency analysis module exports for uilint-react
 */

export type {
  StyleSnapshot,
  ElementRole,
  ElementSnapshot,
  GroupedSnapshot,
  ViolationCategory,
  ViolationSeverity,
  Violation,
  ConsistencyResult,
} from "./types";

export {
  createSnapshot,
  cleanupDataElements,
  getElementBySnapshotId,
} from "./snapshot";

export { ConsistencyHighlighter } from "./highlights";
