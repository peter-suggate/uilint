"use client";

/**
 * Scan Panel Stack - Container for the scan results popover
 *
 * Now renders only the consolidated ScanResultsPopover which has
 * expandable file sections with inline element lists.
 */

import React, { useRef, useEffect } from "react";
import { ScanResultsPopover } from "./ScanResultsPopover";

interface ScanPanelStackProps {
  show: boolean;
  onClose: () => void;
}

export function ScanPanelStack({ show, onClose }: ScanPanelStackProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close panel
  useEffect(() => {
    if (!show) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      // Check if click is outside the panel container
      if (containerRef.current && !containerRef.current.contains(target)) {
        // Also check if click is on a badge or other UI element
        const isUILintElement = (target as Element).closest?.("[data-ui-lint]");
        if (!isUILintElement) {
          onClose();
        }
      }
    };

    // Delay adding listener to avoid immediate close from the click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [show, onClose]);

  // Handle Escape key to close panel
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <ScanResultsPopover />
    </div>
  );
}
