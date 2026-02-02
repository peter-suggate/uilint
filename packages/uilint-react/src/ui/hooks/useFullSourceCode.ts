/**
 * useFullSourceCode - Hook for fetching full source file content
 *
 * Similar to useSourceCode but returns the entire file content
 * for use in the FileSourceView component.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useComposedStore } from "../../core/store";
import { websocket } from "../../core/services/websocket";
import {
  getCachedSource,
  setCachedSource,
  invalidateSource,
  type CachedSourceFile,
} from "../../core/services/source-cache";
import { isStaticMode, getFileSource } from "../../plugins/eslint/static-handler";

// ============================================================================
// Types
// ============================================================================

interface UseFullSourceCodeOptions {
  /** File path to fetch */
  filePath: string;
  /** Whether to fetch (default: true) */
  enabled?: boolean;
}

interface UseFullSourceCodeResult {
  /** Full source file content */
  source: CachedSourceFile | null;
  /** All lines as an array */
  lines: string[];
  /** Total number of lines */
  totalLines: number;
  /** Whether currently loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Manually trigger refetch */
  refetch: () => void;
}

interface SourceResultMessage {
  type: "source:result";
  filePath: string;
  content: string;
  totalLines: number;
  relativePath: string;
  requestId?: string;
}

interface SourceErrorMessage {
  type: "source:error";
  filePath: string;
  error: string;
  requestId?: string;
}

interface FileChangedMessage {
  type: "file:changed";
  filePath: string;
}

// Pending requests map for deduplication
const pendingRequests = new Map<string, Promise<CachedSourceFile | null>>();

// ============================================================================
// Hook
// ============================================================================

export function useFullSourceCode({
  filePath,
  enabled = true,
}: UseFullSourceCodeOptions): UseFullSourceCodeResult {
  const [source, setSource] = useState<CachedSourceFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsConnected = useComposedStore((s) => s.wsConnected);
  const requestIdRef = useRef<string | null>(null);

  const fetchSource = useCallback(() => {
    if (!enabled || !filePath) {
      return;
    }

    // Check cache first
    const cached = getCachedSource(filePath);
    if (cached) {
      setSource(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    // In static mode (no WebSocket), get source from manifest
    if (!wsConnected && isStaticMode()) {
      const manifestSource = getFileSource(filePath);
      if (manifestSource) {
        // Cache it for future requests
        const cachedSource = setCachedSource(
          filePath,
          manifestSource.content,
          manifestSource.totalLines,
          manifestSource.relativePath
        );
        setSource(cachedSource);
        setIsLoading(false);
        setError(null);
      } else {
        setSource(null);
        setIsLoading(false);
        setError("Source not available in manifest");
      }
      return;
    }

    // Need WebSocket for non-static mode
    if (!wsConnected) {
      return;
    }

    // Check for pending request (deduplication)
    const pending = pendingRequests.get(filePath);
    if (pending) {
      setIsLoading(true);
      pending.then((result) => {
        if (result) {
          setSource(result);
          setError(null);
        }
        setIsLoading(false);
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    // Create a promise for this request
    const requestId = `source-full-${filePath}-${Date.now()}`;
    requestIdRef.current = requestId;

    const promise = new Promise<CachedSourceFile | null>((resolve) => {
      // Set up one-time handlers for this request
      const unsubResult = websocket.on<SourceResultMessage>(
        "source:result",
        (message) => {
          if (message.filePath === filePath) {
            const cached = setCachedSource(
              message.filePath,
              message.content,
              message.totalLines,
              message.relativePath
            );
            unsubResult();
            unsubError();
            resolve(cached);
          }
        }
      );

      const unsubError = websocket.on<SourceErrorMessage>(
        "source:error",
        (message) => {
          if (message.filePath === filePath) {
            setError(message.error);
            unsubResult();
            unsubError();
            resolve(null);
          }
        }
      );

      // Send the request
      websocket.send({
        type: "source:fetch",
        filePath,
        requestId,
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        unsubResult();
        unsubError();
        resolve(null);
      }, 10000);
    });

    pendingRequests.set(filePath, promise);

    promise
      .then((result) => {
        if (result) {
          setSource(result);
        }
        setIsLoading(false);
      })
      .finally(() => {
        pendingRequests.delete(filePath);
      });
  }, [filePath, enabled, wsConnected]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchSource();
  }, [fetchSource]);

  // Subscribe to file changes to invalidate cache
  useEffect(() => {
    if (!filePath) return;

    const unsubscribe = websocket.on<FileChangedMessage>(
      "file:changed",
      (message) => {
        // Check if the changed file matches our file path
        if (
          message.filePath === filePath ||
          message.filePath.endsWith(filePath) ||
          filePath.endsWith(message.filePath)
        ) {
          invalidateSource(filePath);
          setSource(null);
          // Refetch if we're still mounted and enabled
          if (enabled) {
            fetchSource();
          }
        }
      }
    );

    return unsubscribe;
  }, [filePath, enabled, fetchSource]);

  return {
    source,
    lines: source?.lines ?? [],
    totalLines: source?.totalLines ?? 0,
    isLoading,
    error,
    refetch: fetchSource,
  };
}
