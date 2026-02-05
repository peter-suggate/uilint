/**
 * Popover - Floating overlay anchored to a trigger element
 *
 * Features:
 * - Glassmorphic styling matching the design system
 * - Smooth motion animations
 * - Click outside to close
 * - Escape key to close
 * - Auto-positioning to stay within viewport
 */
import React, { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface PopoverProps {
  /** Whether the popover is open */
  open: boolean;
  /** Called when the popover should close */
  onClose: () => void;
  /** The trigger element that anchors the popover */
  trigger: React.ReactNode;
  /** The content to show in the popover */
  children: React.ReactNode;
  /** Preferred placement relative to trigger */
  placement?: "top" | "bottom" | "left" | "right";
  /** Alignment along the placement axis */
  align?: "start" | "center" | "end";
  /** Additional class name for the popover content */
  className?: string;
  /** Width of the popover (default: auto) */
  width?: number | "trigger" | "auto";
}

// ============================================================================
// Component
// ============================================================================

export function Popover({
  open,
  onClose,
  trigger,
  children,
  placement = "bottom",
  align = "start",
  className,
  width = "auto",
}: PopoverProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [actualWidth, setActualWidth] = useState<number | undefined>(undefined);

  // Calculate position based on trigger element
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !open) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverEl = popoverRef.current;
    const popoverRect = popoverEl?.getBoundingClientRect();

    let top = 0;
    let left = 0;

    // Calculate width
    if (width === "trigger") {
      setActualWidth(triggerRect.width);
    } else if (typeof width === "number") {
      setActualWidth(width);
    } else {
      setActualWidth(undefined);
    }

    const popoverWidth = popoverRect?.width || actualWidth || 200;
    const popoverHeight = popoverRect?.height || 200;
    const gap = 8;

    // Calculate initial position based on placement
    switch (placement) {
      case "top":
        top = triggerRect.top - popoverHeight - gap;
        break;
      case "bottom":
        top = triggerRect.bottom + gap;
        break;
      case "left":
        left = triggerRect.left - popoverWidth - gap;
        top = triggerRect.top;
        break;
      case "right":
        left = triggerRect.right + gap;
        top = triggerRect.top;
        break;
    }

    // Calculate horizontal alignment for top/bottom placements
    if (placement === "top" || placement === "bottom") {
      switch (align) {
        case "start":
          left = triggerRect.left;
          break;
        case "center":
          left = triggerRect.left + (triggerRect.width - popoverWidth) / 2;
          break;
        case "end":
          left = triggerRect.right - popoverWidth;
          break;
      }
    }

    // Calculate vertical alignment for left/right placements
    if (placement === "left" || placement === "right") {
      switch (align) {
        case "start":
          top = triggerRect.top;
          break;
        case "center":
          top = triggerRect.top + (triggerRect.height - popoverHeight) / 2;
          break;
        case "end":
          top = triggerRect.bottom - popoverHeight;
          break;
      }
    }

    // Constrain to viewport
    const padding = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Horizontal constraint
    if (left < padding) {
      left = padding;
    } else if (left + popoverWidth > viewportWidth - padding) {
      left = viewportWidth - popoverWidth - padding;
    }

    // Vertical constraint
    if (top < padding) {
      top = padding;
    } else if (top + popoverHeight > viewportHeight - padding) {
      top = viewportHeight - popoverHeight - padding;
    }

    setPosition({ top, left });
  }, [open, placement, align, width, actualWidth]);

  // Update position on open and resize
  useEffect(() => {
    if (!open) return;

    updatePosition();

    // Re-calculate after content renders
    const raf = requestAnimationFrame(updatePosition);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  // Handle click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };

    // Delay to avoid closing on the same click that opened
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const portalRoot = typeof document !== "undefined"
    ? document.getElementById("uilint-portal") || document.body
    : null;

  return (
    <>
      <div ref={triggerRef} className="inline-flex">
        {trigger}
      </div>

      {portalRoot &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  "fixed z-[99998]",
                  "rounded-xl",
                  "border border-foreground/[0.08]",
                  "bg-surface/95 backdrop-blur-xl",
                  "shadow-xl shadow-black/10",
                  "overflow-hidden",
                  className
                )}
                style={{
                  top: position.top,
                  left: position.left,
                  width: actualWidth,
                  pointerEvents: "auto",
                }}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>,
          portalRoot
        )}
    </>
  );
}

export default Popover;
