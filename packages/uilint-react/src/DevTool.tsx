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
import { UILint } from "./ui";
import { websocket } from "./core/services/websocket";
import { domObserver } from "./core/services/dom-observer";
import { initializePlugins } from "./core/store";
import { pluginRegistry } from "./core/plugin-system/registry";
import { eslintPlugin } from "./plugins/eslint";
import { visionPlugin } from "./plugins/vision";
import { fixPromptPlugin } from "./plugins/fix-prompt";
import { injectDevToolStyles } from "./styles/inject-styles";

// Track if plugins have been initialized
let pluginsInitialized = false;

// Inlined CSS (compiled by Tailwind/PostCSS during Vite build)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite handles ?inline for CSS
import devtoolsCss from "./styles/globals.css?inline";

/** Portal root class name */
const DEVTOOL_ROOT_CLASS = "uilint-devtool-root";

export type DevToolProps = {
  enabled?: boolean;
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
 * Handles WebSocket connection and UI rendering.
 */
export function DevTool({ enabled = true }: DevToolProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isReady, setIsReady] = useState(pluginsInitialized);
  const portalRootRef = useRef<HTMLElement | null>(null);
  const createdPortalRootRef = useRef(false);

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
   * Initialize plugins and connect to WebSocket server.
   * This registers the ESLint plugin and sets up message handlers.
   * IMPORTANT: Must complete before rendering UILint to ensure WebSocket is wired up.
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;
    if (!isMounted) return;

    let unsubscribeConnection: (() => void) | null = null;

    async function init() {
      // Register and initialize plugins (only once)
      if (!pluginsInitialized) {
        pluginRegistry.register(eslintPlugin);
        pluginRegistry.register(visionPlugin);
        pluginRegistry.register(fixPromptPlugin);
        await initializePlugins({ websocket, domObserver });
        pluginsInitialized = true;
        console.log("[DevTool] Plugins initialized");
      }

      // Mark as ready so UI can render
      setIsReady(true);

      // Connect to WebSocket server first
      websocket.connect();

      // Start DOM observation only after WebSocket connects
      // This ensures elements are detected when we can actually send lint requests
      unsubscribeConnection = websocket.onConnectionChange((connected) => {
        if (connected) {
          console.log("[DevTool] WebSocket connected, starting DOM observer");
          domObserver.start();
        } else {
          console.log(
            "[DevTool] WebSocket disconnected, stopping DOM observer"
          );
          domObserver.stop();
        }
      });
    }

    init();

    return () => {
      unsubscribeConnection?.();
      websocket.disconnect();
      domObserver.stop();
    };
  }, [enabled, isMounted]);

  // Don't render UI until mounted AND plugins are initialized
  // This ensures the store is created with the real WebSocket service
  if (!enabled || !isMounted || !isReady) return null;

  return <UILint enabled={enabled} />;
}
