"use client";

/**
 * Hook to detect navigation changes
 * Monitors pathname changes and fires callback with debounce
 */

import { useEffect, useRef } from "react";

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Hook to detect navigation changes
 * Monitors pathname changes and fires callback with debounce
 */
export function useNavigationDetection(
  enabled: boolean,
  onNavigate: (route: string, previousRoute: string | null) => void
) {
  const previousRouteRef = useRef<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !isBrowser()) return;

    const checkNavigation = () => {
      const currentRoute = window.location.pathname;

      // Skip if same route
      if (currentRoute === previousRouteRef.current) return;

      const previousRoute = previousRouteRef.current;
      previousRouteRef.current = currentRoute;

      // Debounce to wait for DOM to settle
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        onNavigate(currentRoute, previousRoute);
      }, 500); // 500ms debounce after navigation
    };

    // Initial check
    checkNavigation();

    // Listen for popstate (back/forward)
    window.addEventListener("popstate", checkNavigation);

    // Create a MutationObserver to detect soft navigations (Next.js app router)
    const observer = new MutationObserver(() => {
      checkNavigation();
    });

    // Observe URL changes via title or any navigation-related elements
    observer.observe(document.head, {
      subtree: true,
      childList: true,
    });

    // Also check periodically for URL changes (fallback)
    const intervalId = setInterval(checkNavigation, 1000);

    return () => {
      window.removeEventListener("popstate", checkNavigation);
      observer.disconnect();
      clearInterval(intervalId);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [enabled, onNavigate]);
}
