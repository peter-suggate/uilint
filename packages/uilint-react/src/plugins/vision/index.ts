/**
 * Vision Plugin
 *
 * AI-powered visual consistency analysis plugin for UILint.
 * Captures screenshots, builds element manifests, and sends to server
 * for vision-based analysis of UI issues.
 */

import type { Plugin, PluginServices, IssueContribution } from "../../core/plugin-system/types";
import { visionCommands } from "./commands";
import type { VisionSlice } from "./slice";
import { createVisionSlice, defaultVisionState } from "./slice";
import type { VisionIssue, VisionErrorInfo, VisionStage, ScreenshotCapture } from "./types";

/**
 * Vision plugin definition
 */
export const visionPlugin: Plugin<VisionSlice> = {
  // Top-level metadata (required)
  id: "vision",
  name: "Vision Analysis",
  version: "1.0.0",
  description: "AI-powered visual consistency analysis",

  // Structured metadata (optional)
  meta: {
    id: "vision",
    name: "Vision Analysis",
    version: "1.0.0",
    description: "AI-powered visual consistency analysis",
    icon: "eye",
  },

  /**
   * Create the vision state slice
   */
  createSlice: (_services: PluginServices) => {
    // Create a minimal slice that will be integrated into the main store
    // The actual state management is handled by the store integration
    return createVisionSlice(
      () => {},
      () => defaultVisionState as VisionSlice
    );
  },

  /**
   * Commands contributed by this plugin
   */
  commands: visionCommands,

  /**
   * Inspector panels contributed by this plugin
   */
  inspectorPanels: [],

  /**
   * Per-rule UI contributions
   */
  ruleContributions: [
    {
      ruleId: "semantic-vision",
      // Custom inspector component would be added here
      // inspectorPanel: VisionIssueInspector,
    },
  ],

  /**
   * Predicate to determine if this plugin handles a specific rule
   */
  handlesRules: (ruleMeta) => {
    return (
      ruleMeta.id === "semantic-vision" ||
      ruleMeta.id.includes("vision") ||
      ruleMeta.category === "vision"
    );
  },

  /**
   * Get issues from the plugin's state for heatmap display
   */
  getIssues: (state: unknown): IssueContribution => {
    const visionState = state as VisionSlice;
    const issues = new Map<string, Array<{
      id: string;
      message: string;
      severity: "error" | "warning" | "info";
      dataLoc?: string;
      ruleId?: string;
      metadata?: Record<string, unknown>;
    }>>();

    // Convert vision issues to plugin issues format
    for (const [route, visionIssues] of visionState.visionIssuesCache) {
      for (const issue of visionIssues) {
        if (issue.dataLoc) {
          const existing = issues.get(issue.dataLoc) || [];
          existing.push({
            id: `vision:${route}:${issue.elementText}:${issue.category}`,
            message: issue.message,
            severity: issue.severity,
            dataLoc: issue.dataLoc,
            ruleId: "semantic-vision",
            metadata: {
              elementText: issue.elementText,
              category: issue.category,
              route,
            },
          });
          issues.set(issue.dataLoc, existing);
        }
      }
    }

    return {
      pluginId: "vision",
      issues,
    };
  },

  /**
   * Initialize the plugin
   */
  initialize: (services: PluginServices) => {
    const { websocket } = services;

    // Subscribe to vision:result messages
    const unsubResult = websocket.on("vision:result", (message) => {
      const data = message as {
        route: string;
        issues: VisionIssue[];
        analysisTime: number;
        error?: string;
        requestId?: string;
      };

      const state = services.getState<{
        setVisionAnalyzing: (analyzing: boolean) => void;
        setVisionProgressPhase: (phase: string | null) => void;
        setVisionLastError: (error: VisionErrorInfo | null) => void;
        setVisionResult: (result: {
          route: string;
          timestamp: number;
          manifest: [];
          issues: VisionIssue[];
          analysisTime: number;
          error?: string;
        } | null) => void;
        updateVisionIssuesCache: (route: string, issues: VisionIssue[]) => void;
        updateScreenshotInHistory: (id: string, updates: Partial<ScreenshotCapture>) => void;
        selectedScreenshotId: string | null;
      }>();

      // Update issues cache
      state.updateVisionIssuesCache(data.route, data.issues);

      // Update result
      state.setVisionResult({
        route: data.route,
        timestamp: Date.now(),
        manifest: [],
        issues: data.issues,
        analysisTime: data.analysisTime,
        error: data.error,
      });

      // Update screenshot with issues if we have a selected one
      if (state.selectedScreenshotId) {
        state.updateScreenshotInHistory(state.selectedScreenshotId, {
          issues: data.issues,
        });
      }

      // Clear analyzing state
      state.setVisionAnalyzing(false);
      state.setVisionProgressPhase(null);

      // Set error if present
      if (data.error) {
        state.setVisionLastError({
          stage: "vision" as VisionStage,
          message: data.error,
          route: data.route,
          timestamp: Date.now(),
        });
      }
    });

    // Subscribe to vision:progress messages
    const unsubProgress = websocket.on("vision:progress", (message) => {
      const data = message as { phase: string };
      const state = services.getState<{
        setVisionProgressPhase: (phase: string | null) => void;
      }>();
      state.setVisionProgressPhase(data.phase);
    });

    // Return cleanup function
    return () => {
      unsubResult();
      unsubProgress();
    };
  },
};

// Re-export types for convenience
export type {
  VisionIssue,
  ScreenshotCapture,
  VisionAutoScanSettings,
  VisionErrorInfo,
  VisionStage,
  CaptureMode,
  CaptureRegion,
  ElementManifest,
  VisionAnalysisResult,
} from "./types";

export { visionCommands } from "./commands";
export type { VisionSlice, VisionSliceState, VisionSliceActions } from "./slice";
export { createVisionSlice, defaultVisionState, loadVisionAutoScanSettings, saveVisionAutoScanSettings } from "./slice";

export default visionPlugin;
