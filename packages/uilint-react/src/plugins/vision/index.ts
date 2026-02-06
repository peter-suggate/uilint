/**
 * Vision Plugin
 *
 * AI-powered visual consistency analysis plugin for UILint.
 * Captures screenshots, builds element manifests, and sends to server
 * for vision-based analysis of UI issues.
 */

import React from "react";
import type { Plugin, PluginServices, IssueContribution, ToolbarAction, ToolbarActionGroup, PaletteItem } from "../../core/plugin-system/types";
import { visionCommands } from "./commands";
import type { VisionSlice } from "./slice";
import { createVisionSlice, createTriggerVisionAnalysis } from "./slice";
import type { VisionIssue, VisionErrorInfo, VisionStage, ScreenshotCapture } from "./types";

// Camera icon for full page capture
const CameraIcon = React.createElement(
  "svg",
  {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
  },
  React.createElement("path", {
    d: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z",
  }),
  React.createElement("circle", { cx: "12", cy: "13", r: "4" })
);

// Crop/region icon
const CropIcon = React.createElement(
  "svg",
  {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
  },
  React.createElement("path", { d: "M6.13 1L6 16a2 2 0 0 0 2 2h15" }),
  React.createElement("path", { d: "M1 6.13L16 6a2 2 0 0 1 2 2v15" })
);

// Alert circle icon for setup required
const AlertCircleIcon = React.createElement(
  "svg",
  {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
  },
  React.createElement("circle", { cx: "12", cy: "12", r: "10" }),
  React.createElement("line", { x1: "12", y1: "8", x2: "12", y2: "12" }),
  React.createElement("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })
);

/**
 * Helper to check if vision is available from state
 */
function isVisionAvailable(state: unknown): boolean {
  const s = state as { plugins?: { vision?: { visionAvailable?: boolean } } };
  return s.plugins?.vision?.visionAvailable === true;
}

/**
 * Individual toolbar actions for the vision plugin (used inside the group dropdown)
 */
const visionCaptureFullAction: ToolbarAction = {
  id: "vision:capture-full-page",
  icon: CameraIcon,
  tooltip: "Capture Full Page",
  shortcut: "\u2318\u21e7C",
  priority: 100,
  isVisible: isVisionAvailable,
  onClick: async (services: PluginServices) => {
    const fullState = services.getState<{
      plugins: {
        vision: {
          setCaptureMode: (mode: "full" | "region") => void;
          setRegionSelectionActive: (active: boolean) => void;
          setSelectedRegion: (region: null) => void;
          triggerVisionAnalysis: () => Promise<void>;
        };
      };
    }>();

    const visionState = fullState.plugins.vision;
    visionState.setCaptureMode("full");
    visionState.setRegionSelectionActive(false);
    visionState.setSelectedRegion(null);

    await visionState.triggerVisionAnalysis();
  },
};

const visionCaptureRegionAction: ToolbarAction = {
  id: "vision:capture-region",
  icon: CropIcon,
  tooltip: "Capture Region",
  shortcut: "\u2318\u21e7R",
  priority: 90,
  isVisible: isVisionAvailable,
  onClick: (services: PluginServices) => {
    const fullState = services.getState<{
      plugins: {
        vision: {
          setCaptureMode: (mode: "full" | "region") => void;
          setRegionSelectionActive: (active: boolean) => void;
          setSelectedRegion: (region: null) => void;
        };
      };
    }>();

    const visionState = fullState.plugins.vision;
    visionState.setCaptureMode("region");
    visionState.setRegionSelectionActive(true);
    visionState.setSelectedRegion(null);
  },
};

/**
 * Setup action shown when vision is unavailable
 * Opens Ollama download page and shows setup instructions
 */
const visionSetupAction: ToolbarAction = {
  id: "vision:setup",
  icon: AlertCircleIcon,
  tooltip: "Vision requires Ollama - Click to learn more",
  priority: 100,
  isVisible: (state: unknown) => !isVisionAvailable(state),
  onClick: () => {
    // Open Ollama download page in new tab
    window.open("https://ollama.com/download", "_blank", "noopener,noreferrer");

    // Also log instructions to console for developers
    console.info(
      "%c📷 UILint Vision Setup",
      "font-weight: bold; font-size: 14px;",
      "\n\nTo enable AI-powered vision analysis:\n" +
      "1. Install Ollama from https://ollama.com/download\n" +
      "2. Start Ollama: ollama serve\n" +
      "3. Pull the vision model: ollama pull qwen3-vl:8b-instruct\n" +
      "4. Refresh this page\n\n" +
      "The camera button will appear once Ollama is running."
    );
  },
};

/**
 * Toolbar action group for the vision plugin
 * Always visible - shows setup action when unavailable, capture actions when available
 */
const visionToolbarActionGroup: ToolbarActionGroup = {
  id: "vision:capture-group",
  icon: CameraIcon,
  tooltip: "Vision Capture",
  priority: 100,
  // Always visible - child actions control their own visibility
  isVisible: () => true,
  actions: [visionSetupAction, visionCaptureFullAction, visionCaptureRegionAction],
};

/**
 * Format a capture title for display
 */
function formatCaptureTitle(capture: ScreenshotCapture): string {
  const date = new Date(capture.timestamp);
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const typeLabel = capture.type === "region" ? "Region" : "Full Page";
  return `${typeLabel} • ${timeStr}`;
}

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
  createSlice: (services: PluginServices) => {
    // Create a local slice variable to track state during initialization
    // This follows the same pattern as the ESLint plugin
    let slice: VisionSlice;

    const getSlice = () => slice;
    const setSlice = <T>(partial: T | Partial<T>) => {
      slice = { ...slice, ...(partial as Partial<VisionSlice>) };
      services.setState(partial as Partial<VisionSlice>);
    };

    // Create the slice with the proper set/get functions
    slice = createVisionSlice(setSlice, getSlice);

    return slice;
  },

  /**
   * Commands contributed by this plugin
   */
  commands: visionCommands,

  /**
   * Toolbar action groups contributed by this plugin
   */
  toolbarActionGroups: [visionToolbarActionGroup],

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
   * Get palette items for the command palette (keyword-based system).
   * Returns commands and captures as PaletteItems.
   */
  getPaletteItems: (services: PluginServices): PaletteItem[] => {
    const items: PaletteItem[] = [];

    // Get the full store state
    const fullState = services.getState<{
      plugins?: { vision?: VisionSlice };
      screenshotHistory?: Map<string, unknown>;
      autoScanSettings?: { vision?: { onRouteChange?: boolean } };
    }>();

    const visionState = fullState.plugins?.vision;

    // Build unified state for command availability checks
    const unifiedState = {
      ...fullState,
      screenshotHistory: visionState?.screenshotHistory ?? new Map(),
      autoScanSettings: fullState.autoScanSettings ?? { vision: { onRouteChange: false } },
    };

    // Add commands as palette items
    for (const cmd of visionCommands) {
      if (cmd.isAvailable && !cmd.isAvailable(unifiedState)) {
        continue;
      }

      items.push({
        id: cmd.id,
        title: cmd.title,
        subtitle: cmd.subtitle,
        keywords: ["Command", "Vision", ...cmd.keywords],
        execute: cmd.execute,
        metadata: { isCommand: true },
      });
    }

    // Add captures as palette items
    const screenshotHistory = visionState?.screenshotHistory;
    if (screenshotHistory && screenshotHistory.size > 0) {
      const captures = Array.from(screenshotHistory.values()) as ScreenshotCapture[];

      // Sort by timestamp (most recent first)
      captures.sort((a, b) => b.timestamp - a.timestamp);

      for (const capture of captures) {
        const issueCount = capture.issues?.length ?? 0;
        const hasIssues = issueCount > 0;
        const subtitle = hasIssues
          ? `${capture.route} • ${issueCount} issue${issueCount > 1 ? "s" : ""}`
          : capture.route;

        items.push({
          id: `vision:capture:${capture.id}`,
          title: formatCaptureTitle(capture),
          subtitle,
          keywords: [
            "Vision",
            "Capture",
            capture.type === "region" ? "Region" : "Full Page",
            capture.route,
            ...(hasIssues ? ["Issues"] : []),
          ],
          execute: (svc) => {
            const state = svc.getState<{ plugins?: { vision?: VisionSlice } }>();
            state.plugins?.vision?.setSelectedScreenshotId(capture.id);
            svc.openInspector("capture", { capture });
            svc.closeCommandPalette();
          },
          metadata: {
            captureId: capture.id,
            route: capture.route,
            timestamp: capture.timestamp,
            type: capture.type,
            issueCount,
            providerId: "vision",
          },
        });
      }
    }

    return items;
  },

  /**
   * Initialize the plugin
   */
  initialize: (services: PluginServices) => {
    const { websocket } = services;

    // Wire up the triggerVisionAnalysis function with services
    const triggerVisionAnalysis = createTriggerVisionAnalysis(services);
    services.setState<Partial<VisionSlice>>({ triggerVisionAnalysis });

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

    // Subscribe to vision:status messages (response to vision:check)
    const unsubStatus = websocket.on("vision:status", (message) => {
      const data = message as { available: boolean; model?: string };
      const state = services.getState<{
        setVisionAvailable: (available: boolean) => void;
      }>();
      state.setVisionAvailable(data.available);
    });

    // Subscribe to WebSocket connection changes
    const unsubConnection = websocket.onConnectionChange((connected) => {
      const state = services.getState<{
        setVisionAvailable: (available: boolean) => void;
      }>();

      if (connected) {
        // Send vision:check message to query LLM availability
        websocket.send({ type: "vision:check" });
      } else {
        // Set vision unavailable on disconnect
        state.setVisionAvailable(false);
      }
    });

    // Return cleanup function
    return () => {
      unsubResult();
      unsubProgress();
      unsubStatus();
      unsubConnection();
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
