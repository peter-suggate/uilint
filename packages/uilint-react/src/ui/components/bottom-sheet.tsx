/* eslint-disable uilint/prefer-tailwind */
/**
 * BottomSheet - Mobile-friendly modal that slides up from bottom
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, type PanInfo } from "motion/react";
import { cn } from "../../lib/utils";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number;
  showHandle?: boolean;
  swipeToDismiss?: boolean;
  className?: string;
}

const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 500;

export function BottomSheet({
  open,
  onClose,
  children,
  maxHeight = 85,
  showHandle = true,
  swipeToDismiss = true,
  className,
}: BottomSheetProps) {
  const handleDragEnd = React.useCallback(
    (_: unknown, info: PanInfo) => {
      if (!swipeToDismiss) return;
      if (
        info.offset.y > SWIPE_THRESHOLD ||
        info.velocity.y > SWIPE_VELOCITY_THRESHOLD
      ) {
        onClose();
      }
    },
    [onClose, swipeToDismiss]
  );

  const portalRoot =
    typeof document !== "undefined"
      ? document.getElementById("uilint-portal") || document.body
      : null;

  if (!portalRoot) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              zIndex: 99998,
              pointerEvents: "auto",
            }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag={swipeToDismiss ? "y" : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            className={cn("bottom-sheet", className)}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: `${maxHeight}vh`,
              background: "var(--uilint-glass-background)",
              backdropFilter: "blur(var(--uilint-glass-blur))",
              WebkitBackdropFilter: "blur(var(--uilint-glass-blur))",
              borderRadius: "16px 16px 0 0",
              border: "1px solid var(--uilint-glass-border)",
              borderBottom: "none",
              zIndex: 99999,
              pointerEvents: "auto",
              display: "flex",
              flexDirection: "column",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
              boxShadow: "0 -4px 32px rgba(0, 0, 0, 0.15)",
            }}
          >
            {/* Drag handle */}
            {showHandle && (
              <div
                style={{
                  width: "100%",
                  padding: "12px 0 8px",
                  display: "flex",
                  justifyContent: "center",
                  cursor: swipeToDismiss ? "grab" : "default",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    background: "var(--uilint-text-disabled)",
                    opacity: 0.5,
                  }}
                />
              </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    portalRoot
  );
}
