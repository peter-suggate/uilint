"use client";

/**
 * Hook for auto-scan initialization
 * Handles auto-ESLint and auto-Vision scans on page load
 */

import { useEffect, useRef, useCallback } from "react";
import { useUILintStore, type UILintStore } from "../store";
import { useNavigationDetection } from "./useNavigationDetection";

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Hook for auto-scan initialization and navigation detection
 */
export function useAutoScans(enabled: boolean, isMounted: boolean) {
  // Get state from Zustand store
  const settings = useUILintStore((s: UILintStore) => s.settings);
  const liveScanEnabled = useUILintStore((s: UILintStore) => s.liveScanEnabled);
  const storeEnableLiveScan = useUILintStore(
    (s: UILintStore) => s.enableLiveScan
  );
  const wsConnected = useUILintStore((s: UILintStore) => s.wsConnected);
  const autoScanSettings = useUILintStore(
    (s: UILintStore) => s.autoScanSettings
  );
  const triggerVisionAnalysis = useUILintStore(
    (s: UILintStore) => s.triggerVisionAnalysis
  );
  const visionAnalyzing = useUILintStore((s: UILintStore) => s.visionAnalyzing);
  const fetchPersistedScreenshots = useUILintStore(
    (s: UILintStore) => s.fetchPersistedScreenshots
  );
  const loadingPersistedScreenshots = useUILintStore(
    (s: UILintStore) => s.loadingPersistedScreenshots
  );

  /**
   * Track whether initial auto-scans have run to prevent duplicates
   */
  const initialVisionScanDoneRef = useRef(false);
  const initialEslintScanDoneRef = useRef(false);

  // Navigation detection callback - triggers auto-vision analysis on route changes
  const handleNavigate = useCallback(
    (route: string, previousRoute: string | null) => {
      console.log("[UILint] Navigation detected:", { route, previousRoute });

      // Auto-vision on route change (only if not initial load and setting is enabled)
      if (
        previousRoute !== null &&
        autoScanSettings.vision.onRouteChange &&
        wsConnected &&
        !visionAnalyzing
      ) {
        console.log(
          "[UILint] Auto-triggering vision analysis for route:",
          route
        );
        triggerVisionAnalysis();
      }
    },
    [
      autoScanSettings.vision.onRouteChange,
      wsConnected,
      visionAnalyzing,
      triggerVisionAnalysis,
    ]
  );

  // Use navigation detection - enabled when either ESLint live scan or vision auto-scan is active
  const shouldDetectNavigation =
    enabled &&
    isMounted &&
    (liveScanEnabled || autoScanSettings.vision.onRouteChange);
  useNavigationDetection(shouldDetectNavigation, handleNavigate);

  /**
   * Auto-vision scan on initial page load (when setting is enabled)
   * Triggers once after WebSocket connects
   */
  useEffect(() => {
    if (!isBrowser() || !enabled || !isMounted) return;
    if (!wsConnected) return;
    if (!autoScanSettings.vision.onInitialLoad) return;
    if (initialVisionScanDoneRef.current) return;
    if (visionAnalyzing) return;

    // Mark as done before triggering to prevent race conditions
    initialVisionScanDoneRef.current = true;

    // Small delay to allow page to fully settle
    const timeoutId = setTimeout(() => {
      console.log("[UILint] Auto-triggering initial vision analysis");
      triggerVisionAnalysis();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [
    enabled,
    isMounted,
    wsConnected,
    autoScanSettings.vision.onInitialLoad,
    visionAnalyzing,
    triggerVisionAnalysis,
  ]);

  /**
   * Auto-ESLint scan on page load (when setting is enabled)
   * Triggers once after WebSocket connects
   */
  useEffect(() => {
    if (!isBrowser() || !enabled || !isMounted) return;
    if (!wsConnected) return;
    if (!autoScanSettings.eslint.onPageLoad) return;
    if (initialEslintScanDoneRef.current) return;
    if (liveScanEnabled) return; // Already scanning

    // Mark as done before triggering
    initialEslintScanDoneRef.current = true;

    // Small delay to allow page to fully settle
    const timeoutId = setTimeout(() => {
      console.log("[UILint] Auto-triggering initial ESLint scan");
      storeEnableLiveScan(settings.hideNodeModules);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    enabled,
    isMounted,
    wsConnected,
    autoScanSettings.eslint.onPageLoad,
    liveScanEnabled,
    storeEnableLiveScan,
    settings.hideNodeModules,
  ]);

  /**
   * Fetch persisted screenshots on initial load
   * Loads previously captured vision screenshots from disk
   */
  useEffect(() => {
    if (!isBrowser() || !enabled || !isMounted) return;
    if (!wsConnected) return;
    if (loadingPersistedScreenshots) return; // Already loading

    // Fetch persisted screenshots (function has its own duplicate prevention)
    fetchPersistedScreenshots();
  }, [
    enabled,
    isMounted,
    wsConnected,
    loadingPersistedScreenshots,
    fetchPersistedScreenshots,
  ]);
}
