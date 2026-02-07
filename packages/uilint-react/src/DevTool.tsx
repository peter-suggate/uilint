"use client";

/**
 * Main DevTool React root
 *
 * Manages all UILint functionality:
 * - Plugin initialization
 * - WebSocket connection to ESLint server
 * - UI component rendering
 */

import React, { useState, useEffect, useRef } from "react";
import { devLog, devWarn } from "uilint-core";
import { UILint } from "./ui";
import { websocket, MAX_RECONNECT_ATTEMPTS } from "./core/services/websocket";
import { domObserver } from "./core/services/dom-observer";
import { initializePlugins, getStoreApi } from "./core/store";
import { pluginRegistry } from "./core/plugin-system/registry";
import { loadPlugins } from "./core/plugin-system/loader";
import { eslintPlugin, configureStaticMode, clearStaticMode } from "./plugins/eslint";
import { fixPromptPlugin } from "./plugins/fix-prompt";
import { injectDevToolStyles } from "./styles/inject-styles";

/** DevTool operating mode */
export type DevToolMode = "websocket" | "static";

// Track if plugins have been initialized
let pluginsInitialized = false;

// Inlined CSS (compiled by Tailwind/PostCSS during Vite build)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite handles ?inline for CSS
import devtoolsCss from "./styles/globals.css?inline";

/** Portal root class name */
const DEVTOOL_ROOT_CLASS = "uilint-devtool-root";

export type DevToolProps = {
  /** Enable/disable the devtool (default: true) */
  enabled?: boolean;
  /**
   * Operating mode:
   * - "websocket": Connect to local uilint serve (default)
   * - "static": Load issues from pre-built manifest
   */
  mode?: DevToolMode;
  /**
   * URL to the lint manifest (required for mode="static")
   * Example: "/.uilint/manifest.json"
   */
  manifestUrl?: string;
};

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Main devtool React root.
 *
 * Handles WebSocket connection (or static manifest loading) and UI rendering.
 */
export function DevTool({
  enabled = true,
  mode = "websocket",
  manifestUrl,
}: DevToolProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isReady, setIsReady] = useState(pluginsInitialized);
  const portalRootRef = useRef<HTMLElement | null>(null);
  const createdPortalRootRef = useRef(false);

  // Validate props
  if (mode === "static" && !manifestUrl) {
    devWarn("[DevTool] Static mode requires manifestUrl prop");
  }

  /**
   * Set mounted state after hydration
   */
  useEffect(() => {
    setIsMounted(true);
  }, []);

  /**
   * Ensure the devtool styles + portal host exist.
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;

    // Inject compiled Tailwind/devtool CSS exactly once per page.
    injectDevToolStyles(devtoolsCss as string);

    // Ensure a stable portal host for all UILint portals.
    const existing = document.querySelector<HTMLElement>(
      `.${DEVTOOL_ROOT_CLASS}`
    );
    if (existing) {
      portalRootRef.current = existing;
      createdPortalRootRef.current = false;
      return;
    }

    const container = document.createElement("div");
    container.className = DEVTOOL_ROOT_CLASS;
    container.setAttribute("data-ui-lint-root", "true");
    document.body.appendChild(container);

    portalRootRef.current = container;
    createdPortalRootRef.current = true;

    return () => {
      if (createdPortalRootRef.current) {
        portalRootRef.current?.remove();
      }
      portalRootRef.current = null;
      createdPortalRootRef.current = false;
    };
  }, [enabled]);

  /**
   * Initialize plugins and connect to data source.
   * - WebSocket mode: Connect to local uilint serve
   * - Static mode: Load pre-built manifest
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;
    if (!isMounted) return;

    let unsubscribeConnection: (() => void) | null = null;
    const isStaticMode = mode === "static" && manifestUrl;

    async function init() {
      // Configure static mode BEFORE plugin initialization
      if (isStaticMode) {
        devLog("[DevTool] Configuring static mode with manifest:", manifestUrl);
        configureStaticMode(manifestUrl);
      } else {
        // Ensure static mode is cleared if switching modes
        clearStaticMode();
      }

      // Register and initialize plugins (only once)
      if (!pluginsInitialized) {
        // Register local plugins
        pluginRegistry.register(eslintPlugin);
        pluginRegistry.register(fixPromptPlugin);

        // Load external plugins (vision, semantic) — imports them,
        // triggers auto-registration with uilint-core's registry, then
        // adapts them from declarative to imperative React plugins.
        // Pass empty manifests since local plugins are already registered above.
        // Skip external plugins in static mode — vision and semantic analysis
        // require a local language model (Ollama) which isn't available in
        // static/preview deployments.
        if (!isStaticMode) {
          const externalPlugins = await loadPlugins([]);
          for (const plugin of externalPlugins) {
            pluginRegistry.register(plugin);
          }
          devLog(
            `[DevTool] Loaded ${externalPlugins.length} external plugin(s):`,
            externalPlugins.map((p) => p.id).join(", ")
          );
        } else {
          devLog("[DevTool] Static mode: skipping vision/semantic plugins (no local LLM available)");
        }

        await initializePlugins({ websocket, domObserver });
        pluginsInitialized = true;
        devLog("[DevTool] Plugins initialized in", isStaticMode ? "static" : "websocket", "mode");
      }

      // Set connection mode in the store
      const storeApi = getStoreApi();
      if (storeApi) {
        storeApi.getState().setConnectionStatus({
          mode: isStaticMode ? "static" : "websocket",
          maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
        });
      }

      // Mark as ready so UI can render
      setIsReady(true);

      if (isStaticMode) {
        // Static mode: Start DOM observer immediately (no WebSocket needed)
        devLog("[DevTool] Static mode: starting DOM observer");
        domObserver.start();
      } else {
        // WebSocket mode: Connect and wait for connection before starting observer
        websocket.connect();

        unsubscribeConnection = websocket.onConnectionChange((connected) => {
          if (connected) {
            devLog("[DevTool] WebSocket connected, starting DOM observer");
            domObserver.start();
          } else {
            devLog(
              "[DevTool] WebSocket disconnected, stopping DOM observer"
            );
            domObserver.stop();
          }
        });
      }
    }

    init();

    return () => {
      unsubscribeConnection?.();
      if (!isStaticMode) {
        websocket.disconnect();
      }
      domObserver.stop();
    };
  }, [enabled, isMounted, mode, manifestUrl]);

  // Don't render UI until mounted AND plugins are initialized
  // This ensures the store is created with the real WebSocket service
  if (!enabled || !isMounted || !isReady) return null;

  return <UILint enabled={enabled} />;
}
