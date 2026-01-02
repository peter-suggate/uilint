"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type { UILintIssue, ExtractedStyles } from "uilint-core";
import { scanDOM } from "../scanner/dom-scanner";
import { isBrowser } from "../scanner/environment";
import { LLMClient } from "../analyzer/llm-client";
import { Overlay } from "./Overlay";
import { Highlighter } from "./Highlighter";

export interface UILintProps {
  children: React.ReactNode;
  enabled?: boolean;
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  autoScan?: boolean;
  apiEndpoint?: string;
}

interface UILintContextValue {
  issues: UILintIssue[];
  isScanning: boolean;
  styleGuideExists: boolean;
  scan: () => Promise<void>;
  clearIssues: () => void;
  highlightedIssue: UILintIssue | null;
  setHighlightedIssue: (issue: UILintIssue | null) => void;
}

const UILintContext = createContext<UILintContextValue | null>(null);

export function useUILint() {
  const context = useContext(UILintContext);
  if (!context) {
    throw new Error("useUILint must be used within a UILint component");
  }
  return context;
}

export function UILint({
  children,
  enabled = true,
  position = "bottom-left",
  autoScan = false,
  apiEndpoint,
}: UILintProps) {
  const [issues, setIssues] = useState<UILintIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [styleGuideExists, setStyleGuideExists] = useState(false);
  const [styleGuideContent, setStyleGuideContent] = useState<string | null>(
    null
  );
  const [styleGuideError, setStyleGuideError] = useState<string | null>(null);
  const [highlightedIssue, setHighlightedIssue] = useState<UILintIssue | null>(
    null
  );
  // Track if we're mounted on the client to avoid hydration mismatch
  const [isMounted, setIsMounted] = useState(false);

  const llmClient = useRef(new LLMClient({ apiEndpoint }));
  const hasInitialized = useRef(false);

  // Set mounted state after hydration to avoid SSR mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check if style guide exists
  const checkStyleGuide = useCallback(async () => {
    if (!isBrowser()) return;

    try {
      const response = await fetch("/api/uilint/styleguide");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStyleGuideExists(false);
        setStyleGuideContent(null);
        if (typeof (data as any)?.error === "string" && (data as any).error) {
          setStyleGuideError((data as any).error);
        } else if (response.status === 404) {
          setStyleGuideError(
            'UILint API route not found at "/api/uilint/styleguide". Ensure the UILint Next.js routes are installed (e.g. app/api/uilint/styleguide/route.ts).'
          );
        } else {
          setStyleGuideError(
            `Failed to load style guide (HTTP ${response.status}).`
          );
        }
        return;
      }
      setStyleGuideExists(!!data.exists);
      setStyleGuideContent(data.content ?? null);
      setStyleGuideError(null);
    } catch {
      setStyleGuideExists(false);
      setStyleGuideContent(null);
      setStyleGuideError(
        'Failed to reach "/api/uilint/styleguide". Is your Next.js server running?'
      );
    }
  }, []);

  // Main scan function
  const scan = useCallback(async () => {
    // Only run in browser environment
    if (!isBrowser()) return;

    setIsScanning(true);

    try {
      // Scan DOM
      const snapshot = scanDOM(document.body);

      // No style guide: do not auto-generate.
      if (!styleGuideContent) {
        console.error(
          `[UILint] ${
            styleGuideError ??
            'No style guide found. Create ".uilint/styleguide.md" at your Next.js app root (or pass styleguidePath / set UILINT_STYLEGUIDE_PATH on the server).'
          }`
        );
        setIssues([]);
        return;
      }

      // Analyze with LLM
      const result = await llmClient.current.analyze(
        snapshot.styles,
        styleGuideContent
      );

      setIssues(result.issues);
    } catch (error) {
      console.error("[UILint] Scan failed:", error);
    } finally {
      setIsScanning(false);
    }
  }, [styleGuideContent]);

  const clearIssues = useCallback(() => {
    setIssues([]);
    setHighlightedIssue(null);
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (!enabled || hasInitialized.current) return;
    hasInitialized.current = true;

    if (!isBrowser()) return;

    // In browser, check for style guide
    checkStyleGuide();

    if (autoScan) {
      // Delay scan to allow page to render
      const timer = setTimeout(scan, 1000);
      return () => clearTimeout(timer);
    }
  }, [enabled, autoScan, scan, checkStyleGuide]);

  const contextValue: UILintContextValue = {
    issues,
    isScanning,
    styleGuideExists,
    scan,
    clearIssues,
    highlightedIssue,
    setHighlightedIssue,
  };

  // Don't render overlay until client is mounted (prevents hydration mismatch)
  const shouldRenderOverlay = enabled && isMounted;

  return (
    <UILintContext.Provider value={contextValue}>
      {children}
      {shouldRenderOverlay && (
        <>
          <Overlay position={position} />
          <Highlighter />
        </>
      )}
    </UILintContext.Provider>
  );
}
