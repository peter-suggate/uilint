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
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;
    if (!isMounted) return;

    async function init() {
      // Register and initialize plugins (only once)
      if (!pluginsInitialized) {
        pluginRegistry.register(eslintPlugin);
        await initializePlugins({ websocket, domObserver });
        pluginsInitialized = true;
        console.log("[DevTool] Plugins initialized");
      }

      // Connect to WebSocket server
      websocket.connect();
    }

    init();

    return () => {
      websocket.disconnect();
    };
  }, [enabled, isMounted]);

  // Don't render UI until mounted (prevents hydration mismatch)
  if (!enabled || !isMounted) return null;

  return <UILint enabled={enabled} />;
}
