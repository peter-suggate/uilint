"use client";

/**
 * Main DevTool React root
 *
 * Manages all UILint functionality:
 * - WebSocket connection to ESLint server
 * - UI component rendering
 */

import React, { useState, useEffect, useRef } from "react";
import { UILint } from "./ui";
import { websocket } from "./core/services/websocket";
import { injectDevToolStyles } from "./styles/inject-styles";

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
   * Auto-connect to the UILint WebSocket server for server-side ESLint results.
   * Connect only after hydration, and disconnect on unmount/disable.
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;
    if (!isMounted) return;

    websocket.connect();
    return () => {
      websocket.disconnect();
    };
  }, [enabled, isMounted]);

  // Don't render UI until mounted (prevents hydration mismatch)
  if (!enabled || !isMounted) return null;

  return <UILint enabled={enabled} />;
}
