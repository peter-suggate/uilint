/**
 * Vision Plugin Commands
 *
 * Command palette commands for vision analysis functionality.
 */

import type { Command, PluginServices } from "../../core/plugin-system/types";

/**
 * Vision plugin commands for the command palette
 */
export const visionCommands: Command[] = [
  {
    id: "vision:capture-full-page",
    title: "Capture Full Page",
    keywords: ["vision", "screenshot", "capture", "full", "page", "analyze"],
    category: "Vision",
    subtitle: "Capture and analyze the entire visible page",
    icon: "camera",
    execute: async (services: PluginServices) => {
      const state = services.getState<{
        captureMode: "full" | "region";
        setCaptureMode: (mode: "full" | "region") => void;
        setRegionSelectionActive: (active: boolean) => void;
        setSelectedRegion: (region: null) => void;
        triggerVisionAnalysis: () => Promise<void>;
      }>();

      // Set to full page mode and trigger analysis
      state.setCaptureMode("full");
      state.setRegionSelectionActive(false);
      state.setSelectedRegion(null);

      services.closeCommandPalette();

      await state.triggerVisionAnalysis();
    },
  },
  {
    id: "vision:capture-region",
    title: "Capture Region",
    keywords: ["vision", "screenshot", "capture", "region", "area", "select", "partial"],
    category: "Vision",
    subtitle: "Select a region of the page to capture and analyze",
    icon: "crop",
    execute: (services: PluginServices) => {
      const state = services.getState<{
        setCaptureMode: (mode: "full" | "region") => void;
        setRegionSelectionActive: (active: boolean) => void;
        setSelectedRegion: (region: null) => void;
      }>();

      // Enter region selection mode
      state.setCaptureMode("region");
      state.setRegionSelectionActive(true);
      state.setSelectedRegion(null);

      services.closeCommandPalette();

      // The UI should now show the region selection overlay
      // User will draw a rectangle, then analysis will be triggered
    },
  },
  {
    id: "vision:clear-results",
    title: "Clear Vision Results",
    keywords: ["vision", "clear", "reset", "results", "screenshots", "history"],
    category: "Vision",
    subtitle: "Clear all vision analysis results and screenshot history",
    icon: "trash",
    execute: (services: PluginServices) => {
      const state = services.getState<{
        clearVisionResults: () => void;
      }>();

      state.clearVisionResults();
      services.closeCommandPalette();
    },
  },
  {
    id: "vision:toggle-results-panel",
    title: "Toggle Vision Results Panel",
    keywords: ["vision", "results", "panel", "toggle", "show", "hide"],
    category: "Vision",
    subtitle: "Show or hide the vision analysis results panel",
    icon: "panel",
    execute: (services: PluginServices) => {
      const state = services.getState<{
        showResultsPanel: boolean;
        setShowResultsPanel: (show: boolean) => void;
        setActiveResultsTab: (tab: "eslint" | "vision") => void;
      }>();

      if (state.showResultsPanel) {
        state.setShowResultsPanel(false);
      } else {
        state.setShowResultsPanel(true);
        state.setActiveResultsTab("vision");
      }

      services.closeCommandPalette();
    },
  },
  {
    id: "vision:show-screenshot-gallery",
    title: "Show Screenshot Gallery",
    keywords: ["vision", "screenshots", "gallery", "history", "captures"],
    category: "Vision",
    subtitle: "View captured screenshots and their analysis results",
    icon: "image",
    isAvailable: (state) => {
      const s = state as { screenshotHistory: Map<string, unknown> };
      return s.screenshotHistory && s.screenshotHistory.size > 0;
    },
    execute: (services: PluginServices) => {
      const state = services.getState<{
        setShowResultsPanel: (show: boolean) => void;
        setActiveResultsTab: (tab: "eslint" | "vision") => void;
      }>();

      state.setShowResultsPanel(true);
      state.setActiveResultsTab("vision");

      services.closeCommandPalette();
    },
  },
  {
    id: "vision:enable-auto-analyze",
    title: "Enable Auto Vision Analysis",
    keywords: ["vision", "auto", "analyze", "automatic", "route", "change"],
    category: "Vision",
    subtitle: "Automatically analyze pages on route change",
    isAvailable: (state) => {
      const s = state as {
        autoScanSettings: { vision: { onRouteChange: boolean } };
      };
      return !s.autoScanSettings?.vision?.onRouteChange;
    },
    execute: (services: PluginServices) => {
      const state = services.getState<{
        updateAutoScanSettings: (partial: {
          vision: { onRouteChange: boolean };
        }) => void;
      }>();

      state.updateAutoScanSettings({
        vision: { onRouteChange: true },
      });

      services.closeCommandPalette();
    },
  },
  {
    id: "vision:disable-auto-analyze",
    title: "Disable Auto Vision Analysis",
    keywords: ["vision", "auto", "analyze", "automatic", "route", "change", "disable"],
    category: "Vision",
    subtitle: "Stop automatic analysis on route change",
    isAvailable: (state) => {
      const s = state as {
        autoScanSettings: { vision: { onRouteChange: boolean } };
      };
      return s.autoScanSettings?.vision?.onRouteChange === true;
    },
    execute: (services: PluginServices) => {
      const state = services.getState<{
        updateAutoScanSettings: (partial: {
          vision: { onRouteChange: boolean };
        }) => void;
      }>();

      state.updateAutoScanSettings({
        vision: { onRouteChange: false },
      });

      services.closeCommandPalette();
    },
  },
];
