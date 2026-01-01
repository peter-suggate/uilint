"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type { UILintIssue, ExtractedStyles } from "../types";
import { scanDOM } from "../scanner/dom-scanner";
import { isBrowser, getEnvironment } from "../scanner/environment";
import { LLMClient } from "../analyzer/llm-client";
import { generateStyleGuide } from "../styleguide/generator";
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
  const [highlightedIssue, setHighlightedIssue] = useState<UILintIssue | null>(
    null
  );

  const llmClient = useRef(new LLMClient({ apiEndpoint }));
  const hasInitialized = useRef(false);

  // Check if style guide exists
  const checkStyleGuide = useCallback(async () => {
    if (!isBrowser()) return;

    try {
      const response = await fetch("/api/uilint/styleguide");
      const data = await response.json();
      setStyleGuideExists(data.exists);
      setStyleGuideContent(data.content);
    } catch {
      setStyleGuideExists(false);
    }
  }, []);

  // Save style guide
  const saveStyleGuide = useCallback(async (content: string) => {
    if (!isBrowser()) return;

    try {
      await fetch("/api/uilint/styleguide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setStyleGuideExists(true);
      setStyleGuideContent(content);
    } catch (error) {
      console.error("[UILint] Failed to save style guide:", error);
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

      // If no style guide exists, generate one
      if (!styleGuideContent) {
        const generatedGuide = generateStyleGuide(snapshot.styles);
        await saveStyleGuide(generatedGuide);
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
  }, [styleGuideContent, saveStyleGuide]);

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

  // Don't render overlay in test/node environments
  const shouldRenderOverlay = enabled && isBrowser();

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
