/**
 * Vision Plugin Action Handlers
 *
 * Plain functions that handle plugin actions.
 * No React - uses PluginContext for state management.
 */

import type { ActionHandlers, PluginContext } from "uilint-core";
import type { VisionState } from "./state.js";
import type {
  VisionIssue,
  ScreenshotCapture,
  CaptureRegion,
  VisionAutoScanSettings,
} from "../types.js";

// Helper type for cleaner action handler definitions
type Handler<TPayload = void> = (
  ctx: PluginContext<VisionState>,
  payload: TPayload
) => void | Promise<void>;

// Cast helper for proper typing - wraps typed handlers to satisfy ActionHandlers
const h = <TPayload = void>(fn: Handler<TPayload>): Handler<unknown> =>
  fn as Handler<unknown>;

/**
 * Action handlers for the vision plugin
 */
export const visionActionHandlers: ActionHandlers<VisionState> = {
  /**
   * Set vision availability status
   */
  "set-vision-available": h<{ available: boolean; model?: string }>((ctx, payload) => {
    ctx.setState({
      visionAvailable: payload.available,
      visionModel: payload.model ?? null,
    });
  }),

  /**
   * Trigger full page capture
   */
  "capture-full-page": h(async (ctx) => {
    ctx.setState({
      captureMode: "full",
      regionSelectionActive: false,
      selectedRegion: null,
    });
    await ctx.dispatch("trigger-vision-analysis");
  }),

  /**
   * Enter region selection mode
   */
  "enter-region-selection": h((ctx) => {
    ctx.setState({
      captureMode: "region",
      regionSelectionActive: true,
      selectedRegion: null,
    });
  }),

  /**
   * Exit region selection mode
   */
  "exit-region-selection": h((ctx) => {
    ctx.setState({
      regionSelectionActive: false,
      selectedRegion: null,
    });
  }),

  /**
   * Set selected region and trigger capture
   */
  "set-selected-region": h<{ region: CaptureRegion }>(async (ctx, payload) => {
    ctx.setState({
      selectedRegion: payload.region,
      regionSelectionActive: false,
    });
    await ctx.dispatch("trigger-vision-analysis");
  }),

  /**
   * Trigger vision analysis
   * Requests browser actions for capture and manifest, then sends to server
   */
  "trigger-vision-analysis": h(async (ctx) => {
    const state = ctx.getState();

    if (!state.visionAvailable) {
      ctx.setState({
        lastError: {
          stage: "vision",
          message: "Vision analysis not available. Check Ollama connection.",
          route: ctx.getCurrentRoute(),
          timestamp: Date.now(),
        },
      });
      return;
    }

    ctx.setState({
      visionAnalyzing: true,
      visionProgressPhase: "capture",
      lastError: null,
    });

    try {
      // Request screenshot capture from browser
      const captureResult = await ctx.requestBrowserAction("capture-screenshot", {
        mode: state.captureMode,
        region: state.selectedRegion,
      });

      if (!captureResult.success) {
        throw new Error(captureResult.error || "Failed to capture screenshot");
      }

      ctx.setState({ visionProgressPhase: "manifest" });

      // Request manifest collection from browser
      const manifestResult = await ctx.requestBrowserAction("collect-manifest", {
        region: state.selectedRegion,
      });

      if (!manifestResult.success) {
        throw new Error(manifestResult.error || "Failed to collect manifest");
      }

      ctx.setState({ visionProgressPhase: "analyzing" });

      const route = ctx.getCurrentRoute();
      const timestamp = Date.now();

      // Add to screenshot history
      const capture: ScreenshotCapture = {
        id: `capture-${timestamp}`,
        route,
        dataUrl: captureResult.dataUrl as string,
        timestamp,
        type: state.captureMode,
        region: state.selectedRegion ?? undefined,
      };

      const newHistory = new Map(state.screenshotHistory);
      newHistory.set(capture.id, capture);
      ctx.setState({ screenshotHistory: newHistory });

      // Send to server for analysis
      ctx.websocket.send({
        type: "vision:analyze",
        route,
        timestamp,
        screenshot: captureResult.dataUrl,
        manifest: manifestResult.elements,
      });
    } catch (error) {
      ctx.setState({
        visionAnalyzing: false,
        visionProgressPhase: null,
        lastError: {
          stage: "capture",
          message: error instanceof Error ? error.message : "Unknown error",
          route: ctx.getCurrentRoute(),
          timestamp: Date.now(),
        },
      });
    }
  }),

  /**
   * Handle vision analysis result from server
   */
  "handle-vision-result": h<{
    route: string;
    issues: VisionIssue[];
    analysisTime?: number;
    error?: string;
  }>((ctx, payload) => {
    const state = ctx.getState();

    if (payload.error) {
      ctx.setState({
        visionAnalyzing: false,
        visionProgressPhase: null,
        lastError: {
          stage: "vision",
          message: payload.error,
          route: payload.route,
          timestamp: Date.now(),
        },
      });
      return;
    }

    // Update issues cache
    const newCache = new Map(state.visionIssuesCache);
    newCache.set(payload.route, payload.issues);

    // Update the latest capture with issues
    const latestCapture = Array.from(state.screenshotHistory.values())
      .filter((c) => c.route === payload.route)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (latestCapture) {
      const newHistory = new Map(state.screenshotHistory);
      newHistory.set(latestCapture.id, { ...latestCapture, issues: payload.issues });
      ctx.setState({ screenshotHistory: newHistory });
    }

    ctx.setState({
      visionAnalyzing: false,
      visionProgressPhase: null,
      visionIssuesCache: newCache,
      lastError: null,
    });
  }),

  /**
   * Handle vision progress update
   */
  "handle-vision-progress": h<{ phase: string }>((ctx, payload) => {
    ctx.setState({ visionProgressPhase: payload.phase });
  }),

  /**
   * Clear all screenshots and cached issues
   */
  "clear-screenshots": h((ctx) => {
    ctx.setState({
      screenshotHistory: new Map(),
      visionIssuesCache: new Map(),
    });
  }),

  /**
   * Delete a specific screenshot
   */
  "delete-screenshot": h<{ id: string }>((ctx, payload) => {
    const state = ctx.getState();
    const newHistory = new Map(state.screenshotHistory);
    newHistory.delete(payload.id);
    ctx.setState({ screenshotHistory: newHistory });
  }),

  /**
   * Update auto-scan settings
   */
  "update-auto-scan-settings": h<Partial<VisionAutoScanSettings>>((ctx, payload) => {
    const state = ctx.getState();
    ctx.setState({
      autoScanSettings: { ...state.autoScanSettings, ...payload },
    });
  }),

  /**
   * Focus an issue in the heatmap
   */
  "focus-heatmap": h<{ dataLoc: string }>((ctx, payload) => {
    ctx.setHeatmapFilter([payload.dataLoc], "Vision Issue");
  }),

  /**
   * Clear heatmap filter
   */
  "clear-heatmap-filter": h((ctx) => {
    ctx.clearHeatmapFilter();
  }),

  /**
   * Open file in editor
   */
  "open-editor": h<{ dataLoc: string }>((ctx, payload) => {
    ctx.openInEditor(payload.dataLoc);
  }),

  /**
   * Select a capture to view in inspector
   */
  "select-capture": h<{ captureId: string }>((ctx, payload) => {
    const state = ctx.getState();
    const capture = state.screenshotHistory.get(payload.captureId);
    if (capture) {
      ctx.openInspector("vision-gallery", { capture });
    }
  }),
};
