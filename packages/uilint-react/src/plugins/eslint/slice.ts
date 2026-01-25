/**
 * ESLint Plugin State Slice (Simplified)
 *
 * Uses unified Issue type - single cache, minimal state.
 */

import type { PluginServices } from "../../core/plugin-system/types";
import type { Issue } from "../../ui/types";
import type { AvailableRule, RuleConfig } from "./types";

/** Scan status - single source of truth for scanning state */
export type ScanStatus = "idle" | "scanning" | "complete" | "error";

/**
 * ESLint plugin state
 */
export interface ESLintSlice {
  /** Issues keyed by dataLoc */
  issues: Map<string, Issue[]>;
  /** DataLocs that have been scanned */
  scannedDataLocs: Set<string>;
  /** File paths that have been requested for linting (to avoid duplicates) */
  requestedFiles: Set<string>;
  /** Current scan status - "scanning" means live scan is active */
  scanStatus: ScanStatus;
  /** Available rules from server */
  availableRules: AvailableRule[];
  /** Disabled rules (visual filtering) */
  disabledRules: Set<string>;
  /** Workspace root path */
  workspaceRoot: string | null;
  /** Current rule configurations (severity + options) */
  ruleConfigs: Map<string, RuleConfig>;
  /** Rules currently being updated */
  ruleConfigUpdating: Map<string, boolean>;
}

/**
 * ESLint plugin actions
 */
export interface ESLintActions {
  /** Start live scanning */
  startScanning: () => void;
  /** Stop scanning and clear results */
  stopScanning: () => void;
  /** Set issues for a dataLoc */
  setIssues: (dataLoc: string, issues: Issue[]) => void;
  /** Clear all issues */
  clearIssues: () => void;
  /** Toggle a rule on/off */
  toggleRule: (ruleId: string) => void;
  /** Set available rules */
  setAvailableRules: (rules: AvailableRule[]) => void;
  /** Set workspace root */
  setWorkspaceRoot: (root: string | null) => void;
  /** Mark a dataLoc as scanned */
  markScanned: (dataLoc: string) => void;
  /** Mark a file as requested for linting */
  markFileRequested: (filePath: string) => void;
  /** Set scan status */
  setScanStatus: (status: ScanStatus) => void;
}

/** Combined slice type */
export type ESLintPluginSlice = ESLintSlice & ESLintActions;

/**
 * Helper to check if scanning is active
 */
export function isScanning(status: ScanStatus): boolean {
  return status === "scanning";
}

/**
 * Initial state - scanning by default
 */
export const initialESLintState: ESLintSlice = {
  issues: new Map(),
  scannedDataLocs: new Set(),
  requestedFiles: new Set(),
  scanStatus: "scanning", // Start scanning by default
  availableRules: [],
  disabledRules: new Set(),
  workspaceRoot: null,
  ruleConfigs: new Map(),
  ruleConfigUpdating: new Map(),
};

/**
 * Create ESLint slice state
 */
export function createESLintSlice(_services: PluginServices): ESLintSlice {
  return { ...initialESLintState };
}

/**
 * Create ESLint slice actions
 */
export function createESLintActions(
  _services: PluginServices,
  getSlice: () => ESLintSlice,
  setSlice: (partial: Partial<ESLintSlice>) => void
): ESLintActions {
  return {
    startScanning: () => {
      setSlice({ scanStatus: "scanning" });
    },

    stopScanning: () => {
      setSlice({
        scanStatus: "idle",
        issues: new Map(),
        scannedDataLocs: new Set(),
        requestedFiles: new Set(),
      });
    },

    setIssues: (dataLoc: string, issues: Issue[]) => {
      const current = getSlice();
      const newIssues = new Map(current.issues);
      if (issues.length > 0) {
        newIssues.set(dataLoc, issues);
      } else {
        newIssues.delete(dataLoc);
      }
      setSlice({ issues: newIssues });
    },

    clearIssues: () => {
      setSlice({
        issues: new Map(),
        scannedDataLocs: new Set(),
        requestedFiles: new Set(),
      });
    },

    toggleRule: (ruleId: string) => {
      const current = getSlice();
      const newDisabled = new Set(current.disabledRules);
      if (newDisabled.has(ruleId)) {
        newDisabled.delete(ruleId);
      } else {
        newDisabled.add(ruleId);
      }
      setSlice({ disabledRules: newDisabled });
    },

    setAvailableRules: (rules: AvailableRule[]) => {
      setSlice({ availableRules: rules });
    },

    setWorkspaceRoot: (root: string | null) => {
      setSlice({ workspaceRoot: root });
    },

    markScanned: (dataLoc: string) => {
      const current = getSlice();
      const newScanned = new Set(current.scannedDataLocs);
      newScanned.add(dataLoc);
      setSlice({ scannedDataLocs: newScanned });
    },

    markFileRequested: (filePath: string) => {
      const current = getSlice();
      const newRequested = new Set(current.requestedFiles);
      newRequested.add(filePath);
      setSlice({ requestedFiles: newRequested });
    },

    setScanStatus: (status: ScanStatus) => {
      setSlice({ scanStatus: status });
    },
  };
}

/**
 * Filter issues by disabled rules
 */
export function filterByDisabledRules(
  issues: Issue[],
  disabledRules: Set<string>
): Issue[] {
  if (disabledRules.size === 0) return issues;
  return issues.filter((issue) => !disabledRules.has(issue.ruleId));
}
