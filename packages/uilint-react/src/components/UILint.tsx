"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type { Violation, ConsistencyResult } from "../consistency/types";
import { createSnapshot, cleanupDataElements } from "../consistency/snapshot";
import { isBrowser } from "../scanner/environment";
import { Overlay } from "./Overlay";
import { ConsistencyHighlighter } from "../consistency/highlights";
import { countElements } from "uilint-core";

export interface UILintProps {
  children: React.ReactNode;
  enabled?: boolean;
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  autoScan?: boolean;
  apiEndpoint?: string;
}

interface UILintContextValue {
  violations: Violation[];
  isScanning: boolean;
  elementCount: number;
  scan: () => Promise<void>;
  clearViolations: () => void;
  selectedViolation: Violation | null;
  setSelectedViolation: (violation: Violation | null) => void;
  lockedViolation: Violation | null;
  setLockedViolation: (violation: Violation | null) => void;
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
  apiEndpoint = "/api/uilint/consistency",
}: UILintProps) {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [elementCount, setElementCount] = useState(0);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(
    null
  );
  const [lockedViolation, setLockedViolation] = useState<Violation | null>(
    null
  );
  // Track if we're mounted on the client to avoid hydration mismatch
  const [isMounted, setIsMounted] = useState(false);

  const hasInitialized = useRef(false);

  // Set mounted state after hydration to avoid SSR mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cleanup data-elements attributes on unmount
  useEffect(() => {
    return () => {
      if (isBrowser()) {
        cleanupDataElements();
      }
    };
  }, []);

  // Main scan function - non-blocking, shows spinner while running
  const scan = useCallback(async () => {
    // Only run in browser environment
    if (!isBrowser()) return;

    setIsScanning(true);
    setSelectedViolation(null);
    setLockedViolation(null);

    try {
      // Create DOM snapshot with data-elements attributes
      const snapshot = createSnapshot(document.body);
      const count = countElements(snapshot);
      setElementCount(count);

      // Post to API for analysis
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(
          "[UILint] Analysis failed:",
          errorData.error || response.statusText
        );
        setViolations([]);
        return;
      }

      const result: ConsistencyResult = await response.json();
      setViolations(result.violations);

      if (result.violations.length === 0) {
        console.log(`[UILint] No consistency issues found (${count} elements)`);
      } else {
        console.log(
          `[UILint] Found ${result.violations.length} consistency issue(s)`
        );
      }
    } catch (error) {
      console.error("[UILint] Scan failed:", error);
      setViolations([]);
    } finally {
      setIsScanning(false);
    }
  }, [apiEndpoint]);

  const clearViolations = useCallback(() => {
    setViolations([]);
    setSelectedViolation(null);
    setLockedViolation(null);
    cleanupDataElements();
    setElementCount(0);
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (!enabled || hasInitialized.current) return;
    hasInitialized.current = true;

    if (!isBrowser()) return;

    if (autoScan) {
      // Delay scan to allow page to render
      const timer = setTimeout(scan, 1000);
      return () => clearTimeout(timer);
    }
  }, [enabled, autoScan, scan]);

  const contextValue: UILintContextValue = {
    violations,
    isScanning,
    elementCount,
    scan,
    clearViolations,
    selectedViolation,
    setSelectedViolation,
    lockedViolation,
    setLockedViolation,
  };

  // Don't render overlay until client is mounted (prevents hydration mismatch)
  const shouldRenderOverlay = enabled && isMounted;

  return (
    <UILintContext.Provider value={contextValue}>
      {children}
      {shouldRenderOverlay && (
        <>
          <Overlay position={position} />
          <ConsistencyHighlighter
            violations={violations}
            selectedViolation={selectedViolation}
            lockedViolation={lockedViolation}
          />
        </>
      )}
    </UILintContext.Provider>
  );
}
