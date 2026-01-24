/**
 * ESLint Plugin State Slice (Simplified)
 *
 * Uses unified Issue type - single cache, minimal state.
 */

import type { PluginServices } from "../../core/plugin-system/types";
import type { Issue } from "../../ui/types";
import type { AvailableRule } from "./types";

/** Scan status */
export type ScanStatus = "idle" | "scanning" | "complete" | "error";

/**
 * ESLint plugin state
 */
export interface ESLintSlice {
  /** Issues keyed by dataLoc */
  issues: Map<string, Issue[]>;
  /** DataLocs that have been scanned */
  scannedDataLocs: Set<string>;
  /** Whether live scanning is enabled */
  liveScanEnabled: boolean;
  /** Current scan status */
  scanStatus: ScanStatus;
  /** Available rules from server */
  availableRules: AvailableRule[];
  /** Disabled rules (visual filtering) */
  disabledRules: Set<string>;
  /** Workspace root path */
  workspaceRoot: string | null;
}

/**
 * ESLint plugin actions
 */
export interface ESLintActions {
  /** Enable live scanning */
  enableLiveScan: () => void;
  /** Disable live scanning and clear results */
  disableLiveScan: () => void;
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
  /** Set scan status */
  setScanStatus: (status: ScanStatus) => void;
}

/** Combined slice type */
export type ESLintPluginSlice = ESLintSlice & ESLintActions;

/**
 * Initial state
 */
export const initialESLintState: ESLintSlice = {
  issues: new Map(),
  scannedDataLocs: new Set(),
  liveScanEnabled: false,
  scanStatus: "idle",
  availableRules: [],
  disabledRules: new Set(),
  workspaceRoot: null,
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
    enableLiveScan: () => {
      setSlice({
        liveScanEnabled: true,
        scanStatus: "scanning",
      });
    },

    disableLiveScan: () => {
      setSlice({
        liveScanEnabled: false,
        scanStatus: "idle",
        issues: new Map(),
        scannedDataLocs: new Set(),
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
