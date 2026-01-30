/**
 * useIsMobile - Hook for detecting mobile/tablet viewport and touch capability
 */
import { useState, useEffect, useCallback } from "react";

interface MobileState {
  isMobile: boolean;
  isTablet: boolean;
  isTouchDevice: boolean;
  isSmallScreen: boolean;
}

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
} as const;

// Helper to safely call matchMedia (not available in some test environments)
function safeMatchMedia(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(query);
}

function getMobileState(): MobileState {
  if (typeof window === "undefined") {
    return {
      isMobile: false,
      isTablet: false,
      isTouchDevice: false,
      isSmallScreen: false,
    };
  }
  const width = window.innerWidth;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const mq = safeMatchMedia("(pointer: coarse)");
  const prefersTouch = mq?.matches ?? false;
  return {
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isTouchDevice: hasTouch && prefersTouch,
    isSmallScreen: width < BREAKPOINTS.sm,
  };
}

export function useIsMobile(): MobileState {
  const [state, setState] = useState<MobileState>(getMobileState);

  const updateState = useCallback(() => {
    setState(getMobileState());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const controller = new AbortController();
    const { signal } = controller;

    window.addEventListener("resize", updateState, { signal });
    window.addEventListener("orientationchange", updateState, { signal });

    const mq = safeMatchMedia("(pointer: coarse)");
    if (mq) {
      mq.addEventListener("change", updateState, { signal });
    }

    return () => controller.abort();
  }, [updateState]);

  return state;
}
