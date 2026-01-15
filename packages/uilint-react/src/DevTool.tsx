"use client";

/**
 * Main DevTool React root
 *
 * Manages all UILint functionality:
 * - Event handlers (Alt key, mouse tracking, escape key)
 * - WebSocket connection to ESLint server
 * - Auto-scan initialization
 * - Navigation detection for auto-vision
 * - UI component rendering via portals
 */

import React, { useState, useEffect, useRef } from "react";
import { useUILintStore, type UILintStore } from "./components/ui-lint/store";
import { useDOMObserver } from "./components/ui-lint/useDOMObserver";
import { useDevToolEventHandlers } from "./components/ui-lint/hooks/useDevToolEventHandlers";
import { useAutoScans } from "./components/ui-lint/hooks/useAutoScans";
import { UILintUI } from "./components/ui-lint/UILintUI";
import { injectDevToolStyles } from "./styles/inject-styles";
import { DEVTOOL_ROOT_CLASS } from "./components/ui-lint/portal-host";

// Inlined CSS (compiled by Tailwind/PostCSS during Vite build)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite handles ?inline for CSS
import devtoolsCss from "./styles/globals.css?inline";

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
 * Handles all UILint functionality including event handlers,
 * WebSocket connection, auto-scans, and UI rendering.
 */
export function DevTool({ enabled = true }: DevToolProps) {
  const [isMounted, setIsMounted] = useState(false);
  const portalRootRef = useRef<HTMLElement | null>(null);
  const createdPortalRootRef = useRef(false);

  // WebSocket (ESLint server) actions
  const connectWebSocket = useUILintStore(
    (s: UILintStore) => s.connectWebSocket
  );
  const disconnectWebSocket = useUILintStore(
    (s: UILintStore) => s.disconnectWebSocket
  );

  // Mount DOM observer for navigation detection
  useDOMObserver(enabled && isMounted);

  // Event handlers (Alt key, mouse tracking, escape key)
  useDevToolEventHandlers(enabled);

  // Auto-scan initialization and navigation detection
  useAutoScans(enabled, isMounted);

  /**
   * Set mounted state after hydration
   */
  useEffect(() => {
    setIsMounted(true);
  }, []);

  /**
   * Ensure the devtool styles + portal host exist.
   *
   * Without this, CSS variables like `--uilint-backdrop` will be undefined when
   * consumers use DevTool directly (i.e. not via the web-component entry).
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
   * Auto-connect to the UILint WebSocket server for server-side ESLint results.
   * Connect only after hydration, and disconnect on unmount/disable.
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;
    if (!isMounted) return;

    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
  }, [enabled, isMounted, connectWebSocket, disconnectWebSocket]);

  // Don't render UI until mounted (prevents hydration mismatch)
  if (!enabled || !isMounted) return null;

  return <UILintUI />;
}
