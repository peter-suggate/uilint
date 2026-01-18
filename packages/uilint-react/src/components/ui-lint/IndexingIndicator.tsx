"use client";

/**
 * IndexingIndicator - Shows duplicates index status
 *
 * A subtle, unobtrusive indicator that appears when the semantic
 * duplicates index is being built or updated.
 *
 * Displays:
 * - Spinner during indexing
 * - Brief "ready" toast on completion
 * - Error state if indexing fails
 */

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useUILintStore } from "./store";
import { getUILintPortalHost } from "./portal-host";
import { cn } from "@/lib/utils";
import { Icons } from "./command-palette/icons";

/** How long to show the "ready" toast after indexing completes */
const READY_TOAST_DURATION = 2000;

export function IndexingIndicator() {
  const status = useUILintStore((s) => s.duplicatesIndexStatus);
  const message = useUILintStore((s) => s.duplicatesIndexMessage);
  const progress = useUILintStore((s) => s.duplicatesIndexProgress);
  const error = useUILintStore((s) => s.duplicatesIndexError);
  const stats = useUILintStore((s) => s.duplicatesIndexStats);

  const [mounted, setMounted] = useState(false);
  const [showReadyToast, setShowReadyToast] = useState(false);

  // Track when indexing completes to show brief toast
  useEffect(() => {
    if (status === "ready" && stats) {
      setShowReadyToast(true);
      const timer = setTimeout(() => {
        setShowReadyToast(false);
      }, READY_TOAST_DURATION);
      return () => clearTimeout(timer);
    }
  }, [status, stats]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Don't show anything when idle and no recent completion
  const shouldShow =
    status === "indexing" || status === "error" || showReadyToast;

  if (!shouldShow) return null;

  const content = (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          data-ui-lint
          className={cn(
            "fixed bottom-4 left-4 z-[99998]",
            "flex items-center gap-2 px-3 py-2 rounded-lg",
            "bg-backdrop backdrop-blur-xl",
            "border border-border",
            "shadow-md",
            "text-xs text-foreground",
            "font-sans"
          )}
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {status === "indexing" && (
            <>
              {/* Spinner */}
              <Icons.Loader className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">
                {progress
                  ? `Indexing ${progress.current}/${progress.total}`
                  : message || "Indexing..."}
              </span>
            </>
          )}

          {status === "error" && (
            <>
              <Icons.AlertCircle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-destructive">
                Index error: {error || "Unknown error"}
              </span>
            </>
          )}

          {showReadyToast && status === "ready" && stats && (
            <>
              <Icons.CheckCircle className="w-3.5 h-3.5 text-success" />
              <span className="text-muted-foreground">
                Index ready ({stats.totalChunks} chunks)
              </span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, getUILintPortalHost());
}
