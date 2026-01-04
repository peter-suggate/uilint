"use client";

/**
 * UILint Zustand Store
 *
 * Centralized state management for UILint with synchronous updates.
 * Solves the React 18 batching issue that causes scan results to chunk together.
 */

import { create } from "zustand";
import type {
  UILintSettings,
  LocatorTarget,
  InspectedElement,
  AutoScanState,
  ElementIssue,
  ManualScanResult,
  ScannedElement,
  SourceFile,
  ScanIssue,
} from "./types";
import { DEFAULT_SETTINGS, DEFAULT_AUTO_SCAN_STATE } from "./types";
import { scanDOMForSources, groupBySourceFile } from "./fiber-utils";

/**
 * UILint Store State and Actions
 */
export interface UILintStore {
  // ============ Settings ============
  settings: UILintSettings;
  updateSettings: (partial: Partial<UILintSettings>) => void;

  // ============ Locator Mode ============
  altKeyHeld: boolean;
  setAltKeyHeld: (held: boolean) => void;
  locatorTarget: LocatorTarget | null;
  setLocatorTarget: (target: LocatorTarget | null) => void;
  locatorStackIndex: number;
  setLocatorStackIndex: (index: number) => void;
  locatorGoUp: () => void;
  locatorGoDown: () => void;

  // ============ Inspection ============
  inspectedElement: InspectedElement | null;
  setInspectedElement: (el: InspectedElement | null) => void;

  // ============ Manual Scan (InspectionPanel) ============
  manualScanCache: Map<string, ManualScanResult>;
  upsertManualScan: (key: string, patch: Partial<ManualScanResult>) => void;
  clearManualScan: (key: string) => void;

  // ============ Auto-Scan ============
  autoScanState: AutoScanState;
  elementIssuesCache: Map<string, ElementIssue>;
  scanLock: boolean;
  scanPaused: boolean;
  scanAborted: boolean;

  // Scan actions
  startAutoScan: (hideNodeModules: boolean) => Promise<void>;
  pauseAutoScan: () => void;
  resumeAutoScan: () => void;
  stopAutoScan: () => void;
  updateElementIssue: (id: string, issue: ElementIssue) => void;

  // ============ Internal ============
  _setScanState: (state: Partial<AutoScanState>) => void;
  _runScanLoop: (
    elements: ScannedElement[],
    startIndex: number
  ) => Promise<void>;
}

/**
 * Extract data-loc value from an element's id
 * Element IDs are in format "loc:path:line:column" when they have data-loc
 */
function getDataLocFromId(id: string): string | null {
  if (id.startsWith("loc:")) {
    return id.slice(4); // Remove "loc:" prefix
  }
  return null;
}

/**
 * Scan an entire source file for issues
 * Returns issues with dataLoc values for matching to elements
 */
async function scanFileForIssues(
  sourceFile: SourceFile
): Promise<{ issues: ScanIssue[]; error?: boolean }> {
  if (sourceFile.elements.length === 0) {
    return { issues: [] };
  }

  const filePath = sourceFile.path;

  try {
    // Fetch source code once for the whole file
    const sourceResponse = await fetch(
      `/api/.uilint/source?path=${encodeURIComponent(filePath)}`
    );

    if (!sourceResponse.ok) {
      return { issues: [], error: true };
    }

    const sourceData = await sourceResponse.json();

    // Collect all data-loc values from elements in this file
    const dataLocs: string[] = [];
    for (const el of sourceFile.elements) {
      const dataLoc = getDataLocFromId(el.id);
      if (dataLoc) {
        dataLocs.push(dataLoc);
      }
    }

    // Analyze with LLM - one call for the entire file
    const analyzeResponse = await fetch("/api/.uilint/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceCode: sourceData.content,
        filePath: sourceData.relativePath || filePath,
        dataLocs,
      }),
    });

    if (!analyzeResponse.ok) {
      return { issues: [], error: true };
    }

    const result = await analyzeResponse.json();
    return { issues: result.issues || [] };
  } catch {
    return { issues: [], error: true };
  }
}

/**
 * Match issues to elements by dataLoc and update the cache
 */
function distributeIssuesToElements(
  issues: ScanIssue[],
  elements: ScannedElement[],
  updateElementIssue: (id: string, issue: ElementIssue) => void,
  hasError: boolean
): void {
  // Create a map from dataLoc to element ID for quick lookup
  const dataLocToElementId = new Map<string, string>();
  for (const el of elements) {
    const dataLoc = getDataLocFromId(el.id);
    if (dataLoc) {
      dataLocToElementId.set(dataLoc, el.id);
    }
  }

  // Group issues by element
  const issuesByElement = new Map<string, ScanIssue[]>();
  for (const issue of issues) {
    if (issue.dataLoc) {
      const elementId = dataLocToElementId.get(issue.dataLoc);
      if (elementId) {
        const existing = issuesByElement.get(elementId) || [];
        existing.push(issue);
        issuesByElement.set(elementId, existing);
      }
    }
  }

  // Update each element with its issues
  for (const el of elements) {
    const elementIssues = issuesByElement.get(el.id) || [];
    updateElementIssue(el.id, {
      elementId: el.id,
      issues: elementIssues,
      status: hasError ? "error" : "complete",
    });
  }
}

/**
 * Create the UILint store
 */
export const useUILintStore = create<UILintStore>()((set, get) => ({
  // ============ Settings ============
  settings: DEFAULT_SETTINGS,
  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),

  // ============ Locator Mode ============
  altKeyHeld: false,
  setAltKeyHeld: (held) => set({ altKeyHeld: held }),
  locatorTarget: null,
  setLocatorTarget: (target) => set({ locatorTarget: target }),
  locatorStackIndex: 0,
  setLocatorStackIndex: (index) => set({ locatorStackIndex: index }),

  locatorGoUp: () => {
    const { locatorTarget, locatorStackIndex } = get();
    if (!locatorTarget) return;
    const maxIndex = locatorTarget.componentStack.length;
    set({ locatorStackIndex: Math.min(locatorStackIndex + 1, maxIndex) });
  },

  locatorGoDown: () => {
    const { locatorStackIndex } = get();
    set({ locatorStackIndex: Math.max(locatorStackIndex - 1, 0) });
  },

  // ============ Inspection ============
  inspectedElement: null,
  setInspectedElement: (el) => set({ inspectedElement: el }),

  // ============ Manual Scan (InspectionPanel) ============
  manualScanCache: new Map(),
  upsertManualScan: (key, patch) =>
    set((state) => {
      const next = new Map(state.manualScanCache);
      const existing = next.get(key);
      const base: ManualScanResult = existing ?? {
        key,
        status: "idle",
        issues: [],
        updatedAt: Date.now(),
      };
      next.set(key, {
        ...base,
        ...patch,
        key,
        updatedAt: Date.now(),
      });
      return { manualScanCache: next };
    }),
  clearManualScan: (key) =>
    set((state) => {
      if (!state.manualScanCache.has(key)) return state;
      const next = new Map(state.manualScanCache);
      next.delete(key);
      return { manualScanCache: next };
    }),

  // ============ Auto-Scan ============
  autoScanState: DEFAULT_AUTO_SCAN_STATE,
  elementIssuesCache: new Map(),
  scanLock: false,
  scanPaused: false,
  scanAborted: false,

  _setScanState: (partial) =>
    set((state) => ({
      autoScanState: { ...state.autoScanState, ...partial },
    })),

  updateElementIssue: (id, issue) =>
    set((state) => {
      const newCache = new Map(state.elementIssuesCache);
      newCache.set(id, issue);
      return { elementIssuesCache: newCache };
    }),

  startAutoScan: async (hideNodeModules) => {
    const state = get();

    // Prevent concurrent scans
    if (state.scanLock) {
      console.warn("UILint: Scan already in progress");
      return;
    }

    // Acquire lock
    set({
      scanLock: true,
      scanPaused: false,
      scanAborted: false,
    });

    // Get all scannable elements
    const elements = scanDOMForSources(document.body, hideNodeModules);

    // Initialize cache with pending status
    const initialCache = new Map<string, ElementIssue>();
    for (const el of elements) {
      initialCache.set(el.id, {
        elementId: el.id,
        issues: [],
        status: "pending",
      });
    }

    // Set initial state synchronously
    set({
      elementIssuesCache: initialCache,
      autoScanState: {
        status: "scanning",
        currentIndex: 0,
        totalElements: elements.length,
        elements,
      },
    });

    // Start the scan loop
    await get()._runScanLoop(elements, 0);
  },

  pauseAutoScan: () => {
    set({ scanPaused: true });
    get()._setScanState({ status: "paused" });
  },

  resumeAutoScan: () => {
    const state = get();
    if (state.autoScanState.status !== "paused") return;

    set({ scanPaused: false });
    get()._setScanState({ status: "scanning" });

    // Resume from current index
    get()._runScanLoop(
      state.autoScanState.elements,
      state.autoScanState.currentIndex
    );
  },

  stopAutoScan: () => {
    set({
      scanAborted: true,
      scanPaused: false,
      scanLock: false,
      autoScanState: DEFAULT_AUTO_SCAN_STATE,
      elementIssuesCache: new Map(),
    });
  },

  _runScanLoop: async (elements, startIndex) => {
    // Group elements by source file for per-file scanning
    const sourceFiles = groupBySourceFile(elements);

    // Track progress - we scan files, but show element progress
    let processedElements = 0;

    // Skip to the file containing startIndex element (for resume)
    let skipElements = startIndex;

    for (const sourceFile of sourceFiles) {
      // Skip files if resuming
      if (skipElements >= sourceFile.elements.length) {
        skipElements -= sourceFile.elements.length;
        processedElements += sourceFile.elements.length;
        continue;
      }
      skipElements = 0;

      // Check abort - use get() for fresh state
      if (get().scanAborted) {
        set({
          scanLock: false,
          autoScanState: { ...get().autoScanState, status: "idle" },
        });
        return;
      }

      // Check pause - use get() for fresh state
      while (get().scanPaused) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (get().scanAborted) {
          set({
            scanLock: false,
            autoScanState: { ...get().autoScanState, status: "idle" },
          });
          return;
        }
      }

      // Update progress
      get()._setScanState({ currentIndex: processedElements });

      // Mark all elements in this file as scanning
      for (const el of sourceFile.elements) {
        get().updateElementIssue(el.id, {
          elementId: el.id,
          issues: [],
          status: "scanning",
        });
      }

      // Yield to browser to show "scanning" state
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Scan the entire file once
      const { issues, error } = await scanFileForIssues(sourceFile);

      // Distribute issues to elements by matching dataLoc
      distributeIssuesToElements(
        issues,
        sourceFile.elements,
        get().updateElementIssue,
        error ?? false
      );

      processedElements += sourceFile.elements.length;

      // Yield to browser to render the badge updates
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    // Complete - release lock
    set({
      scanLock: false,
      autoScanState: {
        ...get().autoScanState,
        status: "complete",
        currentIndex: elements.length,
      },
    });
  },
}));

/**
 * Hook to get effective locator target with stack index applied
 */
export function useEffectiveLocatorTarget(): LocatorTarget | null {
  const locatorTarget = useUILintStore((s: UILintStore) => s.locatorTarget);
  const locatorStackIndex = useUILintStore(
    (s: UILintStore) => s.locatorStackIndex
  );

  if (!locatorTarget) return null;
  return {
    ...locatorTarget,
    stackIndex: locatorStackIndex,
  };
}
