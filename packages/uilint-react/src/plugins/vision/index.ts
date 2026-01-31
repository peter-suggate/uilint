/**
 * Vision Plugin
 *
 * AI-powered visual consistency analysis plugin for UILint.
 * Captures screenshots, builds element manifests, and sends to server
 * for vision-based analysis of UI issues.
 */

import React from "react";
import type { Plugin, PluginServices, IssueContribution, ToolbarAction, ToolbarActionGroup, CategoryProvider, CategoryItem } from "../../core/plugin-system/types";
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

/**
 * Individual toolbar actions for the vision plugin (used inside the group dropdown)
 */
const visionCaptureFullAction: ToolbarAction = {
  id: "vision:capture-full-page",
  icon: CameraIcon,
  tooltip: "Capture Full Page",
  shortcut: "\u2318\u21e7C",
  priority: 100,
  isVisible: (state: unknown) => {
    const s = state as { plugins?: { vision?: { visionAvailable?: boolean } } };
    return s.plugins?.vision?.visionAvailable === true;
  },
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
  isVisible: (state: unknown) => {
    const s = state as { plugins?: { vision?: { visionAvailable?: boolean } } };
    return s.plugins?.vision?.visionAvailable === true;
  },
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
 * Toolbar action group for the vision plugin
 * Renders as a single dropdown button with capture options
 */
const visionToolbarActionGroup: ToolbarActionGroup = {
  id: "vision:capture-group",
  icon: CameraIcon,
  tooltip: "Vision Capture",
  priority: 100,
  isVisible: (state: unknown) => {
    const s = state as { plugins?: { vision?: { visionAvailable?: boolean } } };
    return s.plugins?.vision?.visionAvailable === true;
  },
  actions: [visionCaptureFullAction, visionCaptureRegionAction],
};

/**
 * Create category providers for the vision plugin.
 * Provides categories in the sidebar for vision commands and captures.
 */
function createVisionCategoryProviders(): CategoryProvider[] {
  return [
    // Commands category - always visible
    {
      id: "vision:commands",
      label: "Commands",
      priority: 1, // Commands shown first
      parentId: "vision",

      getItems: (services: PluginServices): CategoryItem[] => {
        // Get full state to pass to isAvailable checks
        // Commands expect different state shapes for their availability checks
        const fullState = services.getState<{
          plugins?: { vision?: VisionSlice };
          screenshotHistory?: Map<string, unknown>;
          autoScanSettings?: { vision?: { onRouteChange?: boolean } };
        }>();

        // Build a unified state object for isAvailable checks
        // Some commands check fullState.plugins.vision.*, others check fullState.screenshotHistory
        const unifiedState = {
          ...fullState,
          // Pull up vision state properties for commands that expect them at root
          screenshotHistory: fullState.plugins?.vision?.screenshotHistory ?? new Map(),
          autoScanSettings: fullState.autoScanSettings ?? { vision: { onRouteChange: false } },
        };

        // Filter commands based on availability
        return visionCommands
          .filter((cmd) => !cmd.isAvailable || cmd.isAvailable(unifiedState))
          .map((cmd): CategoryItem => ({
            id: cmd.id,
            title: cmd.title,
            subtitle: cmd.subtitle,
            priority: 1,
            metadata: {
              category: cmd.category,
              keywords: cmd.keywords,
            },
            execute: (svc) => {
              cmd.execute(svc);
            },
          }));
      },

      getItemCount: (services: PluginServices): number => {
        // Get full state to pass to isAvailable checks
        const fullState = services.getState<{
          plugins?: { vision?: VisionSlice };
          screenshotHistory?: Map<string, unknown>;
          autoScanSettings?: { vision?: { onRouteChange?: boolean } };
        }>();

        // Build a unified state object for isAvailable checks
        const unifiedState = {
          ...fullState,
          screenshotHistory: fullState.plugins?.vision?.screenshotHistory ?? new Map(),
          autoScanSettings: fullState.autoScanSettings ?? { vision: { onRouteChange: false } },
        };

        return visionCommands.filter(
          (cmd) => !cmd.isAvailable || cmd.isAvailable(unifiedState)
        ).length;
      },

      searchKeys: ["title", "subtitle"],
    },

    // Captures category - shows screenshot captures
    {
      id: "vision:captures",
      label: "Captures",
      priority: 2, // Captures shown after commands
      parentId: "vision",

      getItems: (services: PluginServices): CategoryItem[] => {
        const fullState = services.getState<{
          plugins?: { vision?: VisionSlice };
        }>();

        const screenshotHistory = fullState.plugins?.vision?.screenshotHistory;
        if (!screenshotHistory || screenshotHistory.size === 0) {
          return [];
        }

        // Convert captures to category items
        const captures = Array.from(screenshotHistory.values()) as ScreenshotCapture[];

        // Sort by timestamp (most recent first)
        captures.sort((a, b) => b.timestamp - a.timestamp);

        return captures.map((capture): CategoryItem => {
          const issueCount = capture.issues?.length ?? 0;
          const hasIssues = issueCount > 0;
          const subtitle = hasIssues
            ? `${capture.route} • ${issueCount} issue${issueCount > 1 ? "s" : ""}`
            : capture.route;

          return {
            id: `vision:capture:${capture.id}`,
            title: formatCaptureTitle(capture),
            subtitle,
            priority: hasIssues ? 0 : 1, // Captures with issues shown first
            metadata: {
              captureId: capture.id,
              route: capture.route,
              timestamp: capture.timestamp,
              type: capture.type,
              issueCount,
            },
            execute: (svc) => {
              // Select the capture in the gallery
              const state = svc.getState<{ plugins?: { vision?: VisionSlice } }>();
              state.plugins?.vision?.setSelectedScreenshotId(capture.id);
              // Open inspector to show the capture
              svc.openInspector("capture", { capture });
              svc.closeCommandPalette();
            },
          };
        });
      },

      getItemCount: (services: PluginServices): number => {
        const fullState = services.getState<{
          plugins?: { vision?: VisionSlice };
        }>();

        return fullState.plugins?.vision?.screenshotHistory?.size ?? 0;
      },

      searchKeys: ["title", "subtitle"],
    },
  ];
}

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
   * Category providers for command palette sidebar
   */
  categoryProviders: createVisionCategoryProviders(),

  /**
   * Toolbar action groups contributed by this plugin (shown as dropdown in FloatingIcon)
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
