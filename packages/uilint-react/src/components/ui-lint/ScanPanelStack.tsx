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
      const target = e.target as Element | null;

      // Don't close if clicking on any UILint element (prevents dismissing app popovers)
      if (target?.closest?.("[data-ui-lint]")) {
        return;
      }

      // Check if click is outside the panel container
      if (
        containerRef.current &&
        !containerRef.current.contains(target as Node)
      ) {
        onClose();
      }
    };

    // Delay adding listener to avoid immediate close from the click that opened it
    // Use capture phase to check before app handlers, but still allow app to see the event
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside, true);
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

  // Event handlers to prevent UILint interactions from propagating to the app
  const handleUILintInteraction = (
    e: React.MouseEvent | React.KeyboardEvent
  ) => {
    e.stopPropagation();
  };

  if (!show) return null;

  return (
    <div
      ref={containerRef}
      data-ui-lint
      onMouseDown={handleUILintInteraction}
      onClick={handleUILintInteraction}
      onKeyDown={handleUILintInteraction}
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        marginBottom: "8px",
        pointerEvents: "auto", // Ensure panel is interactive
      }}
    >
      <ScanResultsPopover onClose={onClose} />
    </div>
  );
}
